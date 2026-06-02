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
  if (!response.ok || json.success === false) throw new Error(json.message || `Erro em ${endpoint}: HTTP ${response.status}`);
  return json;
}

function parseStats(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (_) { return {}; }
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function norm(v) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  return ['nan', 'none', 'null', '[]'].includes(s.toLowerCase()) ? '' : s;
}

function scoreLastxRow(row, seasonId) {
  const stats = parseStats(row?.stats);
  const lastN = Number(row?.last_x_match_num || row?.last_x || 0);
  const ctx = String(row?.last_x_home_away_or_overall ?? '').trim();
  const ids = [row?.competition_id, row?.league_id, row?.season_id, row?.seasonID].map(norm).filter(Boolean);
  let score = 0;
  if (lastN === 5) score += 1000;
  if (ctx === '0' || /overall/i.test(ctx)) score += 200;
  if (seasonId && ids.includes(String(seasonId))) score += 5000;
  score += Object.keys(stats).length;
  return score;
}

function choose(rows, seasonId) {
  if (!Array.isArray(rows) || !rows.length) return { stats: {}, n: null, raw: null };
  const sorted = [...rows].sort((a, b) => scoreLastxRow(b, seasonId) - scoreLastxRow(a, seasonId));
  const row = sorted[0];
  return {
    stats: parseStats(row.stats),
    n: Number(row.last_x_match_num || row.last_x || 5),
    raw_context: row.last_x_home_away_or_overall ?? null,
    competition_id: row.competition_id ?? row.league_id ?? row.season_id ?? null,
    raw: row
  };
}

function trends(stats, teamName) {
  const ctx = 'overall';
  const jogos = n(stats[`seasonMatchesPlayed_${ctx}`], 5) || 5;
  const wins = n(stats[`seasonWinsNum_${ctx}`]);
  const draws = n(stats[`seasonDrawsNum_${ctx}`]);
  const losses = n(stats[`seasonLossesNum_${ctx}`]);
  const ppg = n(stats[`seasonPPG_${ctx}`]);
  const goals = n(stats[`seasonGoals_${ctx}`]);
  const conceded = n(stats[`seasonConceded_${ctx}`]);
  const scoredAvg = n(stats[`seasonScoredAVG_${ctx}`]);
  const concededAvg = n(stats[`seasonConcededAVG_${ctx}`]);
  const cs = n(stats[`seasonCS_${ctx}`]);
  const fts = n(stats[`seasonFTS_${ctx}`]);
  const btts = n(stats[`seasonBTTS_${ctx}`]);
  const over25 = n(stats[`seasonOver25Num_${ctx}`]);
  const over85Corners = n(stats[`over85Corners_${ctx}`]);

  const out = [];
  if (wins >= 3) out.push({ tipo: 'great', texto: `${teamName} chega em boa fase: somou ${Math.round(ppg * jogos)} pontos nos últimos ${jogos} jogos, com média de ${ppg.toFixed(2)} ponto(s) por jogo.` });
  else if (losses >= 3) out.push({ tipo: 'bad', texto: `${teamName} vive momento de alerta: perdeu ${losses} dos últimos ${jogos} jogos.` });
  else out.push({ tipo: 'chart', texto: `${teamName} tem forma recente equilibrada: ${wins} vitória(s), ${draws} empate(s) e ${losses} derrota(s) nos últimos ${jogos} jogos.` });

  if (goals >= jogos * 1.5) out.push({ tipo: 'great', texto: `${teamName} vem forte ofensivamente: marcou ${goals} gols nos últimos ${jogos} jogos, média de ${scoredAvg.toFixed(2)} por partida.` });
  else if (goals <= jogos * 0.8) out.push({ tipo: 'bad', texto: `${teamName} tem baixa produção ofensiva recente: marcou apenas ${goals} gols nos últimos ${jogos} jogos.` });
  else out.push({ tipo: 'chart', texto: `${teamName} marcou ${goals} gols nos últimos ${jogos} jogos, média de ${scoredAvg.toFixed(2)} por partida.` });

  if (cs >= 2) out.push({ tipo: 'great', texto: `${teamName} manteve ${cs} jogos sem sofrer gol nos últimos ${jogos} jogos, mostrando boa consistência defensiva.` });
  else if (conceded >= jogos * 1.5) out.push({ tipo: 'bad', texto: `${teamName} sofreu ${conceded} gols nos últimos ${jogos} jogos, média de ${concededAvg.toFixed(2)} gol(s) sofrido(s) por partida.` });
  else out.push({ tipo: 'chart', texto: `${teamName} sofreu ${conceded} gols nos últimos ${jogos} jogos, média de ${concededAvg.toFixed(2)} por partida.` });

  out.push({ tipo: btts >= 3 ? 'great' : 'bad', texto: btts >= 3 ? `Ambas marcam apareceu em ${btts} dos últimos ${jogos} jogos do ${teamName}.` : `Ambas marcam apareceu em apenas ${btts} dos últimos ${jogos} jogos do ${teamName}.` });
  out.push({ tipo: over25 >= 3 ? 'great' : 'bad', texto: over25 >= 3 ? `Mais de 2.5 gols ocorreu em ${over25} dos últimos ${jogos} jogos do ${teamName}.` : `Mais de 2.5 gols ocorreu em apenas ${over25} dos últimos ${jogos} jogos do ${teamName}.` });
  if (over85Corners >= 3) out.push({ tipo: 'great', texto: `Mais de 8.5 escanteios ocorreu em ${over85Corners} dos últimos ${jogos} jogos.` });
  if (fts >= 2) out.push({ tipo: 'bad', texto: `${teamName} passou em branco em ${fts} dos últimos ${jogos} jogos, ponto de atenção para mercados de gol do time.` });
  return out;
}

