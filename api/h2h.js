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

function parseMaybeJson(v) {
  if (v === undefined || v === null || v === '' || v === -1 || v === '-1') return null;
  if (Array.isArray(v) || typeof v === 'object') return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (_) { return v; }
  }
  return v;
}

function num(v, d = 0) {
  if (v === undefined || v === null || v === '' || v === -1 || v === '-1') return d;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : d;
}

function extractIdsFromAny(raw) {
  raw = parseMaybeJson(raw);
  const ids = new Set();
  function walk(x) {
    if (x === undefined || x === null || x === '' || x === -1 || x === '-1') return;
    if (typeof x === 'number' || (typeof x === 'string' && /^\d+$/.test(x.trim()))) { ids.add(Number(String(x).trim())); return; }
    if (typeof x === 'string') {
      try { walk(JSON.parse(x)); return; } catch (_) {
        x.replace(/[\[\]]/g, '').split(',').forEach(part => { const n = Number(String(part).trim()); if (Number.isFinite(n) && n > 0) ids.add(n); });
        return;
      }
    }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === 'object') {
      ['id', 'match_id', 'fixture_id'].forEach(k => { if (x[k]) walk(x[k]); });
      Object.values(x).forEach(walk);
    }
  }
  walk(raw);
  return [...ids].filter(Boolean);
}

function extractH2H(match) {
  const h2h = parseMaybeJson(match?.h2h);
  if (!h2h) return null;
  return Array.isArray(h2h) ? (h2h[0] || null) : h2h;
}

function extractH2HIds(match) {
  const h2h = extractH2H(match);
  if (!h2h) return [];
  const candidates = [h2h.previous_matches_ids, h2h.previous_match_ids, h2h.matches_ids, h2h.match_ids, h2h.previous_matches, h2h.matches, h2h];
  for (const c of candidates) {
    const ids = extractIdsFromAny(c);
    if (ids.length) return ids;
  }
  return [];
}

function pick(obj, keys, d = 0) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return num(obj[k], d);
  }
  return d;
}

function indicadoresFromApi(match) {
  const h2h = extractH2H(match);
  if (!h2h || !h2h.betting_stats) return null;
  const r = h2h.previous_matches_results || {};
  const b = h2h.betting_stats || {};
  const total = pick(r, ['totalMatches', 'total_matches', 'matches'], pick(b, ['total_matches', 'totalMatches', 'matches'], 0));
  if (!total && !Object.keys(b).length) return null;
  const aWins = pick(r, ['team_a_wins', 'teamAWins', 'clubAWins'], 0);
  const bWins = pick(r, ['team_b_wins', 'teamBWins', 'clubBWins'], 0);
  const draws = pick(r, ['draw', 'draws'], 0);
  return {
    total_confrontos: total,
    vitorias_mandante_atual: aWins,
    empates: draws,
    vitorias_visitante_atual: bWins,
    pct_mandante_atual: pick(r, ['team_a_win_percent', 'teamAWinPercent', 'clubAWinPercentage'], total ? Math.round(aWins / total * 100) : 0),
    pct_empate: pick(r, ['draw_percent', 'drawPercentage'], total ? Math.round(draws / total * 100) : 0),
    pct_visitante_atual: pick(r, ['team_b_win_percent', 'teamBWinPercent', 'clubBWinPercentage'], total ? Math.round(bWins / total * 100) : 0),
    gols_mandante_atual: null,
    gols_visitante_atual: null,
    media_gols: pick(b, ['avg_goals', 'avgGoals', 'average_goals'], 0),
    mais_1_5_gols: pick(b, ['over15Percentage', 'over15_percentage', 'over_15_percentage'], 0),
    mais_2_5_gols: pick(b, ['over25Percentage', 'over25_percentage', 'over_25_percentage'], 0),
    mais_3_5_gols: pick(b, ['over35Percentage', 'over35_percentage', 'over_35_percentage'], 0),
    ambas_marcam: pick(b, ['bttsPercentage', 'btts_percentage', 'BTTSPercentage'], 0),
    clean_mandante_atual: pick(b, ['clubACSPercentage', 'club_a_cs_percentage'], 0),
    clean_visitante_atual: pick(b, ['clubBCSPercentage', 'club_b_cs_percentage'], 0),
    clean_mandante_count: pick(b, ['clubACS', 'club_a_cs'], 0),
    clean_visitante_count: pick(b, ['clubBCS', 'club_b_cs'], 0),
    fonte: 'footystats_match_h2h_betting_stats'
  };
}

