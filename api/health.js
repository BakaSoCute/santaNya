export default async function handler(req, res) {
  console.log('❤️ Health check called');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.nyamuras-santa.ru');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      cors: 'Enabled for https://www.nyamuras-santa.ru'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
