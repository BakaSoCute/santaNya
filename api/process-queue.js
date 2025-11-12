import { processQueue } from './send-to-telegram.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    await processQueue();
    res.json({ success: true });
  } else {
    res.status(405).end();
  }
}
