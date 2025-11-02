// /api/send-to-telegram-img.js
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false, // Отключаем встроенный парсер для FormData
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Парсим FormData
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const text = fields.text ? fields.text[0] : '';
    const image = files.image ? files.image[0] : null;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return res.status(200).json({ success: false, error: 'Telegram configuration missing' });
    }

    console.log('📤 Processing:', { text, hasImage: !!image });

    let result;

    if (image) {
      // Отправка изображения в Telegram
      const telegramFormData = new FormData();
      telegramFormData.append('chat_id', chatId);
      telegramFormData.append('photo', fs.createReadStream(image.filepath));
      
      if (text) {
        telegramFormData.append('caption', text);
      }

      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: telegramFormData
      });

      // Удаляем временный файл
      if (fs.existsSync(image.filepath)) {
        fs.unlinkSync(image.filepath);
      }

      if (telegramResponse.ok) {
        result = { success: true, message: 'Изображение отправлено в Telegram!' };
      } else {
        const errorData = await telegramResponse.json();
        result = { success: false, error: errorData.description || 'Ошибка отправки изображения' };
      }
    } else if (text) {
      // Отправка только текста
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });

      if (telegramResponse.ok) {
        result = { success: true, message: 'Сообщение отправлено в Telegram!' };
      } else {
        const errorData = await telegramResponse.json();
        result = { success: false, error: errorData.description || 'Ошибка отправки сообщения' };
      }
    } else {
      result = { success: false, error: 'Необходимо указать текст или изображение' };
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(200).json({ success: false, error: 'Internal server error: ' + error.message });
  }
}
