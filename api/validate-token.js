import axios from 'axios';

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'https://www.nyamuras-santa.ru'
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
    // Получаем токен из куки - разные способы
    const token = req.cookies?.twitch_access_token || 
                  parseCookie(req.headers.cookie)?.twitch_access_token;

    console.log('🔐 Token validation request:', { 
      hasToken: !!token,
      tokenLength: token?.length,
      allCookies: Object.keys(req.cookies || {}),
      cookieHeader: req.headers.cookie ? 'present' : 'missing'
    });

    if (!token) {
      console.log('❌ No token in cookies');
      return res.json({ valid: false, reason: 'No token' });
    }

    console.log('🔄 Validating token with Twitch API...');

    const validationResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000,
      validateStatus: (status) => status >= 200 && status < 500
    });

    console.log('📊 Twitch validation response status:', validationResponse.status);

    if (validationResponse.status === 200) {
      console.log('✅ Token valid for user:', validationResponse.data.login);
      return res.json({ 
        valid: true,
        user: {
          login: validationResponse.data.login,
          user_id: validationResponse.data.user_id,
          display_name: validationResponse.data.login
        }
      });
    } else {
      console.log('❌ Token invalid, status:', validationResponse.status);
      return res.json({ 
        valid: false, 
        reason: `Token validation failed: ${validationResponse.status}` 
      });
    }

  } catch (error) {
    console.error('💥 Token validation error:', error.message);
    return res.json({ 
      valid: false, 
      reason: 'Validation error: ' + error.message 
    });
  }
}

// Вспомогательная функция для парсинга куки
function parseCookie(cookieHeader) {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.split('=').map(c => c.trim());
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}


