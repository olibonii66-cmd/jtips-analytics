import { checkRateLimit, getClientIp } from './_helpers.js';

const API_BASE = 'https://api.football-data-api.com';
const cache = new Map();
const TTL = 1000 * 60 * 60;

function toNumber(value) {
  if (value === undefined || value === null || value === '' || value === -1 || value === '-1') return 0;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function pickFields(p) {
  return {
    id: p.id,
    competition_id: p.competition_id,
    league_id: p.league_id,
    season_id: p.season_id,
    full_name: p.full_name,
    first_name: p.first_name,
    last_name: p.last_name,
    known_as: p.known_as,
    shorthand: p.shorthand,
    position: p.position,
    club_team_id: p.club_team_id,
    club_team_2_id: p.club_team_2_id,
    national_team_id: p.national_team_id,
    age: toNumber(p.age),
    minutes_played_overall: toNumber(p.minutes_played_overall),
    minutes_played_home: toNumber(p.minutes_played_home),
    minutes_played_away: toNumber(p.minutes_played_away),
    appearances_overall: toNumber(p.appearances_overall),
    appearances_home: toNumber(p.appearances_home),
    appearances_away: toNumber(p.appearances_away),
    goals_overall: toNumber(p.goals_overall),
    goals_home: toNumber(p.goals_home),
    goals_away: toNumber(p.goals_away),
    goals_per_90_overall: toNumber(p.goals_per_90_overall),
    goals_per_90_home: toNumber(p.goals_per_90_home),
    goals_per_90_away: toNumber(p.goals_per_90_away),
    min_per_goal_overall: toNumber(p.min_per_goal_overall),
    min_per_goal_home: toNumber(p.min_per_goal_home),
    min_per_goal_away: toNumber(p.min_per_goal_away),
    assists_overall: toNumber(p.assists_overall),
    assists_home: toNumber(p.assists_home),
    assists_away: toNumber(p.assists_away),
    goals_involved_per_90_overall: toNumber(p.goals_involved_per_90_overall),
    cards_overall: toNumber(p.cards_overall),
    cards_home: toNumber(p.cards_home),
    cards_away: toNumber(p.cards_away),
    yellow_cards_overall: toNumber(p.yellow_cards_overall),
    red_cards_overall: toNumber(p.red_cards_overall),
    cards_per_90_overall: toNumber(p.cards_per_90_overall),
    min_per_card_overall: toNumber(p.min_per_card_overall),
    shots_total_overall: toNumber(p.shots_total_overall),
    shots_on_target_overall: toNumber(p.shots_on_target_overall),
    shots_off_target_overall: toNumber(p.shots_off_target_overall),
    shots_per_90_overall: toNumber(p.shots_per_90_overall),
    shots_on_target_per_90_overall: toNumber(p.shots_on_target_per_90_overall),
    rank_in_league_top_attackers: toNumber(p.rank_in_league_top_attackers),
    rank_in_league_top_midfielders: toNumber(p.rank_in_league_top_midfielders),
    rank_in_league_top_defenders: toNumber(p.rank_in_league_top_defenders),
    rank_in_club_top_scorer: toNumber(p.rank_in_club_top_scorer),
    min_per_match: toNumber(p.min_per_match),
    last_match_timestamp: p.last_match_timestamp || null,
    raw: p
  };
}

async function fetchPlayersPage(key, seasonId, page = 1, paramName = 'league_id') {
  const url = new URL(`${API_BASE}/league-players`);
  url.searchParams.set('key', key);
  url.searchParams.set(paramName, seasonId);
  url.searchParams.set('page', String(page));
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) throw new Error(json.message || `Erro ao consultar jogadores: HTTP ${response.status}`);
  return json;
}

async function fetchAllPlayers(key, seasonId) {
  const attempts = [];
  for (const paramName of ['league_id', 'season_id', 'competition_id']) {
    try {
      const first = await fetchPlayersPage(key, seasonId, 1, paramName);
      const firstRows = Array.isArray(first.data) ? first.data : (first.data ? [first.data] : []);
      attempts.push({ endpoint: 'league-players', paramName, page: 1, ok: true, rows: firstRows.length });
      if (!firstRows.length) continue;
      const maxPageRaw = Number(first.pager?.max_page || 1);
      const maxPage = Number.isFinite(maxPageRaw) ? Math.min(maxPageRaw, 20) : 1;
      const allRaw = [...firstRows];
      for (let page = 2; page <= maxPage; page++) {
        try {
          const next = await fetchPlayersPage(key, seasonId, page, paramName);
          const rows = Array.isArray(next.data) ? next.data : (next.data ? [next.data] : []);
          attempts.push({ endpoint: 'league-players', paramName, page, ok: true, rows: rows.length });
          allRaw.push(...rows);
        } catch (e) {
          attempts.push({ endpoint: 'league-players', paramName, page, ok: false, error: e.message });
          break;
        }
      }
      return { allRaw, attempts, source: `league-players_${paramName}`, request_remaining: first.metadata?.request_remaining || null, pages_loaded: maxPage };
    } catch (e) {
      attempts.push({ endpoint: 'league-players', paramName, page: 1, ok: false, error: e.message });
    }
  }
  return { allRaw: [], attempts, source: 'indisponivel', request_remaining: null, pages_loaded: 0 };
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });

    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const seasonId = String(req.query.season_id || req.query.competition_id || req.query.league_id || '');
    const homeId = String(req.query.home_id || '');
    const awayId = String(req.query.away_id || '');
    if (!seasonId) return res.status(400).json({ ok: false, error: 'season_id obrigatório.' });

    const cacheKey = `jogadores:api_first_with_param_fallback:v23_3:${seasonId}:${homeId}:${awayId}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached.data);
    }

    const loaded = await fetchAllPlayers(key, seasonId);
    const all = loaded.allRaw.map(pickFields);

    const belongsTo = (p, teamId) => {
      if (!teamId) return false;
      return String(p.club_team_id) === teamId || String(p.club_team_2_id) === teamId || String(p.national_team_id) === teamId;
    };

    const homePlayers = homeId ? all.filter(p => belongsTo(p, homeId)) : [];
    const awayPlayers = awayId ? all.filter(p => belongsTo(p, awayId)) : [];

    const payload = {
      ok: true,
      fonte: loaded.source,
      source: loaded.source,
      season_id: seasonId,
      home_id: homeId || null,
      away_id: awayId || null,
      request_remaining: loaded.request_remaining,
      pages_loaded: loaded.pages_loaded,
      total_players_loaded: all.length,
      home_players: homePlayers,
      away_players: awayPlayers,
      all_players: all,
      fallback_used: loaded.source !== 'league-players_league_id',
      attempts: loaded.attempts,
      columns: loaded.allRaw[0] ? Object.keys(loaded.allRaw[0]) : []
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
