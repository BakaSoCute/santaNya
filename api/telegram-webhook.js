import { updateApplicationStatus } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called');
  
  try {
    const { callback_query } = req.body;

    if (!callback_query) {
      console.log('❌ No callback_query in request');
      return res.status(200).json({ ok: true });
    }

    const { data, message, from, id: callback_id } = callback_query;
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
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
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
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
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

    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${updated.twitchName}\n` +
      `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${updated.contactInfo}\n` +
      `⏰ *Время подачи:* ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
      `👤 *Обработал:* ${processedBy}`;

    // Обновляем сообщение
    const editResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: updatedMessage,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] } // Убираем кнопки
      }),
    });

    const editResult = await editResponse.json();
    
    if (!editResult.ok) {
      console.error('❌ Failed to edit message:', editResult);
      // Если не удалось обновить сообщение, хотя бы показываем alert
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callback_id,
          text: `✅ Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}! (сообщение не обновлено)`,
          show_alert: true
        }),
      });
    } else {
      console.log('✅ Message updated successfully');
      
      // Подтверждаем успешное выполнение
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
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

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    
    // В случае ошибки пытаемся ответить Telegram что что-то пошло не так
    try {
      if (req.body.callback_query) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
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
