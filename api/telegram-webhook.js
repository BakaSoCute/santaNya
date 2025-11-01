import { updateApplicationStatus, getApplication, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called - ENHANCED LOGGING');
  
  try {
    // Сразу возвращаем 200 чтобы Telegram не жаловался
    res.status(200).json({ ok: true });
    
    // Асинхронная обработка
    const { callback_query } = req.body;

    if (!callback_query) {
      console.log('❌ No callback_query in request');
      return;
    }

    const { data, message, from } = callback_query;
    console.log(`🔍 Processing callback: ${data} from ${from.username || from.first_name}`);

    if (!data) {
      console.log('❌ No data in callback');
      return;
    }

    const [action, applicationId] = data.split('_');
    
    if (!action || !applicationId) {
      console.log('❌ Invalid data format:', data);
      return;
    }

    console.log(`🔄 Action: ${action}, Application ID: ${applicationId}`);

    // 1. Сначала отвечаем на callback
    console.log('📨 Answering callback query...');
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callback_query.id,
        text: `Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
      }),
    });

    // 2. ДИАГНОСТИКА: Проверяем текущий статус ДО обновления
    console.log('🔍 Checking current application status BEFORE update...');
    const currentApp = await getApplication(applicationId);
    console.log('📄 Current application:', currentApp);

    // 3. Обновляем статус в Redis
    const status = action === 'approve' ? 'approved' : 'rejected';
    const processedBy = from.username || from.first_name;
    
    console.log(`📝 Updating application ${applicationId} to ${status}...`);
    
    const updated = await updateApplicationStatus(applicationId, status, processedBy);
    
    if (!updated) {
      console.log(`❌ Application ${applicationId} not found in Redis`);
      return;
    }

    console.log(`✅ Application ${applicationId} updated to ${status}`);

    // 4. ДИАГНОСТИКА: Проверяем статус ПОСЛЕ обновления
    console.log('🔍 Checking application status AFTER update...');
    const verifiedApp = await getApplication(applicationId);
    console.log('📄 Verified application:', verifiedApp);

    // 5. ДИАГНОСТИКА: Проверяем Redis состояние
    console.log('🔧 Checking Redis state...');
    await debugRedis();

    // 6. Обновляем сообщение в Telegram
    console.log('✏️ Editing message in Telegram...');
    const statusEmoji = status === 'approved' ? '✅' : '❌';
    const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${updated.twitchName}\n` +
      `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${updated.contactInfo}\n` +
      `⏰ *Время подачи:* ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
      `👤 *Обработал:* ${processedBy}\n` +
      `✅ *Обновлено в Redis:* ДА`;

    const editResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: updatedMessage,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] }
      }),
    });

    const editResult = await editResponse.json();
    console.log('📝 Message edit result:', editResult.ok ? '✅ Success' : '❌ Failed');

    console.log(`✅ Successfully processed ${action} for application ${applicationId}`);

  } catch (error) {
    console.error('💥 Webhook error:', error);
    console.error('💥 Error stack:', error.stack);
  }
}
