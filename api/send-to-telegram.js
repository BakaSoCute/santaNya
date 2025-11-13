import { createApplication, debugRedis } from '../lib/vercel-redis-storage.js';

function escapeMarkdown(text) {
  if (!text) return '';
  
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let escapedText = String(text);
  
  specialChars.forEach(char => {
    escapedText = escapedText.split(char).join(`\\${char}`);
  });
  
  return escapedText;
}

function createSafeMessage(formData, applicationId) {
  const escapedFullName = escapeMarkdown(formData.fullName);
  const escapedContactInfo = escapeMarkdown(formData.contactInfo);

  
  const message = `🎁 *НОВАЯ ЗАЯВКА \\#${applicationId}*\n\n` +
    `👤 *Twitch ник:* ${escapedFullName || 'Не указан'}\n` +
    `📞 *Способ связи:* ${formData.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
    `💬 *Контакт:* ${escapedContactInfo || 'Не указан'}\n` +
    `📊 *Статус:* ⏳ Ожидание`;

  return message;
}



export default async function handler(req, res) {
  console.log('📨 Send to telegram called');
  const allowedOrigins = [
  'https://www.nyamuras-santa.ru',
  'http://localhost:5173'
];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
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

    await debugRedis();
    

    const application = await createApplication(formData);
    const applicationId = application.id;
    const message = createSafeMessage(formData, applicationId);

    console.log('📤 Sending to Telegram...');

    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'MarkdownV2',
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








