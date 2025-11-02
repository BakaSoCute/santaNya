import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Отключаем встроенный парсер для FormData
  },
};

export default async function handler(req, res) {
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

    // Ваш Telegram Bot Token и Chat ID
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return res.status(500).json({ error: 'Telegram configuration missing' });
    }

    let messageSent = false;

    // Если есть изображение
    if (image) {
      // Создаем FormData для Telegram API
      const telegramFormData = new FormData();
      telegramFormData.append('chat_id', chatId);
      
      // Добавляем файл как blob
      const fileBuffer = fs.readFileSync(image.filepath);
      const blob = new Blob([fileBuffer], { type: image.mimetype });
      telegramFormData.append('photo', blob, image.originalFilename);
      
      if (text) {
        telegramFormData.append('caption', text);
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: telegramFormData
      });

      // Удаляем временный файл
      fs.unlinkSync(image.filepath);

      if (response.ok) {
        messageSent = true;
      } else {
        const errorText = await response.text();
        console.error('Telegram API error:', errorText);
      }
    } 
    // Если только текст
    else if (text) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });

      if (response.ok) {
        messageSent = true;
      } else {
        const errorText = await response.text();
        console.error('Telegram API error:', errorText);
      }
    } else {
      return res.status(400).json({ error: 'No text or image provided' });
    }

    if (messageSent) {
      res.status(200).json({ success: true, message: 'Message sent to Telegram' });
    } else {
      res.status(500).json({ error: 'Failed to send message to Telegram' });
    }

  } catch (error) {
    console.error('Error sending to Telegram:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
