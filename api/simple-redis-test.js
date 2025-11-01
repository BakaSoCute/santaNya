export default async function handler(req, res) {
  console.log('🔧 Simple Redis test called - version 2');
  
  try {
    // Шаг 1: Проверка базовой работы
    console.log('✅ Step 1: Basic check passed');
    
    const envCheck = {
      KV_REST_API_URL: process.env.KV_REST_API_URL ? '✅ Set' : '❌ Missing',
      REDIS_URL: process.env.REDIS_URL ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'not set'
    };

    console.log('🔍 Environment check:', envCheck);

    // Шаг 2: Если нет Redis URL - сразу возвращаем ответ
    if (!process.env.KV_REST_API_URL && !process.env.REDIS_URL) {
      console.log('ℹ️ No Redis URL found, returning early');
      return res.json({
        success: true,
        message: 'No Redis URL found in environment',
        environment: envCheck,
        next_step: 'Connect Redis database in Vercel Marketplace'
      });
    }

    console.log('✅ Step 2: Environment check passed');

    // Шаг 3: Динамический импорт Redis (чтобы избежать блокировки)
    console.log('🔧 Step 3: Dynamically importing redis...');
    
    const { createClient } = await import('redis');
    console.log('✅ Redis imported successfully');

    // Шаг 4: Создание клиента
    console.log('🔧 Step 4: Creating Redis client...');
    
    const redisUrl = process.env.KV_REST_API_URL || process.env.REDIS_URL;
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000, // 5 секунд таймаут
        timeout: 5000
      }
    });

    // Обработчики ошибок
    client.on('error', (err) => {
      console.log('❌ Redis Client Error:', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    // Шаг 5: Подключение с таймаутом
    console.log('🔧 Step 5: Connecting to Redis...');
    
    const connectionPromise = client.connect();
    
    // Добавляем таймаут на подключение
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 8000);
    });

    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Redis connection established');

    // Шаг 6: Простые операции
    console.log('🔧 Step 6: Testing Redis operations...');
    
    await client.set('simple_test', 'Hello from Simple Test!');
    const value = await client.get('simple_test');
    
    console.log('✅ Redis operations completed');

    // Шаг 7: Отключение
    console.log('🔧 Step 7: Disconnecting from Redis...');
    await client.disconnect();
    console.log('✅ Redis disconnected');

    // Успешный ответ
    res.json({
      success: true,
      message: 'Simple Redis test completed successfully!',
      environment: envCheck,
      test_results: {
        connection: '✅ Successful',
        write_operation: '✅ OK', 
        read_operation: value,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Simple Redis test failed:', error.message);
    
    // Возвращаем ошибку но не блокируем
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        has_kv_url: !!process.env.KV_REST_API_URL,
        has_redis_url: !!process.env.REDIS_URL
      },
      failed_step: 'Check Redis connection',
      timestamp: new Date().toISOString()
    });
  }
}
