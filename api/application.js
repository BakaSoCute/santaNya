import { getApplication, getAllApplications, debugRedis, findApplicationByName } from '../lib/vercel-redis-storage.js';
import { authenticate } from '../middleware/auth.js';
import Joi from 'joi';

const idSchema = Joi.string().pattern(/^\d+$/).max(10);
const nameSchema = Joi.string().min(2).max(50).pattern(/^[a-zA-Z0-9_]+$/);

export default async function handler(req, res) {
  console.log('📊 Application API called');
  
  const allowedOrigins = [
    'https://www.nyamuras-santa.ru'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  

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
    const twitchName = searchParams.get('twitchName');

    console.log(`🔍 Request parameters - ID: ${id}, TwitchName: ${twitchName}`);


    if (id) {
      const { error: idError } = idSchema.validate(id);
      if (idError) {
        console.log('❌ Invalid ID format:', id);
        return res.status(400).json({ error: 'Invalid application ID format' });
      }

      const applicationId = parseInt(id);
      
      if (applicationId < 1 || applicationId > 1000000) {
        return res.status(400).json({ error: 'Invalid application ID range' });
      }

      const application = await getApplication(applicationId);
      
      if (application) {
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
          }
        });
      } else {
        console.log(`❌ Application ${id} not found in storage`);
        return res.status(404).json({ error: 'Application not found' });
      }
    }

    else if (twitchName) {
      const { error: nameError } = nameSchema.validate(twitchName);
      if (nameError) {
        console.log('❌ Invalid Twitch name format:', twitchName);
        return res.status(400).json({ error: 'Invalid Twitch name format' });
      }

      console.log(`🔍 Searching application by Twitch name: "${twitchName}"`);
      const application = await findApplicationByName(twitchName);
      
      if (application) {

        return res.json({ 
          success: true, 
          application: {
            id: application.id,
            status: application.status,
            twitchName: application.twitchName,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
            processedBy: application.processedBy

          }
        });
      } else {
        console.log(`❌ Application for Twitch name "${twitchName}" not found`);
        return res.json({ 
          success: true, 
          application: null,
          message: 'Application not found' 
        });
      }
    }

    else {
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