function calc(matches, homeId, awayId) {
  let total = 0, hw = 0, aw = 0, dr = 0, hgTotal = 0, agTotal = 0, goalsTotal = 0;
  let btts = 0, over15 = 0, over25 = 0, over35 = 0, homeCS = 0, awayCS = 0;
  for (const m of matches || []) {
    const hId = Number(m.homeID ?? m.home_id ?? m.team_a_id);
    const aId = Number(m.awayID ?? m.away_id ?? m.team_b_id);
    const hg = Number(m.homeGoalCount ?? m.home_goals ?? m.team_a_goals);
    const ag = Number(m.awayGoalCount ?? m.away_goals ?? m.team_b_goals);
    if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
    let gfHome, gfAway;
    if (hId === Number(homeId) && aId === Number(awayId)) { gfHome = hg; gfAway = ag; }
    else if (hId === Number(awayId) && aId === Number(homeId)) { gfHome = ag; gfAway = hg; }
    else continue;
    total++; hgTotal += gfHome; agTotal += gfAway;
    const tg = gfHome + gfAway; goalsTotal += tg;
    if (gfHome > gfAway) hw++; else if (gfAway > gfHome) aw++; else dr++;
    if (gfHome > 0 && gfAway > 0) btts++;
    if (tg > 1.5) over15++; if (tg > 2.5) over25++; if (tg > 3.5) over35++;
    if (gfAway === 0) homeCS++; if (gfHome === 0) awayCS++;
  }
  const pct = x => total ? Math.round(x / total * 100) : 0;
  return { total_confrontos: total, vitorias_mandante_atual: hw, empates: dr, vitorias_visitante_atual: aw, pct_mandante_atual: pct(hw), pct_empate: pct(dr), pct_visitante_atual: pct(aw), gols_mandante_atual: hgTotal, gols_visitante_atual: agTotal, media_gols: total ? Math.round((goalsTotal / total) * 100) / 100 : 0, mais_1_5_gols: pct(over15), mais_2_5_gols: pct(over25), mais_3_5_gols: pct(over35), ambas_marcam: pct(btts), clean_mandante_atual: pct(homeCS), clean_visitante_atual: pct(awayCS), clean_mandante_count: homeCS, clean_visitante_count: awayCS, fonte: 'jtips_recalculo_fallback' };
}

function formatDate(ts) {
  try { if (!ts) return 'Data não informada'; return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(Number(ts) * 1000)); }
  catch (_) { return 'Data não informada'; }
}

async function fetchMatchSafe(id) { try { const j = await apiGet('match', { match_id: id }); return Array.isArray(j.data) ? j.data[0] : j.data; } catch (_) { return null; } }

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });
    const matchId = req.query.match_id || req.query.id;
    if (!matchId) return res.status(400).json({ ok: false, error: 'match_id obrigatório.' });
    const cacheKey = `h2h:api_first_with_fallback:v23_3:${matchId}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }
    const main = await apiGet('match', { match_id: matchId });
    const match = Array.isArray(main.data) ? main.data[0] : main.data;
    if (!match) return res.status(404).json({ ok: false, error: 'Partida não encontrada.' });

    const h2h = extractH2H(match);
    const apiIndicadores = indicadoresFromApi(match);
    const rawPrevious = Array.isArray(h2h?.previous_matches_ids) ? h2h.previous_matches_ids : [];
    const ids = extractH2HIds(match).slice(0, 30);

    let details = [];
    if (rawPrevious.length) {
      details = rawPrevious.map(x => ({
        id: x.id,
        date_unix: x.date_unix,
        homeID: x.team_a_id,
        awayID: x.team_b_id,
        homeGoalCount: x.team_a_goals,
        awayGoalCount: x.team_b_goals,
        home_name: x.team_a_name || null,
        away_name: x.team_b_name || null,
        status: 'complete'
      }));
    } else {
      const batches = [];
      for (let i = 0; i < ids.length; i += 6) batches.push(ids.slice(i, i + 6));
      for (const batch of batches) {
        const rows = await Promise.all(batch.map(fetchMatchSafe));
        details.push(...rows.filter(Boolean));
      }
    }

    const recalculado = calc(details, match.homeID, match.awayID);
    const indicadores = (apiIndicadores && apiIndicadores.total_confrontos) ? apiIndicadores : recalculado;
    indicadores.fallback_used = !(apiIndicadores && apiIndicadores.total_confrontos);
    const ultimos = details.map(m => ({ id: m.id, data_formatada: formatDate(m.date_unix), home_name: m.home_name || m.team_a_name || 'Casa', away_name: m.away_name || m.team_b_name || 'Visitante', homeGoalCount: m.homeGoalCount ?? m.team_a_goals, awayGoalCount: m.awayGoalCount ?? m.team_b_goals, status: m.status })).filter(x => x.id || x.homeGoalCount !== undefined);

    const payload = { ok: true, match_id: Number(matchId), fonte: indicadores.fonte || 'footystats_h2h', source: indicadores.fonte || 'footystats_h2h', fallback_used: !!indicadores.fallback_used, ids, ids_total: ids.length, matches_loaded: details.length, indicadores, ultimos };
    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
