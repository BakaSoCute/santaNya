
import { getApplication, getAllApplications, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('📊 Application API called');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
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

    if (id) {
      const application = await getApplication(parseInt(id));
      
      if (application) {
        res.json({ success: true, application });
      } else {
        res.status(404).json({ error: 'Application not found' });
      }
    } else {
      const applications = await getAllApplications();
      res.json({ success: true, applications, total: applications.length });
    }
  } catch (error) {
    console.error('❌ Error in application API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}





