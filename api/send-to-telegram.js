import { createApplication, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('📨 Send to telegram called');
  
  // CORS headers - ДОБАВЬТЕ ЭТО В САМОМ НАЧАЛЕ
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { formData } = req.body;
    
    if (!formData) {
      return res.status(400).json({ error: 'No form data provided' });
    }

    console.log('📨 Received Telegram request:', formData);

    // Диагностика Redis
    await debugRedis();
    
    // Создаем заявку в Redis
    const application = await createApplication(formData);
    const applicationId = application.id;

    const message = `🎁 *НОВАЯ ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${formData.fullName || 'Не указан'}\n` +
      `📞 *Способ связи:* ${formData.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${formData.contactInfo || 'Не указан'}\n` +
      `⏰ *Время:* ${new Date().toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ⏳ Ожидание`;

    console.log('📤 Sending to Telegram...');

    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Одобрить',
                callback_data: `approve_${applicationId}`
              },
              {
                text: '❌ Отклонить', 
                callback_data: `reject_${applicationId}`
              }
            ]
          ]
        }
      }),
    });

    const telegramResult = await telegramResponse.json();

    console.log('📩 Telegram API response:', telegramResult);

    if (telegramResponse.ok) {
      res.json({ 
        success: true,
        applicationId: applicationId,
        message: 'Заявка успешно отправлена в Telegram' 
      });
    } else {
      // Откатываем создание заявки при ошибке
      console.log('❌ Telegram API error, rolling back application creation');
      throw new Error(telegramResult.description || 'Telegram API error');
    }

  } catch (error) {
    console.error('💥 Error sending to Telegram:', error.message);
    res.status(500).json({ 
      error: 'Failed to send to Telegram',
      details: error.message
    });
  }
}
