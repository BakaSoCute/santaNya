import { updateApplicationStatus } from './lib/applications.js';

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called');
  
  try {
    const { callback_query } = req.body;
    console.log('Webhook data:', JSON.stringify(req.body, null, 2));

    if (!callback_query) {
      console.log('No callback_query in request');
      return res.status(400).json({ error: 'No callback data' });
    }

    const { data, message, from } = callback_query;
    const [action, applicationId] = data.split('_');

    console.log(`🔄 Processing ${action} for application ${applicationId}`);

    const application = updateApplicationStatus(
      applicationId, 
      action === 'approve' ? 'approved' : 'rejected',
      action === 'approve' ? (from.username || from.first_name) : null,
      action === 'reject' ? (from.username || from.first_name) : null
    );

    if (!application) {
      console.error('Application not found:', applicationId);
      return res.status(404).json({ error: 'Application not found' });
    }

    // Обновляем сообщение в Telegram
    const statusEmoji = application.status === 'approved' ? '✅' : '❌';
    const statusText = application.status === 'approved' ? 'Одобрена' : 'Отклонена';

    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${application.twitchName}\n` +
      `📞 *Способ связи:* ${application.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${application.contactInfo}\n` +
      `⏰ *Время подачи:* ${new Date(application.createdAt).toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
      (application.approvedBy ? `✅ *Одобрил:* ${application.approvedBy}\n` : '') +
      (application.rejectedBy ? `❌ *Отклонил:* ${application.rejectedBy}\n` : '');

    // Обновляем сообщение в Telegram
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

    // Отправляем ответ на callback
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callback_query.id,
        text: `Заявка ${statusText.toLowerCase()}!`
      }),
    });

    console.log(`✅ Application ${applicationId} ${application.status}`);
    res.json({ success: true });

  } catch (error) {
    console.error('💥 Telegram webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}
