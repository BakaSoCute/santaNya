// Используем то же хранилище что и в webhook
const applications = new Map();
let applicationCounter = 1;

export default async function handler(req, res) {
  console.log('📨 Send to telegram called');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { formData } = req.body;
    
    if (!formData) {
      return res.status(400).json({ error: 'No form data' });
    }

    // Создаем заявку в том же хранилище
    const applicationId = applicationCounter++;
    const application = {
      id: applicationId,
      twitchName: formData.fullName,
      contactMethod: formData.contactMethod,
      contactInfo: formData.contactInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    applications.set(applicationId, application);
    console.log(`✅ Created application ${applicationId} in memory`);

    // Отправляем в Telegram
    const message = `🎁 *НОВАЯ ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${formData.fullName || 'Не указан'}\n` +
      `📞 *Способ связи:* ${formData.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${formData.contactInfo || 'Не указан'}\n` +
      `⏰ *Время:* ${new Date().toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ⏳ Ожидание`;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Одобрить', callback_data: `approve_${applicationId}` },
            { text: '❌ Отклонить', callback_data: `reject_${applicationId}` }
          ]]
        }
      }),
    });

    if (telegramResponse.ok) {
      res.json({ 
        success: true,
        applicationId: applicationId,
        message: 'Заявка успешно отправлена в Telegram' 
      });
    } else {
      applications.delete(applicationId);
      throw new Error('Telegram API error');
    }

  } catch (error) {
    console.error('Error sending to Telegram:', error);
    res.status(500).json({ 
      error: 'Failed to send to Telegram',
      details: error.message 
    });
  }
}
