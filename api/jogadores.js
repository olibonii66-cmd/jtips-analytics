const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 60;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickFields(p) {
  return {
    id: p.id,
    full_name: p.full_name,
    known_as: p.known_as,
    shorthand: p.shorthand,
    position: p.position,
    club_team_id: p.club_team_id,
    national_team_id: p.national_team_id,
    minutes_played_overall: toNumber(p.minutes_played_overall),
    appearances_overall: toNumber(p.appearances_overall),
    goals_overall: toNumber(p.goals_overall),
    goals_per_90_overall: toNumber(p.goals_per_90_overall),
    cards_overall: toNumber(p.cards_overall),
    yellow_cards_overall: toNumber(p.yellow_cards_overall),
    red_cards_overall: toNumber(p.red_cards_overall),
    cards_per_90_overall: toNumber(p.cards_per_90_overall),
    assists_overall: toNumber(p.assists_overall),
    min_per_match: toNumber(p.min_per_match),
    last_match_timestamp: p.last_match_timestamp || null
  };
}

async function fetchPlayersPage(key, seasonId, page = 1) {
  const url = new URL(`${API_BASE}/league-players`);
  url.searchParams.set('key', key);
  url.searchParams.set('season_id', seasonId);
  url.searchParams.set('page', String(page));
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.message || 'Erro ao consultar jogadores.');
  }
  return json;
}

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const seasonId = String(req.query.season_id || req.query.competition_id || '');
    const homeId = String(req.query.home_id || '');
    const awayId = String(req.query.away_id || '');

    if (!seasonId) return res.status(400).json({ ok: false, error: 'season_id obrigatório.' });

    const cacheKey = `jogadores:${seasonId}:${homeId}:${awayId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    const json = await fetchPlayersPage(key, seasonId, 1);
    const rows = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []);

    const all = rows.map(pickFields);

    const homePlayers = homeId
      ? all.filter(p => String(p.club_team_id) === homeId || String(p.national_team_id) === homeId)
      : [];

    const awayPlayers = awayId
      ? all.filter(p => String(p.club_team_id) === awayId || String(p.national_team_id) === awayId)
      : [];

    const payload = {
      ok: true,
      season_id: seasonId,
      home_id: homeId || null,
      away_id: awayId || null,
      request_remaining: json.metadata?.request_remaining || null,
      total_players_page: all.length,
      home_players: homePlayers,
      away_players: awayPlayers,
      columns: rows[0] ? Object.keys(rows[0]) : []
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
