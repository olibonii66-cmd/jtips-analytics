
const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 10;

function norm(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function parseStats(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return {}; }
}

function validId(v) {
  const s = norm(v);
  return s && s !== '0' && s.toLowerCase() !== 'nan' && s.toLowerCase() !== 'none' && s.toLowerCase() !== 'null';
}

function rowCompetitionId(row) {
  return norm(row?.competition_id || row?.league_id || row?.season_id || row?.seasonID || row?.id);
}

function scoreRow(row, requestedCompetitionId) {
  if (!row) return -999;
  const req = norm(requestedCompetitionId);
  const cid = rowCompetitionId(row);
  let score = 0;
  if (req && cid === req) score += 1000;
  if (norm(row.season_format).toLowerCase() === 'domestic league') score += 50;
  if (norm(row.season) === '2026') score += 10;
  if (parseStats(row.stats) && Object.keys(parseStats(row.stats)).length) score += 5;
  return score;
}

async function callFootyStats(key, teamId, competitionId, mode) {
  const url = new URL(`${API_BASE}/team`);
  url.searchParams.set('key', key);
  url.searchParams.set('team_id', teamId);
  url.searchParams.set('include', 'stats');

  // A FootyStats costuma tratar o ID de temporada/liga como league_id/season_id.
  // Tentamos variações, mas nunca aceitamos linha errada quando competition_id foi pedido.
  if (competitionId) {
    if (mode === 'league_id') url.searchParams.set('league_id', competitionId);
    if (mode === 'season_id') url.searchParams.set('season_id', competitionId);
    if (mode === 'competition_id') url.searchParams.set('competition_id', competitionId);
  }

  const response = await fetch(url);
  let json = {};
  try { json = await response.json(); } catch (e) {}
  return { mode, response, json, url: url.toString().replace(key, '***') };
}

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const teamId = norm(req.query.team_id || req.query.id);
    const competitionId = norm(req.query.competition_id || req.query.league_id || req.query.season_id);
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';

    if (!teamId) return res.status(400).json({ ok: false, error: 'team_id obrigatório.' });

    const cacheKey = `time:v22_8:${teamId}:${competitionId}`;
    const cached = cache.get(cacheKey);
    if (!refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
      return res.status(200).json(cached.data);
    }

    const modes = competitionId ? ['league_id', 'season_id', 'competition_id', 'none'] : ['none'];
    const attempts = [];
    let allRows = [];

    for (const mode of modes) {
      const attempt = await callFootyStats(key, teamId, competitionId, mode);
      attempts.push({ mode, status: attempt.response.status, ok: attempt.response.ok, success: attempt.json?.success, url: attempt.url, message: attempt.json?.message || null });
      if (attempt.response.ok && attempt.json?.success) {
        const rows = Array.isArray(attempt.json.data) ? attempt.json.data : (attempt.json.data ? [attempt.json.data] : []);
        allRows = rows;
        // Se veio a competição exata, já podemos parar.
        if (!competitionId || rows.some(r => rowCompetitionId(r) === competitionId)) break;
      }
    }

    let team = null;
    if (allRows.length) {
      const sorted = [...allRows].sort((a, b) => scoreRow(b, competitionId) - scoreRow(a, competitionId));
      team = sorted[0] || null;
    }

    const selectedCompetitionId = rowCompetitionId(team);
    const exact_competition_match = !!competitionId && selectedCompetitionId === competitionId;

    // Se o frontend pediu uma liga/temporada específica, não mascarar erro com outra liga.
    // Isso evita número “parecido” mas errado.
    if (competitionId && !exact_competition_match) {
      const payload = {
        ok: false,
        error: 'Competição exata não encontrada para este time. Não vou retornar estatística de outra liga.',
        team_id: teamId,
        requested_competition_id: competitionId,
        selected_competition_id: selectedCompetitionId || null,
        exact_competition_match: false,
        attempts,
        available_competitions: allRows.map(r => ({
          competition_id: r.competition_id,
          league_id: r.league_id,
          season_id: r.season_id,
          season: r.season,
          season_format: r.season_format,
          name: r.name,
          table_position: r.table_position,
          performance_rank: r.performance_rank
        }))
      };
      return res.status(200).json(payload);
    }

    const stats = parseStats(team?.stats);
    const payload = {
      ok: true,
      fonte: 'footystats_team_exact_competition',
      team_id: teamId,
      requested_competition_id: competitionId || null,
      selected_competition_id: selectedCompetitionId || null,
      exact_competition_match,
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
        over135CornersPercentage_overall: stats.over135CornersPercentage_overall ?? null,
      },
      attempts,
      available_competitions: allRows.map(r => ({
        competition_id: r.competition_id,
        league_id: r.league_id,
        season_id: r.season_id,
        season: r.season,
        season_format: r.season_format,
        name: r.name,
        table_position: r.table_position,
        performance_rank: r.performance_rank
      }))
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', refresh ? 'no-store' : 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
