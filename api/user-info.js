import axios from 'axios';

export default async function handler(req, res) {
  const allowedOrigins = [
    'https://www.nyamuras-santa.ru',
    'http://localhost:5173' // для разработки
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.cookies.twitch_access_token;
    
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    // Получаем информацию о пользователе из Twitch
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });

    const userData = userResponse.data.data[0];
    
    return res.json({
      id: userData.id,
      login: userData.login,
      display_name: userData.display_name,
      profile_image_url: userData.profile_image_url,
      email: userData.email
    });

  } catch (error) {
    console.error('User info error:', error.message);
    return res.status(500).json({ error: 'Failed to get user info' });
  }
}
