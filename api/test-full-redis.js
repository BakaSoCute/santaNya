import { createApplication, getApplication, updateApplicationStatus, debugRedis } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing full Redis integration...');
    
    // Диагностика
    const debugInfo = await debugRedis();
    
    // Тест 1: Создание заявки
    console.log('🔧 Test 1: Creating application...');
    const testApp = await createApplication({
      fullName: 'Integration Test User',
      contactMethod: 'telegram',
      contactInfo: '@integration_test'
    });
    
    // Тест 2: Получение заявки
    console.log('🔧 Test 2: Retrieving application...');
    const retrievedApp = await getApplication(testApp.id);
    
    // Тест 3: Обновление статуса
    console.log('🔧 Test 3: Updating application status...');
    const updatedApp = await updateApplicationStatus(testApp.id, 'approved', 'test_admin');
    
    // Финальная диагностика
    const finalDebug = await debugRedis();
    
    const result = {
      success: true,
      message: 'Full Redis integration test completed successfully!',
      tests: {
        create_application: testApp ? '✅ PASS' : '❌ FAIL',
        retrieve_application: retrievedApp ? '✅ PASS' : '❌ FAIL',
        update_application: updatedApp ? '✅ PASS' : '❌ FAIL'
      },
      application_flow: {
        created: testApp,
        retrieved: retrievedApp, 
        updated: updatedApp
      },
      redis_debug: {
        initial: debugInfo,
        final: finalDebug
      }
    };
    
    console.log('✅ Full Redis test result:', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Full Redis test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      step: 'Full integration test'
    });
  }
}
