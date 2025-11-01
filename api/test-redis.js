import { debugRedis } from '../lib/upstash-storage.js';

export default async function handler(req, res) {
  try {
    const debugInfo = await debugRedis();
    
    res.json({
      success: true,
      message: 'Redis test successful',
      environment: {
        has_redis_url: !!process.env.UPSTASH_REDIS_REST_URL,
        has_redis_token: !!process.env.UPSTASH_REDIS_REST_TOKEN
      },
      redis_info: debugInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        redis_url: process.env.UPSTASH_REDIS_REST_URL,
        redis_token: process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Not set'
      }
    });
  }
}
