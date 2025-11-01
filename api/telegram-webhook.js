import { updateApplicationStatus, getApplication } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called - ENHANCED VERSION');
  
  try {
    // Сразу возвращаем 200 чтобы Telegram не жаловался
    res.status(200).json({ ok: true, received: true });
    
    // Асинхронная обработка
    processWebhookAsync(req.body).catch(console.error);
    
  } catch (error) {
    console.error('💥 Webhook setup error:', error);
  }
}

async function processWebhookAsync(body) {
  try {
    console.log('📦 Webhook body received');
    
    const { callback_query } = body;

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

    // 1. Сначала отвечаем на callback чтобы пользователь видел реакцию
    console.log('📨 Answering callback query immediately...');
    await answerCallbackQuery(callback_query.id, action);
    
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
    console.log('✏️ Editing message in Telegram...');
    await editTelegramMessage(message, applicationId, updated, status, processedBy);

    console.log(`✅ Successfully processed ${action} for application ${applicationId}`);

  } catch (error) {
    console.error('💥 Async webhook processing error:', error);
  }
}

// Функция для ответа на callback
async function answerCallbackQuery(callbackQueryId, action) {
  try {
    const text = action === 'approve' ? '✅ Заявка одобрена!' : '❌ Заявка отклонена!';
    
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false
      }),
    });
    
    const result = await response.json();
    console.log('📩 Callback answer result:', result.ok ? '✅ Success' : '❌ Failed');
    
  } catch (error) {
    console.error('❌ Error answering callback:', error);
  }
}

// Функция для обновления сообщения в Telegram
async function editTelegramMessage(message, applicationId, application, status, processedBy) {
  try {
    const statusEmoji = status === 'approved' ? '✅' : '❌';
    const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${application.twitchName}\n` +
      `📞 *Способ связи:* ${application.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${application.contactInfo}\n` +
      `⏰ *Время подачи:* ${new Date(application.createdAt).toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
      `👤 *Обработал:* ${processedBy}\n` +
      `🕐 *Время обработки:* ${new Date().toLocaleString('ru-RU')}`;

    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: updatedMessage,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [] // Убираем кнопки после обработки
        }
      }),
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Message successfully edited in Telegram');
    } else {
      console.log('❌ Failed to edit message:', result.description);
      // Пробуем альтернативный метод если первый не сработал
      await tryAlternativeEdit(message, applicationId, status, processedBy);
    }
    
  } catch (error) {
    console.error('❌ Error editing Telegram message:', error);
  }
}

// Альтернативный метод редактирования сообщения
async function tryAlternativeEdit(message, applicationId, status, processedBy) {
  try {
    console.log('🔄 Trying alternative edit method...');
    
    const statusEmoji = status === 'approved' ? '✅' : '❌';
    const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';
    
    const alternativeMessage = `🎁 ЗАЯВКА #${applicationId}\n\n` +
      `Статус: ${statusEmoji} ${statusText}\n` +
      `Обработал: ${processedBy}\n` +
      `Время: ${new Date().toLocaleString('ru-RU')}`;

    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: alternativeMessage,
        parse_mode: null, // Без разметки
      }),
    });

    const result = await response.json();
    console.log('🔧 Alternative edit result:', result.ok ? '✅ Success' : '❌ Failed');
    
  } catch (error) {
    console.error('❌ Alternative edit also failed:', error);
  }
}
