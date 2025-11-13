import { createApplication, debugRedis, redis } from '../lib/vercel-redis-storage.js';


let messageBatch = [];
let isProcessing = false;
const BATCH_SIZE = 5;
const BATCH_DELAY = 10000; 
const MESSAGE_INTERVAL = 2000; 

function escapeMarkdown(text) {
  if (!text) return '';
  
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let escapedText = String(text);
  
  specialChars.forEach(char => {
    escapedText = escapedText.split(char).join(`\\${char}`);
  });
  
  return escapedText;
}


function getMoscowTime() {
  const now = new Date();
  const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return moscowTime.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function createSafeMessage(formData, applicationId) {
  const escapedFullName = escapeMarkdown(formData.fullName);
  const escapedContactInfo = escapeMarkdown(formData.contactInfo);
  
  const message = `🎁 *НОВАЯ ЗАЯВКА \\#${applicationId}*\n\n` +
    `👤 *Twitch ник:* ${escapedFullName || 'Не указан'}\n` +
    `📞 *Способ связи:* ${formData.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
    `💬 *Контакт:* ${escapedContactInfo || 'Не указан'}\n` +
    `⏰ *Время \\(МСК\\):* ${escapeMarkdown(getMoscowTime())}\n` +
    `📊 *Статус:* ⏳ Ожидание`;

  return message;
}
function createReplyMarkup(applicationId) {
  return {
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
  };
}

// Функция отправки сообщения
async function sendTelegramMessage(chatId, text, replyMarkup) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'MarkdownV2'
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  console.log(`📤 Sending message to Telegram...`);
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Telegram API error:', error);
    throw new Error(error.description || 'Telegram API error');
  }

  return await response.json();
}

// Быстрая обработка одного сообщения (без задержек в основном потоке)
async function processSingleMessage() {
  try {
    const queueLength = await redis.llen('telegram_queue');
    if (queueLength === 0) return;

    // Берем одно сообщение из очереди
    const item = await redis.lpop('telegram_queue');
    if (!item) return;

    const messageData = JSON.parse(item);
    const replyMarkup = createReplyMarkup(messageData.applicationId);
    
    console.log(`📤 Sending single message #${messageData.applicationId}`);
    await sendTelegramMessage(
      process.env.TELEGRAM_CHAT_ID,
      messageData.message,
      replyMarkup
    );
    
    console.log(`✅ Successfully sent message #${messageData.applicationId}`);
  } catch (error) {
    console.error('💥 Error processing single message:', error);
  }
}

// Добавление сообщения в Redis очередь
async function addToRedisQueue(formData, applicationId, message) {
  const queueItem = {
    formData,
    applicationId,
    message,
    timestamp: Date.now(),
    attempts: 0
  };

  await redis.rpush('telegram_queue', JSON.stringify(queueItem));
  const queueLength = await redis.llen('telegram_queue');
  console.log(`📥 Added message #${applicationId} to Redis queue. Queue size: ${queueLength}`);

  return queueLength;
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

    console.log('📤 Adding to Redis queue...');

    // Добавляем в Redis очередь
    const queueLength = await addToRedisQueue(formData, applicationId, message);

    // Немедленно отвечаем пользователю (не ждем отправки в Telegram)
    res.json({ 
      success: true,
      applicationId: applicationId,
      message: 'Заявка принята в обработку и скоро будет отправлена',
      queuePosition: queueLength
    });

    // Запускаем фоновую обработку (не блокируем ответ)
    processSingleMessage().catch(console.error);

  } catch (error) {
    console.error('💥 Error processing application:', error.message);
    res.status(500).json({ 
      error: 'Failed to process application',
      details: error.message
    });
  }
}


