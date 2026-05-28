const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 30;

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const teamId = String(req.query.team_id || req.query.id || '');
    const competitionId = req.query.competition_id ? String(req.query.competition_id) : '';
    if (!teamId) return res.status(400).json({ ok: false, error: 'team_id obrigatório.' });

    const cacheKey = `time:${teamId}:${competitionId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).json(cached.data);
    }

    const url = new URL(`${API_BASE}/team`);
    url.searchParams.set('key', key);
    url.searchParams.set('team_id', teamId);
    url.searchParams.set('include', 'stats');

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok || !json.success) {
      return res.status(response.status || 500).json({ ok: false, error: json.message || 'Erro ao consultar time.', raw: json });
    }

    const rows = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []);
    let team = null;
    if (competitionId) team = rows.find(r => String(r.competition_id) === competitionId) || null;
    if (!team) team = rows.find(r => r.season_format === 'Domestic League') || rows[0] || null;

    const payload = {
      ok: true,
      team_id: teamId,
      competition_id: competitionId || null,
      request_remaining: json.metadata?.request_remaining || null,
      team,
      stats: team?.stats || {},
      available_competitions: rows.map(r => ({
        competition_id: r.competition_id,
        season: r.season,
        season_format: r.season_format,
        table_position: r.table_position,
        performance_rank: r.performance_rank
      }))
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
