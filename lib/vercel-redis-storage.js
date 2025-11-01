import { createClient } from 'redis';

// Создаем Redis клиент
let redis = null;

async function getRedis() {
  if (!redis) {
    console.log('🔧 Initializing Redis client...');
    
    // Vercel Redis использует URL из переменных окружения
    const redisUrl = process.env.KV_REST_API_URL || process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('Redis URL not found in environment variables');
    }
    
    console.log('🔧 Redis URL:', redisUrl ? 'Set' : 'Not set');
    
    redis = createClient({
      url: redisUrl,
      socket: {
        tls: true,
        rejectUnauthorized: false
      }
    });

    redis.on('error', (err) => console.error('❌ Redis Client Error:', err));
    redis.on('connect', () => console.log('✅ Redis connected'));
    
    await redis.connect();
  }
  return redis;
}

const APPLICATIONS_KEY = 'santa_nya_applications';
const COUNTER_KEY = 'santa_nya_counter';

export async function createApplication(formData) {
  try {
    const redis = await getRedis();
    console.log('🔧 Creating application in Vercel Redis...');
    
    // Получаем ID
    const applicationId = await redis.incr(COUNTER_KEY);
    
    const application = {
      id: applicationId,
      twitchName: formData.fullName,
      contactMethod: formData.contactMethod,
      contactInfo: formData.contactInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Сохраняем в Redis
    await redis.hSet(APPLICATIONS_KEY, applicationId.toString(), JSON.stringify(application));
    
    console.log(`✅ Created application ${applicationId} in Vercel Redis`);
    return application;
    
  } catch (error) {
    console.error('❌ Error creating application:', error);
    throw error;
  }
}

export async function getApplication(id) {
  try {
    const redis = await getRedis();
    console.log(`🔍 Getting application ${id} from Vercel Redis...`);
    
    const applicationData = await redis.hGet(APPLICATIONS_KEY, id.toString());
    
    if (!applicationData) {
      console.log(`❌ Application ${id} not found in Vercel Redis`);
      return null;
    }
    
    const application = JSON.parse(applicationData);
    console.log(`✅ Found application ${id} in Vercel Redis`);
    return application;
    
  } catch (error) {
    console.error(`❌ Error getting application ${id}:`, error);
    return null;
  }
}

export async function updateApplicationStatus(id, status, processedBy) {
  try {
    const redis = await getRedis();
    console.log(`🔄 Updating application ${id} to status: ${status}`);
    
    const application = await getApplication(id);
    
    if (application) {
      application.status = status;
      application.processedBy = processedBy;
      application.updatedAt = new Date().toISOString();
      
      // Обновляем в Redis
      await redis.hSet(APPLICATIONS_KEY, id.toString(), JSON.stringify(application));
      
      console.log(`✅ Updated application ${id} to status: ${status}`);
      return application;
    }
    
    console.log(`❌ Application ${id} not found for update`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error updating application ${id}:`, error);
    throw error;
  }
}

export async function getAllApplications() {
  try {
    const redis = await getRedis();
    console.log('📊 Getting all applications from Vercel Redis...');
    
    const applicationsData = await redis.hGetAll(APPLICATIONS_KEY);
    
    if (!applicationsData || Object.keys(applicationsData).length === 0) {
      console.log('ℹ️ No applications found in Vercel Redis');
      return [];
    }
    
    const apps = Object.values(applicationsData).map(data => JSON.parse(data));
    console.log(`✅ Found ${apps.length} applications in Vercel Redis`);
    return apps;
    
  } catch (error) {
    console.error('❌ Error getting all applications:', error);
    return [];
  }
}

// Диагностическая функция
export async function debugRedis() {
  try {
    const redis = await getRedis();
    
    const info = {
      counter: await redis.get(COUNTER_KEY),
      totalApplications: await redis.hLen(APPLICATIONS_KEY),
      keys: await redis.hKeys(APPLICATIONS_KEY),
      url: process.env.KV_REST_API_URL || process.env.REDIS_URL ? 'Set' : 'Not set'
    };
    
    console.log('🔧 Vercel Redis Debug Info:', info);
    return info;
  } catch (error) {
    console.error('❌ Vercel Redis debug error:', error);
    return { error: error.message };
  }
}
