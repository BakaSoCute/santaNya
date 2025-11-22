import { authenticate } from '../middleware/auth.js';
import { ipRateLimit } from '../middleware/ipRateLimit.js';

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = ['https://www.nyamuras-santa.ru', 'https://nyamuras-santa.ru'];
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

  try {
    // ✅ 1. ПРОВЕРКА АУТЕНТИФИКАЦИИ
    const authError = await authenticate(req, res);
    if (authError) return authError;

    // ✅ 2. ПРОВЕРКА ЛИМИТОВ ЗАПРОСОВ
    const rateLimitError = await ipRateLimit(req, res);
    if (rateLimitError) return rateLimitError;

    const { text, chatType } = req.body;

    // ✅ 3. ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Текст сообщения не может быть пустым' });
    }

    // ✅ 4. ОПРЕДЕЛЕНИЕ ЧАТА
    const getTargetChatId = () => {
      if (chatType === 'review') {
        return process.env.TELEGRAM_CHAT_ID_REVIEW;
      }
      // По умолчанию используем основной чат
      return process.env.TELEGRAM_CHAT_ID;
    };

    const chatId = getTargetChatId();

    if (!chatId) {
      return res.status(500).json({ error: 'Chat ID не настроен на сервере' });
    }

    // ✅ 5. ОТПРАВКА ТЕКСТА ЧЕРЕЗ USERBOT СЕРВЕР
    console.log('📤 Sending text message to UserBot server...', {
      chatId: chatId,
      textLength: text.length,
      chatType: chatType || 'not specified'
    });

    const userBotResponse = await fetch(`${process.env.USERBOT_SERVER_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BOT_API_KEY}`
      },
      body: JSON.stringify({
        chatId: chatId,
        text: text
      }),
    });

    if (!userBotResponse.ok) {
      let errorMessage = 'Ошибка UserBot сервера';
      try {
        const errorData = await userBotResponse.json();
        errorMessage = errorData.detail || errorData.error || errorMessage;
      } catch (e) {
        // Если не удается распарсить JSON, используем статус текст
        errorMessage = `HTTP ${userBotResponse.status}: ${userBotResponse.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const result = await userBotResponse.json();

    // ✅ 6. ЛОГИРОВАНИЕ ДЛЯ АУДИТА
    console.log('✅ Text message sent successfully:', {
      chatId: chatId,
      textLength: text.length,
      messageId: result.messageId
    });

    res.json({
      success: true,
      message: "Текстовое сообщение отправлено успешно",
      messageId: result.messageId
    });

  } catch (error) {
    console.error('💥 Send text message error:', error);
    
    // Определяем статус код по типу ошибки
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (error.message.includes('не настроен') || error.message.includes('не может быть пустым')) {
      statusCode = 400;
    } else if (error.message.includes('Missing chatId') || error.message.includes('Missing text')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage
    });
  }
}
