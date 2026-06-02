/**
 * _helpers.js — utilitários compartilhados pelos endpoints JTIPS
 *
 * Rate limiter in-memory: funciona por instância Vercel.
 * Para produção escalável com múltiplas instâncias, migre para:
 * https://vercel.com/docs/storage/vercel-kv
 */

const rateLimiter = new Map();
const RATE_LIMIT  = 60;       // requisições permitidas por janela
const RATE_WINDOW = 60_000;   // janela de 1 minuto (ms)

/**
 * Retorna true se o IP ainda está dentro do limite, false se deve ser bloqueado.
 */
export function checkRateLimit(ip = 'unknown') {
  const now   = Date.now();
  const entry = rateLimiter.get(ip) ?? { count: 0, reset: now + RATE_WINDOW };

  if (now > entry.reset) {
    entry.count = 1;
    entry.reset = now + RATE_WINDOW;
  } else {
    entry.count++;
  }

  rateLimiter.set(ip, entry);

  // Limpeza periódica para não vazar memória em instâncias longas
  if (rateLimiter.size > 2000) {
    for (const [k, v] of rateLimiter) {
      if (now > v.reset) rateLimiter.delete(k);
    }
  }

  return entry.count <= RATE_LIMIT;
}

/**
 * Extrai o IP real do request (Vercel injeta X-Forwarded-For).
 */
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
