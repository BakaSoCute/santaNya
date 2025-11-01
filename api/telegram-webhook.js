import { updateApplicationStatus } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called');
  
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

    // 1. Сразу отвечаем на callback
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callback_query.id,
        text: `Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
      }),
    });

    // 2. Обновляем статус в Redis
    const status = action === 'approve' ? 'approved' : 'rejected';
    const processedBy = from.username || from.first_name;
    
    console.log(`📝 Updating application ${applicationId} to ${status}`);
    
    const updated = await updateApplicationStatus(applicationId, status, processedBy);
    
    if (!updated) {
      console.log(`❌ Application ${applicationId} not found in Redis`);
      return;
    }

    console.log(`✅ Application ${applicationId} updated to ${status}`);

    // 3. Обновляем сообщение в Telegram
    const statusEmoji = status === 'approved' ? '✅' : '❌';
    const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${updated.twitchName}\n` +
      `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${updated.contactInfo}\n` +
      `⏰ *Время подачи:* ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
      `👤 *Обработал:* ${processedBy}`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
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

    console.log(`✅ Successfully processed ${action} for application ${applicationId}`);

  } catch (error) {
    console.error('💥 Webhook error:', error);
  }
}
