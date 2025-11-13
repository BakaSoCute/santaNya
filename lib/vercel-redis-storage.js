import { createClient } from 'redis';

let redis = null;

async function getRedis() {
  if (!redis) {
    console.log('🔧 Initializing Redis client...');
    
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL not found in environment variables');
    }
    
    console.log('🔧 Using Redis URL from REDIS_URL');
    
    redis = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        timeout: 10000
      }
    });

    redis.on('error', (err) => console.error('❌ Redis Client Error:', err));
    redis.on('connect', () => console.log('✅ Redis connected'));
    
    await redis.connect();
    console.log('✅ Redis client initialized and connected');
  }
  return redis;
}

const APPLICATIONS_KEY = 'santa_nya_applications';
const COUNTER_KEY = 'santa_nya_counter';
const QUEUE_KEY = 'santa_nya_telegram_queue';

export async function createApplication(formData) {
  try {
    const redis = await getRedis();
    console.log('🔧 Creating application in Redis...');
    
    
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
    
   
    await redis.hSet(APPLICATIONS_KEY, applicationId.toString(), JSON.stringify(application));
    
    console.log(`✅ Created application ${applicationId} in Redis`);
    return application;
    
  } catch (error) {
    console.error('❌ Error creating application:', error);
    throw error;
  }
}

export async function getApplication(id) {
  try {
    const redis = await getRedis();
    console.log(`🔍 Getting application ${id} from Redis...`);
    
    const applicationData = await redis.hGet(APPLICATIONS_KEY, id.toString());
    
    if (!applicationData) {
      console.log(`❌ Application ${id} not found in Redis`);
      return null;
    }
    
    const application = JSON.parse(applicationData);
    console.log(`✅ Found application ${id} in Redis`);
    return application;
    
  } catch (error) {
    console.error(`❌ Error getting application ${id}:`, error);
    return null;
  }
}

export async function updateApplicationStatus(id, status, processedBy) {
  try {
    console.log(`🔄 updateApplicationStatus called: ${id} -> ${status} by ${processedBy}`);
    
    const redis = await getRedis();
    

    const applicationData = await redis.hGet(APPLICATIONS_KEY, id.toString());
    console.log(`📄 Raw application data from Redis:`, applicationData);
    
    if (!applicationData) {
      console.log(`❌ Application ${id} not found in Redis`);
      return null;
    }
    
    const application = JSON.parse(applicationData);
    console.log(`📋 Parsed application before update:`, application);
    
   
    application.status = status;
    application.processedBy = processedBy;
    application.updatedAt = new Date().toISOString();
    
    console.log(`📝 Application after changes:`, application);
    
    await redis.hSet(APPLICATIONS_KEY, id.toString(), JSON.stringify(application));
    console.log(`💾 Application saved to Redis`);
    

    const verifyData = await redis.hGet(APPLICATIONS_KEY, id.toString());
    console.log(`🔍 Verification - data from Redis after save:`, verifyData);
    
    console.log(`✅ Successfully updated application ${id} to ${status}`);
    return application;
    
  } catch (error) {
    console.error(`❌ Error in updateApplicationStatus for ${id}:`, error);
    console.error(`❌ Error stack:`, error.stack);
    return null;
  }
}

export async function getAllApplications() {
  try {
    const redis = await getRedis();
    console.log('📊 Getting all applications from Redis...');
    
    const applicationsData = await redis.hGetAll(APPLICATIONS_KEY);
    
    if (!applicationsData || Object.keys(applicationsData).length === 0) {
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


export async function addToTelegramQueue(messageData) {
  try {
    const redis = await getRedis();
    const queueItem = {
      ...messageData,
      timestamp: Date.now(),
      attempts: 0
    };
    
    // В Redis v4 используем RPUSH команду через sendCommand или правильный метод
    await redis.rPush(QUEUE_KEY, JSON.stringify(queueItem));
    const queueLength = await redis.lLen(QUEUE_KEY);
    
    console.log(`📥 Added message to queue. Queue size: ${queueLength}`);
    return queueLength;
    
  } catch (error) {
    console.error('❌ Error adding to queue:', error);
    throw error;
  }
}

export async function getNextFromQueue() {
  try {
    const redis = await getRedis();
    // LPOP в Redis v4
    const item = await redis.lPop(QUEUE_KEY);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('❌ Error getting from queue:', error);
    return null;
  }
}

export async function getQueueLength() {
  try {
    const redis = await getRedis();
    // LLEN в Redis v4
    return await redis.lLen(QUEUE_KEY);
  } catch (error) {
    console.error('❌ Error getting queue length:', error);
    return 0;
  }
}

export async function returnToQueue(item) {
  try {
    const redis = await getRedis();
    item.attempts = (item.attempts || 0) + 1;
    // LPUSH в Redis v4
    await redis.lPush(QUEUE_KEY, JSON.stringify(item));
    console.log(`🔄 Returned message to queue. Attempts: ${item.attempts}`);
  } catch (error) {
    console.error('❌ Error returning to queue:', error);
  }
}

// Альтернативная версия с использованием sendCommand (если методы выше не работают)
export async function addToTelegramQueueAlt(messageData) {
  try {
    const redis = await getRedis();
    const queueItem = {
      ...messageData,
      timestamp: Date.now(),
      attempts: 0
    };
    
    // Альтернативный способ через sendCommand
    await redis.sendCommand(['RPUSH', QUEUE_KEY, JSON.stringify(queueItem)]);
    const queueLength = await redis.sendCommand(['LLEN', QUEUE_KEY]);
    
    console.log(`📥 Added message to queue. Queue size: ${queueLength}`);
    return parseInt(queueLength);
    
  } catch (error) {
    console.error('❌ Error adding to queue:', error);
    throw error;
  }
}

export async function getNextFromQueueAlt() {
  try {
    const redis = await getRedis();
    const item = await redis.sendCommand(['LPOP', QUEUE_KEY]);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('❌ Error getting from queue:', error);
    return null;
  }
}

// Диагностическая функция
export async function debugRedis() {
  try {
    const redis = await getRedis();
    
    const info = {
      counter: await redis.get(COUNTER_KEY),
      total_applications: await redis.hLen(APPLICATIONS_KEY),
      application_keys: await redis.hKeys(APPLICATIONS_KEY),
      queue_length: await redis.lLen(QUEUE_KEY),
      url: process.env.REDIS_URL ? '✅ Set' : '❌ Missing'
    };
    
    console.log('🔧 Redis Debug Info:', info);
    return info;
  } catch (error) {
    console.error('❌ Redis debug error:', error);
    return { error: error.message };
  }
}

// Экспортируем redis клиент
export { getRedis };

