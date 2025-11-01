import { kv } from '@vercel/kv';

const APPLICATIONS_KEY = 'applications';
const COUNTER_KEY = 'application_counter';

export async function createApplication(formData) {
  const applicationId = await kv.incr(COUNTER_KEY);
  
  const application = {
    id: applicationId,
    twitchName: formData.fullName,
    contactMethod: formData.contactMethod,
    contactInfo: formData.contactInfo,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await kv.hset(APPLICATIONS_KEY, { [applicationId]: JSON.stringify(application) });
  console.log(`✅ Created application ${applicationId}`);
  return application;
}

export async function getApplication(id) {
  const applicationData = await kv.hget(APPLICATIONS_KEY, id);
  const application = applicationData ? JSON.parse(applicationData) : null;
  console.log(`🔍 Getting application ${id}:`, application);
  return application;
}

export async function updateApplicationStatus(id, status, processedBy) {
  const application = await getApplication(id);
  
  if (application) {
    application.status = status;
    application.processedBy = processedBy;
    application.updatedAt = new Date().toISOString();
    
    await kv.hset(APPLICATIONS_KEY, { [id]: JSON.stringify(application) });
    console.log(`✅ Updated application ${id} to status: ${status}`);
    return application;
  }
  
  console.log(`❌ Application ${id} not found`);
  return null;
}

export async function getAllApplications() {
  const applicationsData = await kv.hgetall(APPLICATIONS_KEY);
  const apps = applicationsData ? Object.values(applicationsData).map(data => JSON.parse(data)) : [];
  console.log(`📊 Total applications: ${apps.length}`);
  return apps;
}
