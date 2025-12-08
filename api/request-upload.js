import { authenticate } from '../middleware/auth.js';
import { ipRateLimit } from '../middleware/ipRateLimit.js';
import { updateApplicationStatusByGift,updateApplicationStatusByReview } from '../lib/vercel-redis-storage.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = ['https://www.nyamuras-santa.ru'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const getTargetChatId = (reqBody) => {
  // Если это отправка посылки (из формы отправки)
  if (reqBody.isShipping || reqBody.chatType === 'shipping') {
    return process.env.TELEGRAM_CHAT_ID; // Чат для отправок
  }
  
  return process.env.TELEGRAM_CHAT_ID_REVIEW;
};

  try {
    // ✅ 1. ПРОВЕРКА АУТЕНТИФИКАЦИИ
    const authError = await authenticate(req, res);
    if (authError) return authError;

    // ✅ 2. ПРОВЕРКА ЛИМИТОВ ЗАПРОСОВ
    const rateLimitError = await ipRateLimit(req, res);
    if (rateLimitError) return rateLimitError;

    const { filename, fileSize, fileType, text, name, contact, typeContact } = req.body;

    // ✅ 3. ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    if (!filename || !fileSize || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ 4. ПРОВЕРКА РАЗМЕРА ФАЙЛА
    const fileSizeMB = fileSize / 1024 / 1024;
    if (fileSizeMB > 500) {
      return res.status(413).json({ error: 'File too large (max 500MB)' });
    }

    // ✅ 5. ПРОВЕРКА ТИПА ФАЙЛА
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'text/plain'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(415).json({ error: 'Unsupported file type' });
    }

    // ✅ 6. ГЕНЕРАЦИЯ СЕССИИ И ТОКЕНОВ
    const sessionId = crypto.randomBytes(16).toString('hex');
    const oneTimeToken = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const expiresAt = timestamp + 5 * 60 * 1000; // 5 минут

    // ✅ 7. ФОРМИРОВАНИЕ СООБЩЕНИЯ ДЛЯ TELEGRAM
    let telegramMessage = '';
    if (name) telegramMessage += `👤 <b>Имя:</b> ${name}\n`;
    if (typeContact) telegramMessage += `📞 <b>Тип связи:</b> ${typeContact}\n`;
    if (contact) telegramMessage += `💬 <b>Контакт:</b> ${contact}\n`;
    if (text) telegramMessage += `\n📝 <b>Сообщение:</b>\n${text}`;
    const chatId =  await getTargetChatId(req.body);
    // ✅ 8. СОЗДАНИЕ СЕССИИ НА USERBOT СЕРВЕРЕ
    const userBotResponse = await fetch(`${process.env.USERBOT_SERVER_URL}/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BOT_API_KEY}`
      },
      body: JSON.stringify({
        sessionId,
        oneTimeToken,
        userId: req.user.id,
        chatId,
        filename,
        fileSize,
        caption: telegramMessage,
        expiresAt
      }),
    });
    if (userBotResponse.ok && req.body.chatType === 'shipping') {
      await updateApplicationStatusByGift(req.body.name,"succeses")
    }
    if (userBotResponse.ok && req.body.chatType === 'review') {
      await updateApplicationStatusByReview(req.body.name,"succeses")
    }

    if (!userBotResponse.ok) {
      const error = await userBotResponse.json();
      throw new Error(`UserBot server error: ${error.error}`);
    }


    // ✅ 9. ЛОГИРОВАНИЕ ДЛЯ АУДИТА
    console.log('Upload session created:', {
      sessionId,
      userId: req.user.id,
      filename,
      fileSize: `${fileSizeMB.toFixed(2)}MB`
    });

    // ✅ 10. ВОЗВРАЩАЕМ ДАННЫЕ ДЛЯ ЗАГРУЗКИ
    res.json({
      success: true,
      sessionId,
      oneTimeToken,
      uploadUrl: `${process.env.USERBOT_SERVER_URL}/upload-album`, 
      userId: req.user.id,
      timestamp,
      expiresIn: '5 minutes'
    });

  } catch (error) {
    console.error('Upload request error:', error);
    res.status(500).json({ error: error.message });
  }
}
