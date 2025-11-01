// In-memory хранилище (должно быть таким же как в lib/applications.js)
const applications = new Map();

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called');
  
  try {
    const { callback_query } = req.body;
    console.log('Webhook data:', JSON.stringify(req.body, null, 2));

    if (!callback_query) {
      return res.status(200).json({ ok: true });
    }

    const { data, message, from } = callback_query;
    const [action, applicationId] = data.split('_');

    console.log(`🔄 Processing ${action} for application ${applicationId}`);

    // Обновляем статус в памяти
    const application = applications.get(parseInt(applicationId));
    
    if (application) {
      application.status = action === 'approve' ? 'approved' : 'rejected';
      application.processedBy = from.username || from.first_name;
      application.updatedAt = new Date().toISOString();
      
      console.log(`✅ Updated application ${applicationId} status to: ${application.status}`);
    } else {
      console.log(`❌ Application ${applicationId} not found in memory`);
    }

    // Отвечаем на callback
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callback_query.id,
        text: `Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
      }),
    });

    // Обновляем сообщение в Telegram
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
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('💥 Webhook error:', error);
    res.status(200).json({ ok: true });
  }
}
