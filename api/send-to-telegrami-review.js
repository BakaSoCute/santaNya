import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
const allowedOrigins = [
  'https://www.nyamuras-santa.ru',
  'http://localhost:5173'
];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN_REVIEW;
    const chatId = process.env.TELEGRAM_CHAT_ID_REVIEW;

    if (!botToken || !chatId) {
      return res.status(200).json({ success: false, error: 'Telegram configuration missing' });
    }

    const busboy = Busboy({ headers: req.headers });
    
    let text = '';
    let name = '';
    let typeContact = '';
    let contact = '';
    let mediaBuffer = null;
    let mediaInfo = null;
    let mediaType = '';

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
          case 'mediaType':
            mediaType = val;
            break;
        }
      });

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (fieldname === 'media') {
          console.log('📸 Processing media:', filename, 'type:', mimetype);
          const chunks = [];
          mediaInfo = { filename, mimetype };
          
         
          if (!mediaType) {
            mediaType = mimetype.startsWith('video/') ? 'video' : 'image';
          }
          
          file.on('data', (chunk) => {
            chunks.push(chunk);
          });

          file.on('end', () => {
            mediaBuffer = Buffer.concat(chunks);
            console.log('✅ Media loaded:', mediaBuffer.length, 'bytes, type:', mediaType);
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
            hasMedia: !!mediaBuffer,
            mediaType,
            mediaSize: mediaBuffer?.length
          });

          let telegramMessage = '';
          
          if (name) {
            telegramMessage += `👤 <b>Имя:</b> ${name}\n`;
          }
          
          if (typeContact) {
            telegramMessage += `📞 <b>Тип связи:</b> ${typeContact}\n`;
          }
          
          if (contact) {
            telegramMessage += `💬 <b>Контакт:</b> ${contact}\n`;
          }
          
          if (text) {
            telegramMessage += `\n📝 <b>Сообщение:</b>\n${text}`;
          }

          let result;

          
          if (mediaBuffer && mediaType) {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            
            const blob = new Blob([mediaBuffer], { type: mediaInfo.mimetype });
            
            
            const method = mediaType === 'video' ? 'sendVideo' : 'sendPhoto';
            const fieldName = mediaType === 'video' ? 'video' : 'photo';
            
            formData.append(fieldName, blob, mediaInfo.filename);
            
            if (telegramMessage) {
              formData.append('caption', telegramMessage);
              formData.append('parse_mode', 'HTML');
            }

            
            if (mediaType === 'video') {
              formData.append('supports_streaming', 'true');
            }

            console.log(`📨 Sending ${mediaType} to Telegram via ${method}...`);
            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
              method: 'POST',
              body: formData
            });

            const telegramResult = await telegramResponse.json();
            console.log('📬 Telegram response:', telegramResult);

            if (telegramResponse.ok) {
              result = { 
                success: true, 
                message: `✅ Данные и ${mediaType === 'video' ? 'видео' : 'изображение'} отправлены в Telegram!` 
              };
            } else {
              
              console.log('🔄 Trying to send as document...');
              const documentFormData = new FormData();
              documentFormData.append('chat_id', chatId);
              documentFormData.append('document', blob, mediaInfo.filename);
              
              if (telegramMessage) {
                documentFormData.append('caption', telegramMessage);
                documentFormData.append('parse_mode', 'HTML');
              }

              const documentResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                method: 'POST',
                body: documentFormData
              });

              const documentResult = await documentResponse.json();
              
              if (documentResponse.ok) {
                result = { 
                  success: true, 
                  message: '✅ Данные и файл отправлены в Telegram!' 
                };
              } else {
                result = { 
                  success: false, 
                  error: telegramResult.description || documentResult.description || `Ошибка отправки ${mediaType === 'video' ? 'видео' : 'изображения'}` 
                };
              }
            }
          } else if (telegramMessage) {
            
            console.log('📨 Sending text to Telegram...');
            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: telegramMessage,
                parse_mode: 'HTML'
              })
            });

            const telegramResult = await telegramResponse.json();
            console.log('📬 Telegram response:', telegramResult);

            if (telegramResponse.ok) {
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
