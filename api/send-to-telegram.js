import { createApplication, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  // ... остальной код тот же, но использует file-storage
  const application = await createApplication(formData);
  // ...
}
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

    // Диагностика
    await debugRedis();
    
    // Создаем заявку
    const application = await createApplication(formData);
    const applicationId = application.id;

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
      // Откатываем создание заявки при ошибке
      const { deleteApplication } = await import('../lib/storage.js');
      deleteApplication(applicationId);
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



