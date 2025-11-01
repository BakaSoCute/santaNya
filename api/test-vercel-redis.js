export default async function handler(req, res) {
  console.log('🧪 Vercel Redis test endpoint called');
  
  try {
    // Сначала проверим базовую работу
    const basicCheck = {
      node_env: process.env.NODE_ENV,
      has_kv_url: !!process.env.KV_REST_API_URL,
      has_redis_url: !!process.env.REDIS_URL,
      timestamp: new Date().toISOString()
    };

    console.log('🔍 Basic environment check:', basicCheck);

    // Если нет Redis URL, вернем информацию об этом
    if (!process.env.KV_REST_API_URL && !process.env.REDIS_URL) {
      return res.json({
        success: false,
        message: 'Redis URL not found in environment variables',
        environment: basicCheck,
        next_steps: [
          'Check Vercel Dashboard → Settings → Environment Variables',
          'Make sure Redis integration is properly connected',
          'Look for KV_REST_API_URL or REDIS_URL variables'
        ]
      });
    }

    // Попробуем импортировать Redis storage
    console.log('🔧 Attempting to import Redis storage...');
    const { debugRedis } = await import('../lib/vercel-redis-storage.js');
    
    console.log('🔧 Testing Redis connection...');
    const redisInfo = await debugRedis();

    res.json({
      success: true,
      message: 'Vercel Redis test completed',
      basic_environment: basicCheck,
      redis_info: redisInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Vercel Redis test error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        kv_url: process.env.KV_REST_API_URL ? 'Set' : 'Not set',
        redis_url: process.env.REDIS_URL ? 'Set' : 'Not set',
        node_env: process.env.NODE_ENV
      },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
