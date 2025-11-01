export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookUrl = `https://${req.headers.host}/api/telegram-webhook`;
    console.log('Setting up webhook:', webhookUrl);

    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const result = await response.json();
    
    console.log('Webhook setup result:', result);
    
    if (result.ok) {
      res.json({ 
        success: true, 
        message: 'Webhook configured successfully',
        webhookUrl: webhookUrl,
        result: result 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.description 
      });
    }
    
  } catch (error) {
    console.error('Error setting webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to setup webhook',
      details: error.message 
    });
  }
}
