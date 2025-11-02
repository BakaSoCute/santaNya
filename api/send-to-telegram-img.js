// Для Pages Router: /pages/api/send-to-telegram-img.js
// Для App Router: /app/api/send-to-telegram-img/route.js

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!text) {
      return res.status(200).json({ success: false, error: 'No text provided' });
    }

    if (!botToken || !chatId) {
      return res.status(200).json({ success: false, error: 'Telegram configuration missing' });
    }

    console.log('📤 Sending to Telegram:', { text, botToken: botToken ? 'exists' : 'missing', chatId });

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        img: image,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Telegram response:', result);
      res.status(200).json({ success: true, message: 'Сообщение отправлено в Telegram!' });
    } else {
      console.error('❌ Telegram error:', result);
      res.status(200).json({ success: false, error: result.description || 'Ошибка отправки в Telegram' });
    }

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(200).json({ success: false, error: 'Internal server error: ' + error.message });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
