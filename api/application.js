import { getApplication, getAllApplications, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('📊 Application API called');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.nyamuras-santa.ru');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Диагностика Redis
    await debugRedis();
    
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const id = searchParams.get('id');

    console.log(`🔍 Application ID requested: ${id}`);

    if (id) {
      const application = await getApplication(parseInt(id));
      
      if (application) {
        return res.json({ 
          success: true, 
          application: {
            id: application.id,
            status: application.status,
            twitchName: application.twitchName,
            contactInfo: application.contactInfo,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
            processedBy: application.processedBy
          }
        });
      } else {
        console.log(`❌ Application ${id} not found in storage`);
        return res.status(404).json({ error: 'Application not found' });
      }
    } else {
      const applications = await getAllApplications();
      return res.json({ 
        success: true, 
        applications: applications,
        total: applications.length
      });
    }

  } catch (error) {
    console.error('Error in application API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

