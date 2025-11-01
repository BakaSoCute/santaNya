// Простая версия для диагностики
export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called');
  
  try {
    // Логируем весь запрос для диагностики
    console.log('Webhook body:', JSON.stringify(req.body, null, 2));
    
    const { callback_query } = req.body;

    if (!callback_query) {
      console.log('No callback_query found');
      return res.status(200).json({ ok: true }); // Всегда возвращаем 200 для Telegram
    }

    const { data, message, from } = callback_query;
    console.log(`Processing: ${data} from user: ${from.username || from.first_name}`);

    // Простая обработка без сложной логики
    const [action, applicationId] = data.split('_');
    
    // Сначала сразу отвечаем Telegram, чтобы не было таймаута
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callback_query.id,
        text: `Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
      }),
    });

    // Затем обновляем сообщение
    const statusText = action === 'approve' ? '✅ Одобрена' : '❌ Отклонена';
    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `📊 *Статус:* ${statusText}\n` +
      `👤 *Обработал:* ${from.username || from.first_name}\n` +
      `⏰ *Время:* ${new Date().toLocaleString('ru-RU')}`;

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
    
    // Всегда возвращаем 200 для Telegram
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('💥 Webhook error:', error);
    
    // Всегда возвращаем 200 даже при ошибках, иначе Telegram будет считать webhook нерабочим
    res.status(200).json({ ok: true, error: error.message });
  }
}
