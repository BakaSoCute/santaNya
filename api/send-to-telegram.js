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


async function addToRedisQueue(formData, applicationId, message) {
  const queueItem = {
    formData,
    applicationId,
    message,
    timestamp: Date.now(),
    attempts: 0
  };

  await redis.rpush('telegram_queue', JSON.stringify(queueItem));
  console.log(`📥 Added message #${applicationId} to Redis queue`);


  await processQueueIfNeeded();
}


async function processQueue() {
  const queueLength = await redis.llen('telegram_queue');
  
  if (queueLength === 0) {
    console.log('📭 Queue is empty');
    return;
  }

  console.log(`📦 Processing queue with ${queueLength} messages`);


  const messagesToProcess = [];
  for (let i = 0; i < Math.min(BATCH_SIZE, queueLength); i++) {
    const item = await redis.lpop('telegram_queue');
    if (item) {
      messagesToProcess.push(JSON.parse(item));
    }
  }

  if (messagesToProcess.length === 0) return;

  try {

    if (messagesToProcess.length > 1) {
      const batchNotification = `📦 *ПОЛУЧЕН ПАКЕТ ИЗ ${messagesToProcess.length} ЗАЯВОК*\n\n` +
                               `⏰ *Время \\(МСК\\):* ${escapeMarkdown(getMoscowTime())}\n` +
                               `📋 *Заявки будут обработаны по очереди*\n\n` +
                               `────────────────────`;
      
      await sendTelegramMessage(
        process.env.TELEGRAM_CHAT_ID,
        batchNotification,
        null
      );
    }


    for (let i = 0; i < messagesToProcess.length; i++) {
      const item = messagesToProcess[i];
      const replyMarkup = createReplyMarkup(item.applicationId);
      
      await sendTelegramMessage(
        process.env.TELEGRAM_CHAT_ID,
        item.message,
        replyMarkup
      );


      if (i < messagesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, MESSAGE_INTERVAL));
      }
    }

    console.log(`✅ Successfully processed ${messagesToProcess.length} messages`);
  } catch (error) {
    console.error('💥 Error processing queue:', error);
    

    for (const item of messagesToProcess) {
      item.attempts = (item.attempts || 0) + 1;
      if (item.attempts < 3) { 
        await redis.rpush('telegram_queue', JSON.stringify(item));
      } else {
        console.error(`❌ Message #${item.applicationId} failed after 3 attempts`);
      }
    }
  }

 
  const remaining = await redis.llen('telegram_queue');
  if (remaining > 0) {
    console.log(`🔄 Continuing queue processing, ${remaining} messages left`);
    await processQueue();
  }
}


async function processQueueIfNeeded() {
  const isProcessing = await redis.get('queue_processing');
  
  if (!isProcessing) {
    await redis.setex('queue_processing', 60, 'true'); 
    
    try {
      await processQueue();
    } finally {
      await redis.del('queue_processing');
    }
  }
}


export async function queueHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await processQueue();
    res.json({ success: true, message: 'Queue processed' });
  } catch (error) {
    console.error('Error in queue handler:', error);
    res.status(500).json({ error: 'Queue processing failed' });
  }
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

  
    await addToRedisQueue(formData, applicationId, message);

    
    res.json({ 
      success: true,
      applicationId: applicationId,
      message: 'Заявка принята в обработку и скоро будет отправлена'
    });

  } catch (error) {
    console.error('💥 Error processing application:', error.message);
    res.status(500).json({ 
      error: 'Failed to process application',
      details: error.message
    });
  }
}

