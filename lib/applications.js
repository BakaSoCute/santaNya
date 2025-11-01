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
  return application;
}

export function getApplication(id) {
  return applications.get(parseInt(id));
}

export function updateApplicationStatus(id, status, approvedBy = null, rejectedBy = null) {
  const application = applications.get(parseInt(id));
  if (application) {
    application.status = status;
    application.updatedAt = new Date().toISOString();
    if (approvedBy) application.approvedBy = approvedBy;
    if (rejectedBy) application.rejectedBy = rejectedBy;
    return application;
  }
  return null;
}

export function getAllApplications() {
  return Array.from(applications.values());
}
