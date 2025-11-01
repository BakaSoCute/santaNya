import { getApplication, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('🔧 Debug application endpoint called');
  
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const id = searchParams.get('id');
    
    if (!id) {
      return res.json({
        error: 'Missing id parameter',
        usage: '/api/debug-application?id=1'
      });
    }
    
    console.log(`🔍 Debugging application ${id}...`);
    
    // Получаем заявку
    const application = await getApplication(id);
    console.log(`📄 Application ${id}:`, application);
    
    // Диагностика Redis
    const redisInfo = await debugRedis();
    
    res.json({
      success: true,
      application: application,
      exists: !!application,
      redis_info: redisInfo,
      debug: {
        application_id: id,
        timestamp: new Date().toISOString(),
        redis_connected: true
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
