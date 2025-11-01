export default async function handler(req, res) {
  console.log('🔧 Checking Telegram webhook configuration...');
  
  try {
    // Проверяем текущую настройку webhook
    const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const webhookInfo = await webhookInfoResponse.json();
    
    console.log('📱 Telegram Webhook Info:', webhookInfo);
    
    // Настраиваем webhook если нужно
    const webhookUrl = `https://${req.headers.host}/api/telegram-webhook`;
    console.log('🔗 Setting webhook to:', webhookUrl);
    
    const setWebhookResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl
      }),
    });
    
    const setWebhookResult = await setWebhookResponse.json();
    
    console.log('⚙️ Webhook setup result:', setWebhookResult);
    
    res.json({
      success: true,
      webhook_info: webhookInfo,
      setup_result: setWebhookResult,
      webhook_url: webhookUrl,
      environment: {
        has_bot_token: !!process.env.TELEGRAM_BOT_TOKEN,
        has_chat_id: !!process.env.TELEGRAM_CHAT_ID
      }
    });
    
  } catch (error) {
    console.error('❌ Webhook check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
