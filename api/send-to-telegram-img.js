// /api/send-to-telegram-img.js
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return res.status(200).json({ success: false, error: 'Telegram configuration missing' });
    }

    // Парсим FormData с помощью busboy
    const busboy = Busboy({ headers: req.headers });
    
    let text = '';
    let imageBuffer = null;
    let imageInfo = null;

    return new Promise((resolve) => {
      busboy.on('field', (fieldname, val) => {
        if (fieldname === 'text') {
          text = val;
        }
      });

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (fieldname === 'image') {
          const chunks = [];
          imageInfo = { filename, mimetype };
          
          file.on('data', (chunk) => {
            chunks.push(chunk);
          });

          file.on('end', () => {
            imageBuffer = Buffer.concat(chunks);
          });
        } else {
          file.resume(); // Игнорируем другие файлы
        }
      });

      busboy.on('finish', async () => {
        try {
          console.log('📤 Processing:', { 
            text, 
            hasImage: !!imageBuffer,
            imageSize: imageBuffer?.length 
          });

          let result;

          if (imageBuffer) {
            // Отправка изображения в Telegram
            const formData = new FormData();
            
            // Создаем Blob из buffer
            const blob = new Blob([imageBuffer], { type: imageInfo.mimetype });
            formData.append('chat_id', chatId);
            formData.append('photo', blob, imageInfo.filename);
            
            if (text) {
              formData.append('caption', text);
            }

            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST',
              body: formData
            });

            if (telegramResponse.ok) {
              result = { 
                success: true, 
                message: '✅ Изображение и текст отправлены в Telegram!' 
              };
            } else {
              const errorData = await telegramResponse.json();
              result = { 
                success: false, 
                error: errorData.description || 'Ошибка отправки изображения' 
              };
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
              result = { 
                success: true, 
                message: '✅ Текст отправлен в Telegram!' 
              };
            } else {
              const errorData = await telegramResponse.json();
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

          res.status(200).json(result);
          resolve();

        } catch (error) {
          console.error('💥 Processing error:', error);
          res.status(200).json({ 
            success: false, 
            error: 'Processing error: ' + error.message 
          });
          resolve();
        }
      });

      busboy.on('error', (error) => {
        console.error('💥 Busboy error:', error);
        res.status(200).json({ 
          success: false, 
          error: 'Form data error: ' + error.message 
        });
        resolve();
      });

      // Передаем запрос в busboy
      req.pipe(busboy);
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(200).json({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    });
  }
}