async function callLastx(teamId, seasonId) {
  const attempts = [];
  const paramSets = [
    { team_id: teamId, last_x: 5, league_id: seasonId },
    { team_id: teamId, last_x: 5, season_id: seasonId },
    { team_id: teamId, last_x: 5, competition_id: seasonId },
    { team_id: teamId, last_x: 5 },
    { team_id: teamId }
  ].filter((p, idx) => idx >= 3 || seasonId);

  for (const params of paramSets) {
    try {
      const j = await apiGet('lastx', params);
      const rows = Array.isArray(j.data) ? j.data : (j.data ? [j.data] : []);
      attempts.push({ endpoint: 'lastx', params, ok: true, rows: rows.length });
      if (rows.length) return { rows, attempts, source: 'footystats_lastx_api' };
    } catch (e) {
      attempts.push({ endpoint: 'lastx', params, ok: false, error: e.message });
    }
  }
  return { rows: [], attempts, source: null };
}

async function callTeamFallback(teamId, seasonId, attempts) {
  const paramSets = [
    { team_id: teamId, include: 'stats', league_id: seasonId },
    { team_id: teamId, include: 'stats', season_id: seasonId },
    { team_id: teamId, include: 'stats', competition_id: seasonId },
    { team_id: teamId, include: 'stats' }
  ].filter((p, idx) => idx >= 3 || seasonId);
  for (const params of paramSets) {
    try {
      const j = await apiGet('team', params);
      const rows = Array.isArray(j.data) ? j.data : (j.data ? [j.data] : []);
      attempts.push({ endpoint: 'team', params, ok: true, rows: rows.length });
      if (rows.length) {
        const mapped = rows.map(r => ({ ...r, stats: r.stats, last_x_match_num: null, last_x_home_away_or_overall: 'season_fallback' }));
        return { rows: mapped, attempts, source: 'team_stats_fallback' };
      }
    } catch (e) {
      attempts.push({ endpoint: 'team', params, ok: false, error: e.message });
    }
  }
  return { rows: [], attempts, source: null };
}

async function getTeam(teamId, seasonId, name) {
  let result = await callLastx(teamId, seasonId);
  if (!result.rows.length) result = await callTeamFallback(teamId, seasonId, result.attempts);
  const chosen = choose(result.rows, seasonId);
  return {
    team_id: Number(teamId),
    nome: name,
    last_x_match_num: chosen.n,
    fonte: result.source || 'indisponivel',
    source: result.source || 'indisponivel',
    fallback_used: result.source !== 'footystats_lastx_api',
    raw_context: chosen.raw_context,
    selected_competition_id: chosen.competition_id,
    stats: chosen.stats,
    trends: trends(chosen.stats, name),
    stats_keys: Object.keys(chosen.stats).length,
    rows_loaded: result.rows.length,
    attempts: result.attempts
  };
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });

    const seasonId = req.query.season_id || req.query.competition_id || req.query.league_id || '';
    const homeId = req.query.home_id || req.query.team_a_id || req.query.homeID;
    const awayId = req.query.away_id || req.query.team_b_id || req.query.awayID;
    const homeName = req.query.home_name || 'Mandante';
    const awayName = req.query.away_name || 'Visitante';

    if (!homeId || !awayId) return res.status(400).json({ ok: false, error: 'home_id e away_id obrigatórios.' });

    const cacheKey = `lastx-trends:api_first_fallback:v23_3:${seasonId}:${homeId}:${awayId}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=2700, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    const [home, away] = await Promise.all([
      getTeam(homeId, seasonId, homeName),
      getTeam(awayId, seasonId, awayName)
    ]);

    const payload = {
      ok: true,
      season_id: seasonId || null,
      fonte: 'api_first_lastx_with_team_fallback',
      home,
      away,
      home_trends: home.trends,
      away_trends: away.trends,
      fallback_used: home.fallback_used || away.fallback_used
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=2700, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
