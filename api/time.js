import { checkRateLimit, getClientIp } from './_helpers.js';

const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 45;

function norm(v) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  if (!s || ['nan','none','null','[]','0'].includes(s.toLowerCase())) return '';
  return s;
}

function parseStats(v) {
  if (!v) return {};
  let obj = {};
  if (typeof v === 'object') obj = v;
  else { try { obj = JSON.parse(v); } catch (e) { obj = {}; } }
  if (obj && typeof obj === 'object' && obj.additional_info && typeof obj.additional_info === 'object') {
    obj = { ...obj, ...obj.additional_info, additional_info: obj.additional_info };
  }
  return obj;
}

function rowCompetitionId(row) {
  return norm(row?.competition_id || row?.league_id || row?.season_id || row?.seasonID || row?.id);
}

function statsCount(row) {
  return Object.keys(parseStats(row?.stats)).length;
}

function scoreRow(row, requestedCompetitionId) {
  if (!row) return -999;
  const req = norm(requestedCompetitionId);
  const cid = rowCompetitionId(row);
  let score = 0;
  if (req && cid === req) score += 100000;
  if (norm(row.competition_id) && req && norm(row.competition_id) === req) score += 5000;
  if (norm(row.season) === String(new Date().getFullYear())) score += 100;
  if (String(row.season_format || '').toLowerCase().includes('domestic league')) score += 50;
  score += statsCount(row);
  return score;
}

async function callTeam(key, teamId, competitionId, mode) {
  const url = new URL(`${API_BASE}/team`);
  url.searchParams.set('key', key);
  url.searchParams.set('team_id', teamId);
  url.searchParams.set('include', 'stats');

  if (competitionId) {
    if (mode === 'league_id') url.searchParams.set('league_id', competitionId);
    if (mode === 'season_id') url.searchParams.set('season_id', competitionId);
    if (mode === 'competition_id') url.searchParams.set('competition_id', competitionId);
  }

  const response = await fetch(url);
  let json = {};
  try { json = await response.json(); } catch (e) {}
  const rows = response.ok && json?.success
    ? (Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []))
    : [];

  return {
    mode,
    status: response.status,
    ok: response.ok,
    success: !!json?.success,
    message: json?.message || null,
    rows,
    url: url.toString().replace(key, '***')
  };
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });
    }

    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const teamId = norm(req.query.team_id || req.query.id);
    const competitionId = norm(req.query.competition_id || req.query.league_id || req.query.season_id);
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    if (!teamId) return res.status(400).json({ ok: false, error: 'team_id obrigatório.' });

    const cacheKey = `time:footystats_exact_competition:v23_2_ai_fields_v2:${teamId}:${competitionId}`;
    const cached = cache.get(cacheKey);
    if (!refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
      return res.status(200).json(cached.data);
    }

    const modes = competitionId ? ['league_id', 'season_id', 'competition_id'] : ['none'];
    const attempts = [];
    let allRows = [];

    for (const mode of modes) {
      const a = await callTeam(key, teamId, competitionId, mode);
      attempts.push({ mode: a.mode, status: a.status, ok: a.ok, success: a.success, message: a.message, total_rows: a.rows.length, url: a.url });
      if (a.rows.length) {
        allRows = allRows.concat(a.rows);
        if (competitionId && a.rows.some(r => rowCompetitionId(r) === competitionId)) break;
        if (!competitionId) break;
      }
    }

    // Remove duplicados por competição/id, mantendo primeira ocorrência.
    const seen = new Set();
    allRows = allRows.filter(r => {
      const k = `${rowCompetitionId(r)}:${norm(r.id)}:${norm(r.name)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (!allRows.length) {
      return res.status(200).json({
        ok: false,
        error: 'Nenhuma estatística retornada para este time.',
        team_id: teamId,
        requested_competition_id: competitionId || null,
        stats: {},
        attempts,
        available_competitions: []
      });
    }

    const sorted = [...allRows].sort((a, b) => scoreRow(b, competitionId) - scoreRow(a, competitionId));
    const exactRows = competitionId ? sorted.filter(r => rowCompetitionId(r) === competitionId || norm(r.competition_id) === competitionId || norm(r.league_id) === competitionId || norm(r.season_id) === competitionId) : sorted;
    const team = exactRows[0] || sorted[0];
    const selectedCompetitionId = rowCompetitionId(team);
    const exactCompetitionMatch = !competitionId || !!exactRows.length;
    const stats = parseStats(team?.stats);

    const payload = {
      ok: true,
      fonte: exactCompetitionMatch ? 'footystats_team_exact_competition' : 'footystats_team_fallback_best_available',
      fallback_used: !exactCompetitionMatch,
      team_id: teamId,
      requested_competition_id: competitionId || null,
      selected_competition_id: selectedCompetitionId || null,
      exact_competition_match: exactCompetitionMatch,
      warning: competitionId && !exactCompetitionMatch ? 'A API não retornou estatística para a competição exata. Usando melhor linha disponível da própria API como fallback.' : null,
      team,
      stats,
      debug_corner_values: {
        cornersAVG_overall: stats.cornersAVG_overall ?? null,
        over65CornersPercentage_overall: stats.over65CornersPercentage_overall ?? null,
        over75CornersPercentage_overall: stats.over75CornersPercentage_overall ?? null,
        over85CornersPercentage_overall: stats.over85CornersPercentage_overall ?? null,
        over95CornersPercentage_overall: stats.over95CornersPercentage_overall ?? null,
        over105CornersPercentage_overall: stats.over105CornersPercentage_overall ?? null,
        over115CornersPercentage_overall: stats.over115CornersPercentage_overall ?? null,
        over125CornersPercentage_overall: stats.over125CornersPercentage_overall ?? null,
        over135CornersPercentage_overall: stats.over135CornersPercentage_overall ?? null
      },
      attempts,
      available_competitions: allRows.map(r => ({
        competition_id: r.competition_id,
        league_id: r.league_id,
        season_id: r.season_id,
        season: r.season,
        season_format: r.season_format,
        name: r.name,
        cleanName: r.cleanName,
        table_position: r.table_position,
        performance_rank: r.performance_rank,
        stats_fields: statsCount(r)
      }))
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', refresh ? 'no-store' : 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
