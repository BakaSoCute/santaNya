import { getApplication, getAllApplications, debugRedis } from '../lib/vercel-redis-storage.js';
import { authenticate } from '../middleware/auth.js';
import Joi from 'joi';

const idSchema = Joi.string().pattern(/^\d+$/).max(10);

export default async function handler(req, res) {
  console.log('📊 Application API called');
  
  const allowedOrigins = [
    'https://www.nyamuras-santa.ru'
  ];
  // CORS headers
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authError = await authenticate(req, res);
    if (authError) return authError;

    
    
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const id = searchParams.get('id');

    console.log(`🔍 Application ID requested: ${id}`);

    if (id) {
      // 7. Валидация ID
      const { error: idError } = idSchema.validate(id);
      if (idError) {
        console.log('❌ Invalid ID format:', id);
        return res.status(400).json({ error: 'Invalid application ID format' });
      }

      const applicationId = parseInt(id);
      
      // 8. Проверка диапазона ID (опционально)
      if (applicationId < 1 || applicationId > 1000000) {
        return res.status(400).json({ error: 'Invalid application ID range' });
      }

      const application = await getApplication(applicationId);
      
      if (application) {
        // 9. Возвращаем только необходимые поля (принцип минимальных привилегий)
        return res.json({ 
          success: true, 
          application: {
            id: application.id,
            status: application.status,
            twitchName: application.twitchName,
            contactMethod: application.contactMethod,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
            processedBy: application.processedBy
            // Не возвращаем contactInfo если не нужно
          }
        });
      } else {
        console.log(`❌ Application ${id} not found in storage`);
        return res.status(404).json({ error: 'Application not found' });
      }
    } else {
      const applications = await getAllApplications();
      const limitedApplications = applications.slice(0, 1);
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













