import { createApplication, debugRedis ,findApplicationByName  } from '../lib/vercel-redis-storage.js';
import { authenticate } from '../middleware/auth.js';
import Joi from 'joi';
import { ipRateLimit } from '../middleware/ipRateLimit.js';

function createApplicationSchema(twitchUsername = '') {
  return Joi.object({
    fullName: Joi.string()
      .valid(twitchUsername) // 
      .required()
      .messages({
        'any.only': `Имя должно совпадать с вашим Twitch ником: ${twitchUsername}`,
        'any.required': 'Укажите ваш Twitch ник'
      }),
    contactMethod: Joi.string()
      .valid('telegram', 'discord')
      .required()
      .messages({
        'any.only': 'Выберите способ связи: Telegram или Discord',
        'any.required': 'Укажите способ связи'
      }),
    contactInfo: Joi.string()
      .min(3)
      .max(100)
      .pattern(/^[a-zA-Z0-9_@.+-\s]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Некорректный формат контактных данных',
        'string.min': 'Контактные данные слишком короткие',
        'string.max': 'Контактные данные слишком длинные',
        'any.required': 'Укажите контактные данные'
      })
  });
}

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
  'https://www.nyamuras-santa.ru'
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
    const authError = await authenticate(req, res);
    if (authError) return authError;

    const applicationName = await findApplicationByName(req.user?.display_name);
    if (applicationName) {
      console.log(`Заявка от пользователя ${applicationName} уже существует`);
      return res.status(400).json({ error: 'Заявка от пользователя уже существует' });
    }

    
    const ipLimitError = ipRateLimit(req, res);
    if (ipLimitError) return ipLimitError;

    const username = req.user?.display_name || req.user?.login || '';
    const applicationSchema = createApplicationSchema(username);
    
    const { formData } = req.body;
    console.log(formData);
    const { error, value } = applicationSchema.validate(req.body.formData);
    console.log(value);
    if (error) {
      console.log('❌ Validation error');
      return res.status(400).json({ error: 'Invalid input data' });
    }
    
    // Используем ТОЛЬКО валидированные данные
    const safeFormData = value;
    
    if (!formData) {
      return res.status(400).json({ error: 'No form data provided' });
    }

    console.log('📨 Received Telegram request:', formData);

  
    

    const application = await createApplication(value);
    const applicationId = application.id;
    const message = createSafeMessage(safeFormData, applicationId);

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
      error: 'Failed to send to Telegram'
    });
  }
}




















