import { updateApplicationStatus } from '../lib/vercel-redis-storage.js';

export default async function handler(req, res) {
  console.log('🤖 Telegram webhook called - SIMPLIFIED VERSION');
  
  try {
    // Отправляем ответ сразу
    res.status(200).json({ ok: true, received: true });
    
    // Запускаем асинхронную обработку
    processWebhookAsync(req.body).catch(error => {
      console.error('💥 Async processing failed:', error);
    });
    
  } catch (error) {
    console.error('💥 Webhook setup error:', error);
  }
}

// Асинхронная обработка webhook
async function processWebhookAsync(body) {
  let callbackAnswered = false;
  
  try {
    console.log('📦 Webhook body:', JSON.stringify(body, null, 2));
    
    const { callback_query } = body;

    if (!callback_query) {
      console.log('❌ No callback_query in request');
      return;
    }

    const { data, message, from } = callback_query;
    console.log(`🔍 Processing callback: ${data} from ${from.username || from.first_name}`);

    if (!data) {
      console.log('❌ No data in callback');
      return;
    }

    const [action, applicationId] = data.split('_');
    
    if (!action || !applicationId) {
      console.log('❌ Invalid data format:', data);
      return;
    }

    console.log(`🔄 Action: ${action}, Application ID: ${applicationId}`);

    // Сначала быстро отвечаем на callback query
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callback_query.id,
          text: `⏳ Обрабатываю заявку...`
        }),
      });
      callbackAnswered = true;
      console.log('✅ Callback answered');
    } catch (error) {
      console.error('❌ Failed to answer callback:', error);
    }

    // Обновляем статус в Redis
    const status = action === 'approve' ? 'approved' : 'rejected';
    const processedBy = from.username || from.first_name;
    
    console.log(`📝 Updating application ${applicationId} to ${status}`);
    
    const updated = await updateApplicationStatus(applicationId, status, processedBy);
    
    if (!updated) {
      console.log(`❌ Application ${applicationId} not found in Redis`);
      
      if (callbackAnswered) {
        // Обновляем ответ
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_query.id,
            text: `❌ Заявка #${applicationId} не найдена`,
            show_alert: true
          }),
        });
      }
      return;
    }

    console.log(`✅ Application ${applicationId} updated to ${status}`);

    // Обновляем сообщение
    const statusEmoji = status === 'approved' ? '✅' : '❌';
    const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

    const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
      `👤 *Twitch ник:* ${updated.twitchName}\n` +
      `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
      `💬 *Контакт:* ${updated.contactInfo}\n` +
      `⏰ *Время подачи:* ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
      `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
      `👤 *Обработал:* ${processedBy}`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: updatedMessage,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] }
      }),
    });

    console.log(`✅ Successfully processed ${action} for application ${applicationId}`);

  } catch (error) {
    console.error('💥 Async webhook processing error:', error);
    
    // В случае ошибки пытаемся хотя бы ответить на callback
    if (body.callback_query && !callbackAnswered) {
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: body.callback_query.id,
            text: '❌ Ошибка при обработке',
            show_alert: true
          }),
        });
      } catch (fetchError) {
        console.error('💥 Even callback answer failed:', fetchError);
      }
    }
  }
}



// import { updateApplicationStatus } from '../lib/vercel-redis-storage.js';

// export default async function handler(req, res) {
//   console.log('🤖 Telegram webhook called - SIMPLIFIED VERSION');
  
//   try {
//     // Всегда возвращаем 200 для Telegram сразу, чтобы избежать таймаутов
//     res.status(200).json({ ok: true, received: true });
    
//     // Дальнейшая обработка асинхронно (не блокируем ответ)
//     processWebhookAsync(req.body).catch(console.error);
    
//   } catch (error) {
//     console.error('💥 Webhook setup error:', error);
//     // Уже отправили ответ 200, так что просто логируем ошибку
//   }
// }

// // Асинхронная обработка webhook
// async function processWebhookAsync(body) {
//   try {
//     console.log('📦 Webhook body:', JSON.stringify(body, null, 2));
    
//     const { callback_query } = body;

//     if (!callback_query) {
//       console.log('❌ No callback_query in request');
//       return;
//     }

//     const { data, message, from } = callback_query;
//     console.log(`🔍 Processing callback: ${data} from ${from.username || from.first_name}`);

//     if (!data) {
//       console.log('❌ No data in callback');
//       return;
//     }

//     const [action, applicationId] = data.split('_');
    
//     if (!action || !applicationId) {
//       console.log('❌ Invalid data format:', data);
//       return;
//     }

//     console.log(`🔄 Action: ${action}, Application ID: ${applicationId}`);

//     // Обновляем статус в Redis
//     const status = action === 'approve' ? 'approved' : 'rejected';
//     const processedBy = from.username || from.first_name;
    
//     console.log(`📝 Updating application ${applicationId} to ${status}`);
    
//     const updated = await updateApplicationStatus(applicationId, status, processedBy);
    
//     if (!updated) {
//       console.log(`❌ Application ${applicationId} not found in Redis`);
      
//       // Уведомляем пользователя в Telegram
//       await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           callback_query_id: callback_query.id,
//           text: `❌ Заявка #${applicationId} не найдена`
//         }),
//       });
//       return;
//     }

