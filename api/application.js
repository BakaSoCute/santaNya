// Используем то же хранилище
const applications = new Map();

export default async function handler(req, res) {
  console.log('📊 Application API called:', req.url);
  
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
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const id = searchParams.get('id');

    console.log(`🔍 Looking for application ID: ${id}`);
    console.log(`📝 Total applications in memory: ${applications.size}`);

    if (id) {
      const application = applications.get(parseInt(id));
      console.log(`📄 Application ${id} found:`, application);
      
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
        console.log(`❌ Application ${id} not found`);
        return res.status(404).json({ error: 'Application not found' });
      }
    } else {
      // Возвращаем все заявки
      const allApplications = Array.from(applications.values());
      return res.json({ 
        success: true, 
        applications: allApplications,
        total: allApplications.length
      });
    }

  } catch (error) {
    console.error('Error in application API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
