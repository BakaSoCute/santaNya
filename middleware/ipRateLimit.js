const ipRequests = new Map();

export function ipRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();
  const WINDOW_MS = 60 * 60 * 1000; // 1 час
  const MAX_REQUESTS = 10; // 10 заявок в час с одного IP
  
  if (!ipRequests.has(ip)) {
    ipRequests.set(ip, []);
  }
  
  const requests = ipRequests.get(ip);
  const windowStart = now - WINDOW_MS;
  const recentRequests = requests.filter(time => time > windowStart);
  
if (recentRequests.length >= MAX_REQUESTS) {
  console.log(`🚫 Rate limit exceeded for user ${req.userId}`);
  return res.status(400).json({
    error: 'Validation failed',
    message: 'Не удалось обработать заявку. Попробуйте позже.',
    code: 'REQUEST_LIMIT_REACHED' // Скрытый код для логирования
  });
}
  
  recentRequests.push(now);
  ipRequests.set(ip, recentRequests);
  
  return null;
}
