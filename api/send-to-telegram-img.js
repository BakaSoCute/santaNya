import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024,
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
      // Важно: всегда возвращаем JSON
      return res.status(200).json({ 
        success: false, 
        error: 'Telegram configuration missing' 
      });
    }

    let result;

    if (image) {
      // Отправка изображения
      const telegramFormData = new FormData();
      telegramFormData.append('chat_id', chatId);
      
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
      if (fs.existsSync(image.filepath)) {
        fs.unlinkSync(image.filepath);
      }

      if (response.ok) {
        result = { success: true, message: 'Изображение отправлено в Telegram!' };
      } else {
        const errorData = await response.json();
        result = { 
          success: false, 
          error: errorData.description || 'Ошибка отправки изображения' 
        };
      }
    } else if (text) {
      // Отправка только текста
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
        result = { success: true, message: 'Сообщение отправлено в Telegram!' };
      } else {
        const errorData = await response.json();
        result = { 
          success: false, 
          error: errorData.description || 'Ошибка отправки сообщения' 
        };
      }
    } else {
      result = { 
        success: false, 
        error: 'Необходимо указать текст или изображение' 
      };
    }

    // Всегда возвращаем JSON с правильной структурой
    res.status(200).json(result);

  } catch (error) {
    console.error('Error sending to Telegram:', error);
    
    // Всегда возвращаем JSON даже при ошибках
    res.status(200).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера: ' + error.message 
    });
  }
}
