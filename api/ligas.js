import { checkRateLimit, getClientIp } from './_helpers.js';

const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 60; // 1 hora — ligas mudam raramente

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });
    }

    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const cacheKey = 'ligas:chosen';
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    const url = new URL(`${API_BASE}/league-list`);
    url.searchParams.set('key', key);
    url.searchParams.set('chosen_leagues_only', 'true');

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok || !json.success) {
      return res.status(response.status || 500).json({ ok: false, error: json.message || 'Erro ao consultar ligas.', raw: json });
    }

    const payload = {
      ok: true,
      fonte: 'footystats_oficial',
      total: json.pager?.total_results || (json.data || []).length,
      request_remaining: json.metadata?.request_remaining || null,
      ligas: json.data || [],
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
