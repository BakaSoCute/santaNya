// middleware/auth.js
import axios from 'axios';

export async function authenticate(req, res, twitchName) {
  try {
    // Получаем токен из куки
    const token = req.cookies?.twitch_access_token;
    
    console.log('🔐 Auth middleware check:', { 
      method: req.method,
      path: req.url,
      hasToken: !!token 
    });

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in with Twitch first'
      });
    }
    
    // Проверяем токен через Twitch API
    const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 500
    });

    if (response.status !== 200) {
      console.log('❌ Invalid Twitch token');
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Please log in again'
      });
    }

    // Получаем данные пользователя
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });

    const userData = userResponse.data.data[0];
    
    req.user = {
      id: userData.id,
      login: userData.login,
      display_name: userData.display_name,
      profile_image_url: userData.profile_image_url
    };

    if( twitchName && twitchName !== userData.display_name) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Unable to verify your session'
    });
    }

    console.log('✅ User authenticated:', req.user.display_name);
    return null; // Успешная аутентификация
    
  } catch (error) {
    console.error('💥 Auth middleware error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to verify your session'
    });
  }
}
