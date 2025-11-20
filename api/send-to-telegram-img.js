import { authenticate } from '../middleware/auth.js';
import FormData from 'form-data';
import { Readable } from 'stream';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

function setCORSHeaders(req, res) {
  const allowedOrigins = [
    'https://www.nyamuras-santa.ru',
    'https://nyamuras-santa.ru'
  ];
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authError = await authenticate(req, res);
    if (authError) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return res.status(200).json({ success: false, error: 'Telegram configuration missing' });
    }

    const busboy = Busboy({ headers: req.headers });
    
    let text = '';
    let name = '';
    let typeContact = '';
    let contact = '';
    let imageBuffer = null;
    let imageInfo = null;

    return new Promise((resolve) => {
      busboy.on('field', (fieldname, val) => {
        console.log('📝 Field:', fieldname, val);
        
        switch (fieldname) {
          case 'text':
            text = val;
            break;
          case 'name':
            name = val;
            break;
          case 'type contact':
            typeContact = val;
            break;
          case 'contact':
            contact = val;
            break;
        }
      });

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (fieldname === 'image') {
          console.log('📸 Processing image:', filename);
          const chunks = [];
          imageInfo = { filename, mimetype };
          
          file.on('data', (chunk) => {
            chunks.push(chunk);
          });

          file.on('end', () => {
            imageBuffer = Buffer.concat(chunks);
            console.log('✅ Image loaded:', imageBuffer.length, 'bytes');
          });
        } else {
          file.resume();
        }
      });

      busboy.on('finish', async () => {
        try {
          console.log('📤 All data received:', {
            text,
            name,
            typeContact,
            contact,
            hasImage: !!imageBuffer,
            imageSize: imageBuffer?.length
          });

          let telegramMessage = '';
          
          if (name) telegramMessage += `👤 <b>Имя:</b> ${name}\n`;
          if (typeContact) telegramMessage += `📞 <b>Тип связи:</b> ${typeContact}\n`;
          if (contact) telegramMessage += `💬 <b>Контакт:</b> ${contact}\n`;
          if (text) telegramMessage += `\n📝 <b>Сообщение:</b>\n${text}`;

          let result;

          if (imageBuffer) {
            try {
              console.log('📨 Sending image to Telegram...');
              
              // ✅ Упрощенный подход с использованием Buffer напрямую
              const form = new FormData();
              form.append('chat_id', chatId);
              form.append('photo', imageBuffer, {
                filename: imageInfo.filename || 'image.jpg',
                contentType: imageInfo.mimetype
              });
              
              if (telegramMessage) {
                form.append('caption', telegramMessage);
                form.append('parse_mode', 'HTML');
              }

              const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
              });

              // ✅ Безопасный парсинг JSON
              let telegramResult;
              try {
                const responseText = await telegramResponse.text();
                console.log('📬 Telegram raw response:', responseText);
                
                if (responseText.trim() === '') {
                  telegramResult = { ok: false, description: 'Empty response from Telegram' };
                } else {
                  telegramResult = JSON.parse(responseText);
                }
              } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                telegramResult = { ok: false, description: 'Invalid JSON response' };
              }

              console.log('📬 Telegram parsed response:', telegramResult);

              if (telegramResponse.ok && telegramResult.ok) {
                result = { 
                  success: true, 
                  message: '✅ Данные и изображение отправлены в Telegram!' 
                };
              } else {
                result = { 
                  success: false, 
                  error: telegramResult.description || `HTTP ${telegramResponse.status}` 
                };
              }

            } catch (fetchError) {
              console.error('❌ Fetch error:', fetchError);
              result = { 
                success: false, 
                error: 'Network error: ' + fetchError.message 
              };
            }

          } else if (telegramMessage) {
            try {
              const params = new URLSearchParams();
              params.append('chat_id', chatId);
              params.append('text', telegramMessage);
              params.append('parse_mode', 'HTML');

              console.log('📨 Sending text to Telegram...');
              const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
              });

              // ✅ Безопасный парсинг для текстовых сообщений
              let telegramResult;
              try {
                const responseText = await telegramResponse.text();
                telegramResult = responseText ? JSON.parse(responseText) : { ok: false };
              } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                telegramResult = { ok: false, description: 'Invalid JSON response' };
              }

              console.log('📬 Telegram response:', telegramResult);

              if (telegramResponse.ok && telegramResult.ok) {
                result = { 
                  success: true, 
                  message: '✅ Данные отправлены в Telegram!' 
                };
              } else {
                result = { 
                  success: false, 
                  error: telegramResult.description || 'Ошибка отправки сообщения' 
                };
              }

            } catch (fetchError) {
              console.error('❌ Fetch error:', fetchError);
              result = { 
                success: false, 
                error: 'Network error: ' + fetchError.message 
              };
            }

          } else {
            result = { 
              success: false, 
              error: 'Необходимо указать данные для отправки' 
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