//     console.log(`✅ Application ${applicationId} updated to ${status}`);

//     // Отвечаем на callback в Telegram
//     await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         callback_query_id: callback_query.id,
//         text: `✅ Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
//       }),
//     });

//     // Обновляем сообщение
//     const statusEmoji = status === 'approved' ? '✅' : '❌';
//     const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

//     const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
//       `👤 *Twitch ник:* ${updated.twitchName}\n` +
//       `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
//       `💬 *Контакт:* ${updated.contactInfo}\n` +
//       `⏰ *Время подачи:* ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
//       `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
//       `👤 *Обработал:* ${processedBy}`;

//     await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         chat_id: message.chat.id,
//         message_id: message.message_id,
//         text: updatedMessage,
//         parse_mode: 'Markdown',
//         reply_markup: { inline_keyboard: [] }
//       }),
//     });

//     console.log(`✅ Successfully processed ${action} for application ${applicationId}`);

//   } catch (error) {
//     console.error('💥 Async webhook processing error:', error);
//   }
// }



// import { updateApplicationStatus, getApplication, debugRedis } from '../lib/vercel-redis-storage.js';

// export default async function handler(req, res) {
//   console.log('🤖 Telegram webhook called - ENHANCED LOGGING');
  
//   try {
//     // Сразу возвращаем 200 чтобы Telegram не жаловался
//     res.status(200).json({ ok: true });
    
//     // Асинхронная обработка
//     const { callback_query } = req.body;

//     if (!callback_query) {
//       console.log('❌ No callback_query in request');
//       return;
//     }

//     const { data, message, from } = callback_query;
//     console.log(`🔍 Processing callback: ${data} from ${from.username || from.first_name}`);

//     if (!data) {
//       console.log('❌ No data in callback');
//       return;
//     }

//     const [action, applicationId] = data.split('_');
    
//     if (!action || !applicationId) {
//       console.log('❌ Invalid data format:', data);
//       return;
//     }

//     console.log(`🔄 Action: ${action}, Application ID: ${applicationId}`);

//     // 1. Сначала отвечаем на callback
//     console.log('📨 Answering callback query...');
//     await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         callback_query_id: callback_query.id,
//         text: `Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}!`
//       }),
//     });

//     // 2. ДИАГНОСТИКА: Проверяем текущий статус ДО обновления
//     console.log('🔍 Checking current application status BEFORE update...');
//     const currentApp = await getApplication(applicationId);
//     console.log('📄 Current application:', currentApp);

//     // 3. Обновляем статус в Redis
//     const status = action === 'approve' ? 'approved' : 'rejected';
//     const processedBy = from.username || from.first_name;
    
//     console.log(`📝 Updating application ${applicationId} to ${status}...`);
    
//     const updated = await updateApplicationStatus(applicationId, status, processedBy);
    
//     if (!updated) {
//       console.log(`❌ Application ${applicationId} not found in Redis`);
//       return;
//     }

//     console.log(`✅ Application ${applicationId} updated to ${status}`);

//     // 4. ДИАГНОСТИКА: Проверяем статус ПОСЛЕ обновления
//     console.log('🔍 Checking application status AFTER update...');
//     const verifiedApp = await getApplication(applicationId);
//     console.log('📄 Verified application:', verifiedApp);

//     // 5. ДИАГНОСТИКА: Проверяем Redis состояние
//     console.log('🔧 Checking Redis state...');
//     await debugRedis();

//     // 6. Обновляем сообщение в Telegram
//     console.log('✏️ Editing message in Telegram...');
//     const statusEmoji = status === 'approved' ? '✅' : '❌';
//     const statusText = status === 'approved' ? 'Одобрена' : 'Отклонена';

//     const updatedMessage = `🎁 *ЗАЯВКА #${applicationId}*\n\n` +
//       `👤 *Twitch ник:* ${updated.twitchName}\n` +
//       `📞 *Способ связи:* ${updated.contactMethod === 'telegram' ? 'Telegram' : 'Discord'}\n` +
//       `💬 *Контакт:* ${updated.contactInfo}\n` +
//       `⏰ *Время подачи:* ${new Date(updated.createdAt).toLocaleString('ru-RU')}\n` +
//       `📊 *Статус:* ${statusEmoji} ${statusText}\n` +
//       `👤 *Обработал:* ${processedBy}\n` +
//       `✅ *Обновлено в Redis:* ДА`;

//     const editResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         chat_id: message.chat.id,
//         message_id: message.message_id,
//         text: updatedMessage,
//         parse_mode: 'Markdown',
//         reply_markup: { inline_keyboard: [] }
//       }),
//     });

//     const editResult = await editResponse.json();
//     console.log('📝 Message edit result:', editResult.ok ? '✅ Success' : '❌ Failed');

//     console.log(`✅ Successfully processed ${action} for application ${applicationId}`);

//   } catch (error) {
//     console.error('💥 Webhook error:', error);
//     console.error('💥 Error stack:', error.stack);
//   }
// }
