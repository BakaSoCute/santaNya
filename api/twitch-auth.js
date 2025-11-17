import axios from 'axios';

export default async function handler(req, res) {
  console.log('🔐 Twitch auth called');
  
  const allowedOrigins = [
    'https://www.nyamuras-santa.ru'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, code_verifier } = req.body;

    if (!code || !code_verifier) {
      return res.status(400).json({ error: 'Missing authorization data' });
    }

    console.log('🔐 Processing Twitch auth request');

    const tokenResponse = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      null,
      {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.TWITCH_REDIRECT_URI,
          code_verifier: code_verifier
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        validateStatus: (status) => status >= 200 && status < 500
      }
    );

    console.log('📊 Twitch token response status:', tokenResponse.status);

    if (tokenResponse.data && tokenResponse.data.access_token) {
      console.log('✅ Twitch token received successfully');
      
      const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${tokenResponse.data.access_token}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID
        }
      });

      const userData = userResponse.data.data[0];
      console.log('✅ User data received:', userData.display_name);
      const cookies = [
        // Основная кука для большинства браузеров
        `twitch_access_token=${tokenResponse.data.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
        // Дополнительная кука для старых браузеров
        `twitch_token=${tokenResponse.data.access_token}; HttpOnly; Secure; Path=/; Max-Age=604800`
      ];
      //`twitch_access_token=${tokenResponse.data.access_token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`
      res.setHeader('Set-Cookie', cookies);

      return res.json({
        user: {
          id: userData.id,
          login: userData.login,
          display_name: userData.display_name,
          profile_image_url: userData.profile_image_url,
          email: userData.email
        }
      });
    }

    console.error('❌ No access token in response:', tokenResponse.data);
    return res.status(400).json({ 
      error: 'Failed to get access token',
      details: tokenResponse.data
    });

  } catch (error) {
    console.error('💥 Twitch auth error:', error.message);
    return res.status(500).json({ 
      error: 'Server error during authentication',
      details: error.message
    });
  }
}








