import { Redis } from '@upstash/redis';

// Инициализация Redis клиента
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const APPLICATIONS_KEY = 'santa_nya_applications';
const COUNTER_KEY = 'santa_nya_application_counter';

export async function createApplication(formData) {
  try {
    console.log('🔧 Creating application in Redis...');
    
    // Увеличиваем счетчик
    const applicationId = await redis.incr(COUNTER_KEY);
    console.log(`✅ Got application ID: ${applicationId}`);
    
    // Создаем заявку
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
    await redis.hset(APPLICATIONS_KEY, { 
      [applicationId]: JSON.stringify(application) 
    });
    
    console.log(`✅ Created application ${applicationId} in Redis`);
    return application;
    
  } catch (error) {
    console.error('❌ Error creating application in Redis:', error);
    throw error;
  }
}

export async function getApplication(id) {
  try {
    console.log(`🔍 Getting application ${id} from Redis...`);
    
    const applicationData = await redis.hget(APPLICATIONS_KEY, id.toString());
    
    if (!applicationData) {
      console.log(`❌ Application ${id} not found in Redis`);
      return null;
    }
    
    const application = JSON.parse(applicationData);
    console.log(`✅ Found application ${id}:`, application);
    return application;
    
  } catch (error) {
    console.error(`❌ Error getting application ${id}:`, error);
    return null;
  }
}

export async function updateApplicationStatus(id, status, processedBy) {
  try {
    console.log(`🔄 Updating application ${id} to status: ${status}`);
    
    const application = await getApplication(id);
    
    if (application) {
      application.status = status;
      application.processedBy = processedBy;
      application.updatedAt = new Date().toISOString();
      
      // Обновляем в Redis
      await redis.hset(APPLICATIONS_KEY, { 
        [id]: JSON.stringify(application) 
      });
      
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
    console.log('📊 Getting all applications from Redis...');
    
    const applicationsData = await redis.hgetall(APPLICATIONS_KEY);
    
    if (!applicationsData) {
      console.log('ℹ️ No applications found in Redis');
      return [];
    }
    
    const apps = Object.values(applicationsData).map(data => JSON.parse(data));
    console.log(`✅ Found ${apps.length} applications in Redis`);
    return apps;
    
  } catch (error) {
    console.error('❌ Error getting all applications:', error);
    return [];
  }
}

// Диагностическая функция
export async function debugRedis() {
  try {
    const info = {
      counter: await redis.get(COUNTER_KEY),
      totalApplications: await redis.hlen(APPLICATIONS_KEY),
      keys: await redis.hkeys(APPLICATIONS_KEY)
    };
    
    console.log('🔧 Redis Debug Info:', info);
    return info;
  } catch (error) {
    console.error('❌ Redis debug error:', error);
    return { error: error.message };
  }
}
