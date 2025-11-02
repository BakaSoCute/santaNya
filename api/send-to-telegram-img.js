// /api/send-to-telegram-img.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Определяем тип контента
    const contentType = req.headers['content-type'] || '';

    let text = '';
    let hasImage = false;

    if (contentType.includes('multipart/form-data')) {
      // Для FormData - используем упрощенную обработку
      // В реальном приложении можно использовать busboy или аналоги
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Простая проверка - если есть FormData, считаем что есть изображение
      hasImage = buffer.includes('image');
      
      // Извлекаем текст из FormData (упрощенно)
      const textMatch = buffer.toString().match(/name="text"\r\n\r\n([^\r\n]*)/);
      text = textMatch ? textMatch[1] : '';
      
      console.log('📤 FormData detected:', { text, hasImage });
    } else {
      // Для JSON
      const body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      });
      text = body.text || '';
      hasImage = false;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!text && !hasImage) {
      return res.status(200).json({ success: false, error: 'No content provided' });
    }

    if (!botToken || !chatId) {
      return res.status(200).json({ success: false, error: 'Telegram configuration missing' });
    }

    // Формируем сообщение для Telegram
    let telegramText = '';
    
    if (hasImage && text) {
      telegramText = `📸 Изображение + текст:\n${text}`;
    } else if (hasImage) {
      telegramText = '📸 Пользователь отправил изображение';
    } else if (text) {
      telegramText = text;
    }

    console.log('📨 Sending to Telegram:', telegramText);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramText,
        parse_mode: 'HTML'
      })
    });

    if (response.ok) {
      const message = hasImage 
        ? '✅ Уведомление об изображении отправлено!' 
        : '✅ Сообщение отправлено в Telegram!';
      res.status(200).json({ success: true, message });
    } else {
      const errorData = await response.json();
      res.status(200).json({ success: false, error: errorData.description || 'Ошибка отправки' });
    }

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(200).json({ success: false, error: 'Internal server error: ' + error.message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
