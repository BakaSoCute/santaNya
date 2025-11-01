export default async function handler(req, res) {
  console.log('📁 Debug structure endpoint called');
  
  const endpoints = [
    '/api/health',
    '/api/test-vercel-redis', 
    '/api/simple-redis-test',
    '/api/send-to-telegram',
    '/api/application',
    '/api/twitch-auth'
  ];

  res.json({
    success: true,
    message: 'Debug structure information',
    available_endpoints: endpoints,
    environment: {
      node_env: process.env.NODE_ENV,
      has_redis: !!(process.env.KV_REST_API_URL || process.env.REDIS_URL)
    },
    timestamp: new Date().toISOString()
  });
}
