export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    const image = req.files?.image; // если используете multer или аналогичный middleware

    // Ваш Telegram Bot Token и Chat ID
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID; // ID чата куда отправлять

    if (!botToken || !chatId) {
      return res.status(500).json({ error: 'Telegram configuration missing' });
    }

    let messageSent = false;

    // Если есть изображение
    if (image) {
      // Отправка изображения с подписью
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', image.data, {
        filename: image.name,
        contentType: image.mimetype
      });
      if (text) {
        formData.append('caption', text);
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      messageSent = response.ok;
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

      messageSent = response.ok;
    }

    if (messageSent) {
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to send message to Telegram' });
    }

  } catch (error) {
    console.error('Error sending to Telegram:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
