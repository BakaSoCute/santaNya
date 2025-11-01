export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    message: 'Santa Nya API Root 🎅🐱',
    status: 'working',
    endpoints: [
      'GET  /api/health',
      'POST /api/twitch-auth',
      'POST /api/send-to-telegram', 
      'GET  /api/application'
    ],
    timestamp: new Date().toISOString()
  });
}
