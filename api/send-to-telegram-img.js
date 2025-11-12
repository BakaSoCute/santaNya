
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {

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

          if (imageBuffer) {

            const formData = new FormData();
            formData.append('chat_id', chatId);
            
 
            const blob = new Blob([imageBuffer], { type: imageInfo.mimetype });
            formData.append('photo', blob, imageInfo.filename);
            
            if (telegramMessage) {
              formData.append('caption', telegramMessage);
              formData.append('parse_mode', 'HTML');
            }

            console.log('📨 Sending image to Telegram...');
            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST',
              body: formData
            });

            const telegramResult = await telegramResponse.json();
            console.log('📬 Telegram response:', telegramResult);

            if (telegramResponse.ok) {
              result = { 
                success: true, 
                message: '✅ Данные и изображение отправлены в Telegram!' 
              };
            } else {
              result = { 
                success: false, 
                error: telegramResult.description || 'Ошибка отправки изображения' 
              };
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
