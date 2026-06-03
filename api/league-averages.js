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
  if (!response.ok || json.success === false) {
    throw new Error(json.message || `Erro em ${endpoint}: HTTP ${response.status}`);
  }
  return json;
}

function n(v) {
  if (v === undefined || v === null || v === '' || v === -1 || v === '-1') return null;
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}

function round2(v) {
  return v === null || v === undefined ? null : Math.round(v * 100) / 100;
}

function avg(rows, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const vals = [];
  for (const row of rows || []) {
    const flat = flattenStats(row);
    for (const key of keyList) {
      const x = n(flat?.[key]);
      if (x !== null) { vals.push(x); break; }
    }
  }
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function parseMaybeJson(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (_) { return {}; }
}

function flattenStats(row) {
  const stats = parseMaybeJson(row?.stats);
  return { ...(row || {}), ...(stats || {}) };
}

function flattenAny(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(x => x && typeof x === 'object');
  const out = [];
  if (typeof data === 'object') {
    for (const key of [
      'league_table', 'all_matches_table_overall', 'home_table', 'away_table', 'form_table',
      'table', 'teams', 'data', 'stats', 'standings'
    ]) {
      if (Array.isArray(data[key])) out.push(...data[key].filter(x => x && typeof x === 'object'));
    }
    if (!out.length) {
      for (const v of Object.values(data)) {
        if (Array.isArray(v)) out.push(...v.filter(x => x && typeof x === 'object'));
      }
    }
  }
  return out;
}

async function loadLeagueTables(seasonId) {
  const attempts = [];
  for (const params of [
    { league_id: seasonId, include: 'stats' },
    { season_id: seasonId, include: 'stats' },
    { competition_id: seasonId, include: 'stats' },
    { league_id: seasonId },
    { season_id: seasonId }
  ]) {
    try {
      const j = await apiGet('league-tables', params);
      const rows = flattenAny(j.data);
      attempts.push({ endpoint: 'league-tables', params, ok: true, rows: rows.length });
      if (rows.length) return { rows, source: 'league-tables', attempts, raw_shape: Array.isArray(j.data) ? 'array' : (j.data && typeof j.data === 'object' ? Object.keys(j.data) : typeof j.data) };
    } catch (e) {
      attempts.push({ endpoint: 'league-tables', params, ok: false, error: e.message });
    }
  }
  return { rows: [], source: null, attempts, raw_shape: null };
}

async function loadLeagueTeams(seasonId, previousAttempts = []) {
  const attempts = [...previousAttempts];
  for (const params of [
    { league_id: seasonId, include: 'stats' },
    { season_id: seasonId, include: 'stats' },
    { competition_id: seasonId, include: 'stats' },
    { league_id: seasonId },
    { season_id: seasonId }
  ]) {
    try {
      const j = await apiGet('league-teams', params);
      const rows = flattenAny(j.data);
      attempts.push({ endpoint: 'league-teams', params, ok: true, rows: rows.length });
      if (rows.length) return { rows, source: 'league-teams', attempts, raw_shape: Array.isArray(j.data) ? 'array' : (j.data && typeof j.data === 'object' ? Object.keys(j.data) : typeof j.data) };
    } catch (e) {
      attempts.push({ endpoint: 'league-teams', params, ok: false, error: e.message });
    }
  }
  return { rows: [], source: null, attempts, raw_shape: null };
}

async function loadLeagueMatchesAggregate(seasonId, previousAttempts = []) {
  const attempts = [...previousAttempts];
  try {
    const first = await apiGet('league-matches', { league_id: seasonId, page: 1 });
    const maxPage = Math.max(1, Math.min(Number(first.pager?.max_page || 1), 10));
    const pages = [first];
    for (let page = 2; page <= maxPage; page++) {
      try { pages.push(await apiGet('league-matches', { league_id: seasonId, page })); }
      catch (e) { attempts.push({ endpoint: 'league-matches', params: { league_id: seasonId, page }, ok: false, error: e.message }); }
    }
    const matches = pages.flatMap(p => Array.isArray(p.data) ? p.data : (p.data ? [p.data] : []));
    attempts.push({ endpoint: 'league-matches', params: { league_id: seasonId }, ok: true, rows: matches.length });
    const completed = matches.filter(m => {
      const st = String(m.status || m.match_status || '').toLowerCase();
      return st.includes('complete') || st.includes('finished') || st.includes('final') || Number.isFinite(Number(m.homeGoalCount)) || Number.isFinite(Number(m.awayGoalCount));
    });
    return { rows: completed, source: 'league-matches_fallback_aggregate', attempts, raw_shape: 'matches_aggregate' };
  } catch (e) {
    attempts.push({ endpoint: 'league-matches', params: { league_id: seasonId }, ok: false, error: e.message });
    return { rows: [], source: null, attempts, raw_shape: null };
  }
}

function pctFromMatches(rows, predicate) {
  if (!rows.length) return null;
  let ok = 0, total = 0;
  for (const m of rows) {
    const hg = n(m.homeGoalCount ?? m.home_goals ?? m.team_a_goals);
    const ag = n(m.awayGoalCount ?? m.away_goals ?? m.team_b_goals);
    if (hg === null || ag === null) continue;
    total++;
    if (predicate(hg, ag, m)) ok++;
  }
  return total ? Math.round((ok / total) * 100) : null;
}

function avgGoalsFromMatches(rows) {
  const vals = [];
  for (const m of rows) {
    const hg = n(m.homeGoalCount ?? m.home_goals ?? m.team_a_goals);
    const ag = n(m.awayGoalCount ?? m.away_goals ?? m.team_b_goals);
    if (hg !== null && ag !== null) vals.push(hg + ag);
  }
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function avgFromMatchFields(rows, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const vals = [];
  for (const row of rows || []) {
    for (const key of keyList) {
      const x = n(row?.[key]);
      if (x !== null) { vals.push(x); break; }
    }
  }
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });

    const seasonId = req.query.season_id || req.query.competition_id || req.query.league_id || req.query.seasonID || req.query.season;
    if (!seasonId) return res.status(400).json({ ok: false, error: 'season_id/league_id obrigatório.' });

    const cacheKey = `league-avg:api_first_with_fallback:v23_3:${seasonId}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    let result = await loadLeagueTables(seasonId);
    if (!result.rows.length) result = await loadLeagueTeams(seasonId, result.attempts);
    const hasUsefulStats = result.rows.some(r => Object.keys(flattenStats(r)).some(k => /Over|BTTS|AVG|Corners|cards|season/i.test(k)));
    if (!result.rows.length || !hasUsefulStats) {
      result = await loadLeagueMatchesAggregate(seasonId, result.attempts);
    }

    const rows = result.rows;
    const fromMatches = result.source === 'league-matches_fallback_aggregate';
    const payload = {
      ok: true,
      fonte: result.source || 'fallback_indisponivel',
      source: result.source || 'fallback_indisponivel',
      season_id: Number(seasonId),
      total_times: fromMatches ? null : rows.length,
      total_jogos_fallback: fromMatches ? rows.length : null,
      media_liga_mais_2_5_gols: fromMatches ? pctFromMatches(rows, (h, a) => h + a > 2.5) : avg(rows, ['seasonOver25Percentage_overall','seasonOver25Percentage','over25Percentage','over25_percentage']),
      media_liga_mais_1_5_gols: fromMatches ? pctFromMatches(rows, (h, a) => h + a > 1.5) : avg(rows, ['seasonOver15Percentage_overall','seasonOver15Percentage','over15Percentage','over15_percentage']),
      media_liga_ambas_marcam: fromMatches ? pctFromMatches(rows, (h, a) => h > 0 && a > 0) : avg(rows, ['seasonBTTSPercentage_overall','seasonBTTSPercentage','bttsPercentage','btts_percentage']),
      media_liga_gols: fromMatches ? avgGoalsFromMatches(rows) : avg(rows, ['seasonAVG_overall','seasonAVG','goalsAVG','avg_goals']),
      media_liga_cartoes: fromMatches ? avgFromMatchFields(rows, ['total_cards','cards_total','cardsTotal','cards_potential']) : avg(rows, ['cardsAVG_overall','cardsAVG','cardsTotalAVG_overall','cardsTotalAVG']),
      media_liga_escanteios: fromMatches ? avgFromMatchFields(rows, ['totalCornerCount','total_corners','corners_total','corners_potential']) : avg(rows, ['cornersTotalAVG_overall','cornersAVG_overall','cornersAVG','cornersTotalAVG']),
      raw_shape: result.raw_shape,
      fallback_used: result.source !== 'league-tables',
      attempts: result.attempts,
      columns: Array.from(new Set(rows.flatMap(r => Object.keys(flattenStats(r) || {}))))
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
