// Общее хранилище для всех функций
const applications = new Map();
let applicationCounter = 1;

export function createApplication(formData) {
  const applicationId = applicationCounter++;
  const application = {
    id: applicationId,
    twitchName: formData.fullName,
    contactMethod: formData.contactMethod,
    contactInfo: formData.contactInfo,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  applications.set(applicationId, application);
  console.log(`✅ Created application ${applicationId}`, application);
  return application;
}

export function getApplication(id) {
  const application = applications.get(parseInt(id));
  console.log(`🔍 Getting application ${id}:`, application);
  return application;
}

export function updateApplicationStatus(id, status, processedBy) {
  const application = applications.get(parseInt(id));
  if (application) {
    application.status = status;
    application.processedBy = processedBy;
    application.updatedAt = new Date().toISOString();
    console.log(`✅ Updated application ${id} to status: ${status}`);
    return application;
  }
  console.log(`❌ Application ${id} not found for update`);
  return null;
}

export function getAllApplications() {
  const apps = Array.from(applications.values());
  console.log(`📊 Total applications: ${apps.length}`);
  return apps;
}

// Для диагностики
export function debugStorage() {
  console.log('🔧 Storage debug:', {
    total: applications.size,
    applications: Array.from(applications.entries())
  });
  return Array.from(applications.entries());
}
export function deleteApplication(id) {
  const deleted = applications.delete(parseInt(id));
  console.log(`🗑️ Deleted application ${id}: ${deleted}`);
  return deleted;
}
