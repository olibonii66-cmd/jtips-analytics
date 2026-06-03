import { checkRateLimit, getClientIp } from './_helpers.js';

const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 45;

async function apiGet(endpoint, params) {
  const key = process.env.FOOTYSTATS_API_KEY;
  if (!key) throw new Error('FOOTYSTATS_API_KEY não configurada.');
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set('key', key);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new Error(json.message || `Erro em ${endpoint}: HTTP ${response.status}`);
  }
  return json;
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });
    }

    const seasonId = req.query.season_id || req.query.league_id || req.query.competition_id || req.query.season;
    if (!seasonId) return res.status(400).json({ ok: false, error: 'season_id/league_id obrigatório.' });

    const cacheKey = `league-matches:v12_8:${seasonId}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=2700, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    const first = await apiGet('league-matches', { league_id: seasonId, page: 1 });
    const maxPage = Math.max(1, Number(first.pager?.max_page || 1));
    const pages = [first];

    if (maxPage > 1) {
      const rest = await Promise.allSettled(
        Array.from({ length: maxPage - 1 }, (_, i) => apiGet('league-matches', { league_id: seasonId, page: i + 2 }))
      );
      for (const r of rest) if (r.status === 'fulfilled') pages.push(r.value);
    }

    const dados = pages.flatMap(p => Array.isArray(p.data) ? p.data : []);
    const columns = Array.from(new Set(dados.flatMap(row => Object.keys(row || {}))));

    const payload = {
      ok: true,
      season_id: Number(seasonId),
      total: dados.length,
      dados,
      columns,
      pager: { max_page: maxPage, pages_loaded: pages.length }
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=2700, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
