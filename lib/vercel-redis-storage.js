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
export async function findApplicationByName(twitchName) {
  return null;
  try {
    const redis = await getRedis();
    console.log(`🔍 Searching for application by name: "${twitchName}"`);
    

    const applicationsData = await redis.hGetAll(APPLICATIONS_KEY);
    
    if (!applicationsData || Object.keys(applicationsData).length === 0) {
      console.log('ℹ️ No applications found in Redis');
      return null;
    }
    

    const searchName = twitchName.toLowerCase().trim();
    
    for (const [id, applicationData] of Object.entries(applicationsData)) {
      try {
        const application = JSON.parse(applicationData);
        const applicationName = application.twitchName?.toLowerCase().trim();
        
        if (applicationName === searchName) {
          console.log(`✅ Заявка${id} от пользователя "${twitchName} уже существует"`);
          return application;
        }
      } catch (parseError) {
        console.error(`❌ Error parsing application ${id}:`, parseError);
      }
    }
    
    console.log(`❌ No application found for name "${twitchName}"`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error searching application by name "${twitchName}":`, error);
    return null;
  }
}
export async function updateApplicationStatus(id, status, processedBy) {
  try {
    console.log(`🔄 updateApplicationStatus called: ${id} -> ${status} by ${processedBy}`);
    
    const redis = await getRedis();
    

    // const applicationData = await redis.hGet(APPLICATIONS_KEY, id.toString());
    // console.log(`📄 Raw application data from Redis:`, applicationData);
    
    // if (!applicationData) {
    //   console.log(`❌ Application ${id} not found in Redis`);
    //   return null;
    // }
    
    // const application = JSON.parse(applicationData);
    // console.log(`📋 Parsed application before update:`, application);
    
    // application.status = status;
    // application.processedBy = processedBy;
    // application.updatedAt = new Date().toISOString();
    
    // console.log(`📝 Application after changes:`, application);
    const currentApplication = JSON.parse(applicationData);
    console.log(`📋 Parsed application before update:`, currentApplication);
    
    // СОЗДАЕМ ПОЛНУЮ КОПИЮ с обновленными полями
    const updatedApplication = {
      ...currentApplication, // сохраняем все существующие поля
      status: status,
      updatedAt: new Date().toISOString()
    };
    
    // Добавляем processedBy только если он передан
    if (processedBy) {
      updatedApplication.processedBy = processedBy;
    }
    
    console.log(`📝 Application after changes:`, updatedApplication);

    await redis.hSet(APPLICATIONS_KEY, id.toString(), JSON.stringify(updatedApplication));
    console.log(`💾 Application saved to Redis`);
    

    const verifyData = await redis.hGet(APPLICATIONS_KEY, id.toString());
    console.log(`🔍 Verification - data from Redis after save:`, verifyData);
    
    console.log(`✅ Successfully updated application ${id} to ${status}`);
    return updatedApplication;
    
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


export async function debugRedis() {
  try {
    const redis = await getRedis();
    
    const info = {
      counter: await redis.get(COUNTER_KEY),
      total_applications: await redis.hLen(APPLICATIONS_KEY),
      application_keys: await redis.hKeys(APPLICATIONS_KEY),
      url: process.env.REDIS_URL ? '✅ Set' : '❌ Missing'
    };
    
    console.log('🔧 Redis Debug Info:', info);
    return info;
  } catch (error) {
    console.error('❌ Redis debug error:', error);
    return { error: error.message };
  }
}
