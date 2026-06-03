import { checkRateLimit, getClientIp } from './_helpers.js';

const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 60;

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
  if (!response.ok || json.success === false) throw new Error(json.message || `Erro em ${endpoint}: HTTP ${response.status}`);
  return json;
}

function n(v) {
  if (v === undefined || v === null || v === '' || v === -1 || v === '-1') return null;
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}

function avg(rows, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const vals = [];
  for (const row of rows || []) {
    for (const key of keyList) {
      const x = n(row?.[key]);
      if (x !== null) { vals.push(x); break; }
    }
  }
  return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100 : null;
}

function flattenLeagueTables(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const out = [];
  for (const key of ['league_table', 'all_matches_table_overall', 'home_table', 'away_table', 'form_table']) {
    if (Array.isArray(data[key])) out.push(...data[key]);
  }
  if (!out.length && typeof data === 'object') {
    for (const v of Object.values(data)) {
      if (Array.isArray(v)) out.push(...v.filter(x => x && typeof x === 'object'));
    }
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });
    }

    const seasonId = req.query.season_id || req.query.competition_id || req.query.league_id || req.query.seasonID || req.query.season;
    if (!seasonId) return res.status(400).json({ ok: false, error: 'season_id/league_id obrigatório.' });

    const cacheKey = `league-avg:footystats_tables:v23_2:${seasonId}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    let rows = [];
    let source = 'league-tables';
    let rawShape = null;

    try {
      const j = await apiGet('league-tables', { league_id: seasonId, include: 'stats' });
      rows = flattenLeagueTables(j.data);
      rawShape = Array.isArray(j.data) ? 'array' : (j.data && typeof j.data === 'object' ? Object.keys(j.data) : typeof j.data);
    } catch (e1) {
      const j = await apiGet('league-tables', { season_id: seasonId, include: 'stats' });
      rows = flattenLeagueTables(j.data);
      rawShape = Array.isArray(j.data) ? 'array' : (j.data && typeof j.data === 'object' ? Object.keys(j.data) : typeof j.data);
    }

    const payload = {
      ok: true,
      fonte: source,
      season_id: Number(seasonId),
      total_times: rows.length,
      media_liga_mais_2_5_gols: avg(rows, ['seasonOver25Percentage_overall','seasonOver25Percentage','over25Percentage']),
      media_liga_mais_1_5_gols: avg(rows, ['seasonOver15Percentage_overall','seasonOver15Percentage','over15Percentage']),
      media_liga_ambas_marcam: avg(rows, ['seasonBTTSPercentage_overall','seasonBTTSPercentage','bttsPercentage']),
      media_liga_gols: avg(rows, ['seasonAVG_overall','seasonAVG','goalsAVG','avg_goals']),
      media_liga_cartoes: avg(rows, ['cardsAVG_overall','cardsAVG','cardsTotalAVG_overall']),
      media_liga_escanteios: avg(rows, ['cornersTotalAVG_overall','cornersAVG_overall','cornersAVG']),
      raw_shape: rawShape,
      columns: Array.from(new Set(rows.flatMap(r => Object.keys(r || {}))))
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
