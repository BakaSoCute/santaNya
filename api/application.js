import { getApplication, getAllApplications, updateApplicationStatus } from '../lib/applications.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET /api/application?id=123 - получить конкретную заявку
    // GET /api/application - получить все заявки
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const id = searchParams.get('id');

      if (id) {
        const application = getApplication(id);
        if (!application) {
          return res.status(404).json({ error: 'Application not found' });
        }
        return res.json({ success: true, application });
      } else {
        const applications = getAllApplications();
        return res.json({ success: true, applications, total: applications.length });
      }
    }

    // POST /api/application - обновить статус заявки (для webhook)
    if (req.method === 'POST') {
      const { applicationId, status, approvedBy, rejectedBy } = req.body;

      if (!applicationId || !status) {
        return res.status(400).json({ error: 'Missing applicationId or status' });
      }

      const updatedApplication = updateApplicationStatus(applicationId, status, approvedBy, rejectedBy);
      
      if (!updatedApplication) {
        return res.status(404).json({ error: 'Application not found' });
      }

      return res.json({ success: true, application: updatedApplication });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in application API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}