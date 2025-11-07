import { updateApplicationStatus } from '../lib/vercel-redis-storage.js';

// Функция для экранирования MarkdownV2 символов
function escapeMarkdownV2(text) {
  if (!text) return '';
  
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let escapedText = String(text);
  
  specialChars.forEach(char => {
    escapedText = escapedText.split(char).join(`\\${char}`);
  });
  
  return escapedText;
}

// Функция для отправки сообщений в Telegram
async function sendTelegramMessage(chatId, text, parse_mode = 'Markdown') {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parse_mode
    }),
  });
  return await response.json();
}

async function handleChatIdCommand(message) {
  const chatId = message.chat.id;
  const userName = message.chat.username || message.chat.first_name;
  
  const responseText = `
📋 Информация о чате:

🆔 Chat ID: \`${chatId}\`
👤 Имя: ${userName}
💬 Тип чата: ${message.chat.type}
📅 Дата регистрации: ${new Date().toLocaleDateString('ru-RU')}

💡 Сохраните этот Chat ID для настройки бота
  `;

  await sendTelegramMessage(chatId, responseText);
  
  console.log('✅ Chat ID получен:', { chatId, userName });
}

// Функция для создания безопасного сообщения
function createSafeMessage(applicationId, updated, status, statusEmoji, statusText, processedBy) {
  const escapedTwitchName = escapeMarkdownV2(updated.twitchName);
  const escapedContactInfo = escapeMarkdownV2(updated.contactInfo);
  const escapedApplicationId = escapeMarkdownV2(applicationId.toString());
  const escapedProcessedBy = escapeMarkdownV2(processedBy);
  
  const formattedTime = new Date(updated.createdAt).toLocaleString('ru-RU');
  const escapedTime = escapeMarkdownV2(formattedTime);

  const message = `🎁 *ЗАЯВКА \\#${escapedApplicationId}*\n\n` +
    `👤 *Twitch ник:* ${escapedTwitchName || 'Не указан'}\n` +
    `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
    `💬 *Контакт:* ${escapedContactInfo || 'Не указан'}\n` +
    `⏰ *Время подачи:* ${escapedTime}\n` +
    `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
    `👤 *Обработал:* ${escapedProcessedBy}`;

  return message;
}

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called');
  
  try {
    const { message, callback_query } = req.body;

    // Обработка обычных сообщений (команд)
    if (message && message.text) {
      const { text } = message;
      console.log(`💬 Received message: "${text}" from ${message.from.username || message.from.first_name}`);

      if (text.startsWith('/start') || text.startsWith('/chatid')) {
        await handleChatIdCommand(message);
      } else {
        // Ответ на любое другое сообщение
        await sendTelegramMessage(message.chat.id, `
🤖 Я бот-модератор заявок.

Используйте команды:
/start - начать работу
/chatid - получить Chat ID

Или работайте с заявками через кнопки.
        `);
      }

      return res.status(200).json({ ok: true });
    }

    // Обработка callback query (кнопки)
    if (callback_query) {
      const { data, message: callbackMessage, from, id: callback_id } = callback_query; // Переименовали переменную
      console.log(`🔍 Processing callback: ${data} from ${from.username || from.first_name}`);

      if (!data) {
        console.log('❌ No data in callback');
        return res.status(200).json({ ok: true });
      }

      const [action, applicationId] = data.split('_');
      
      if (!action || !applicationId) {
        console.log('❌ Invalid data format:', data);
        return res.status(200).json({ ok: true });
      }

      console.log(`🔄 Action: ${action}, Application ID: ${applicationId}`);

      // Сразу отвечаем на callback query чтобы Telegram знал что мы получили запрос
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callback_id,
          text: `⏳ Обрабатываю...`
        }),
      });

      // Обновляем статус в Redis
      const status = action === 'approve' ? 'approved' : 'rejected';
      const processedBy = from.username || from.first_name;
      
      console.log(`📝 Updating application ${applicationId} to ${status}`);
      
      const updated = await updateApplicationStatus(applicationId, status, processedBy);
      
      if (!updated) {
        console.log(`❌ Application ${applicationId} not found in Redis`);
        
        // Уведомляем пользователя об ошибке
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_id,
            text: `❌ Заявка #${applicationId} не найдена`,
            show_alert: true
          }),
        });
        
        return res.status(200).json({ ok: true });
      }

      console.log(`✅ Application ${applicationId} updated to ${status}`);

      // Обновляем сообщение в Telegram
      const statusEmoji = status === 'approved' ? '✅' : '❌';
      const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

      // Создаем безопасное сообщение
      const updatedMessage = createSafeMessage(applicationId, updated, status, statusEmoji, statusText, processedBy);

      console.log('📝 Safe message created, editing...');

      // Обновляем сообщение с MarkdownV2
      const editResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: callbackMessage.chat.id, // Используем переименованную переменную
          message_id: callbackMessage.message_id, // Используем переименованную переменную
          text: updatedMessage,
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [] } // Убираем кнопки
        }),
      });

      const editResult = await editResponse.json();
      
      if (!editResult.ok) {
        console.error('❌ Failed to edit message:', editResult);
        
        // Если ошибка форматирования, пробуем отправить без форматирования
        if (editResult.description?.includes('entities') || editResult.description?.includes('parse')) {
          console.log('🔄 Trying fallback without formatting...');
          
          const fallbackMessage = `🎁 ЗАЯВКА #${applicationId}\n\n` +
            `👤 Twitch ник: ${updated.twitchName || 'Не указан'}\n` +
            `📞 Способ связи: ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
            `💬 Контакт: ${updated.contactInfo || 'Не указан'}\n` +
            `⏰ Время подачи: ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
            `📊 Статус: ${statusEmoji} ${statusText}\n` +
            `👤 Обработал: ${processedBy}`;

          const fallbackResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackMessage.chat.id, // Используем переименованную переменную
              message_id: callbackMessage.message_id, // Используем переименованную переменную
              text: fallbackMessage,
              // Без parse_mode - обычный текст
              reply_markup: { inline_keyboard: [] }
            }),
          });

          const fallbackResult = await fallbackResponse.json();
          
          if (fallbackResult.ok) {
            console.log('✅ Message updated without formatting');
          } else {
            console.error('❌ Fallback also failed:', fallbackResult);
          }
        }
        
        // Показываем alert пользователю
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_id,
            text: `✅ Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`,
            show_alert: true
          }),
        });
      } else {
        console.log('✅ Message updated successfully');
        
        // Подтверждаем успешное выполнение
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_id,
            text: `✅ Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
          }),
        });
      }

      console.log(`✅ Successfully processed ${action} for application ${applicationId}`);
      return res.status(200).json({ ok: true });
    }

    // Если пришел неизвестный тип запроса
    console.log('❓ Unknown request type:', Object.keys(req.body));
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    
    // В случае ошибки пытаемся ответить Telegram что что-то пошло не так
    try {
      if (req.body.callback_query) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_REVIEW}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: req.body.callback_query.id,
            text: '❌ Ошибка при обработке запроса',
            show_alert: true
          }),
        });
      }
    } catch (fetchError) {
      console.error('💥 Failed to send error response:', fetchError);
    }
    
    return res.status(200).json({ ok: true });
  }
}
