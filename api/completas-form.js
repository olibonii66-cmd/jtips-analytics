export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY nao configurada na Vercel."
    });
  }

  const seasonId = String(req.query.season_id || req.query.seasonId || req.query.league_id || req.query.competition_id || "").trim();
  const matchId = String(req.query.match_id || req.query.matchId || "").trim();
  const homeId = String(req.query.home_id || req.query.homeId || "").trim();
  const awayId = String(req.query.away_id || req.query.awayId || "").trim();
  const dateUnix = Number(req.query.date_unix || req.query.dateUnix || 0);

  if (!seasonId) {
    return res.status(400).json({ ok: false, error: "Informe o season_id da liga." });
  }

  if (!homeId || !awayId) {
    return res.status(400).json({ ok: false, error: "Informe home_id e away_id." });
  }

  try {
    const result = await fetchFootyStats("league-matches", {
      key: apiKey,
      league_id: seasonId,
      page: 1,
      max_per_page: 1000
    });

    const matches = extractArray(result.data);
    const cutoff = Number.isFinite(dateUnix) && dateUnix > 0 ? dateUnix : Infinity;

    const home = buildTeamForm(matches, homeId, matchId, cutoff);
    const away = buildTeamForm(matches, awayId, matchId, cutoff);

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "completas-form",
      input: {
        season_id: seasonId,
        match_id: matchId || null,
        home_id: homeId,
        away_id: awayId,
        date_unix: Number.isFinite(dateUnix) && dateUnix > 0 ? dateUnix : null
      },
      diagnostics: {
        league_matches_ok: result.ok,
        league_matches_status: result.status,
        league_matches_count: matches.length
      },
      data: { home, away }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar ultimos jogos.",
      detail: error.message
    });
  }
}

async function fetchFootyStats(endpoint, params) {
  const url = buildUrl(`https://api.football-data-api.com/${endpoint}`, params);
  const response = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
  const text = await response.text();
  let data = null;
  let parseError = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    parseError = error.message;
  }

  return { ok: response.ok && !parseError, status: response.status, data, parse_error: parseError };
}

function buildUrl(baseUrl, params) {
  const searchParams = new URLSearchParams();

  Object.keys(params).forEach(function(key) {
    const value = params[key];
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

function extractArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.matches)) return payload.matches;
  if (payload.data && Array.isArray(payload.data.matches)) return payload.data.matches;
  return [];
}

function buildTeamForm(matches, teamId, currentMatchId, cutoff) {
  const teamMatches = matches
    .filter(function(match) {
      const id = String(match.id || match.match_id || "");
      const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
      const awayId = String(match.awayID || match.away_id || match.team_b_id || "");
      const matchDate = Number(match.date_unix || 0);
      const status = String(match.status || match.game_status || "").toLowerCase();
      const isCurrent = currentMatchId && id === String(currentMatchId);
      const isTeamMatch = homeId === String(teamId) || awayId === String(teamId);
      const isComplete = status === "complete" || status === "finished" || status === "ft" || status === "fulltime";
      return isTeamMatch && !isCurrent && matchDate && matchDate < cutoff && isComplete;
    })
    .sort(function(a, b) {
      return Number(b.date_unix || 0) - Number(a.date_unix || 0);
    });

  return {
    all: teamMatches.slice(0, 5).map(function(match) { return normalizeMatch(match, teamId); }),
    home: teamMatches.filter(function(match) {
      return String(match.homeID || match.home_id || match.team_a_id || "") === String(teamId);
    }).slice(0, 5).map(function(match) { return normalizeMatch(match, teamId); }),
    away: teamMatches.filter(function(match) {
      return String(match.awayID || match.away_id || match.team_b_id || "") === String(teamId);
    }).slice(0, 5).map(function(match) { return normalizeMatch(match, teamId); })
  };
}

function normalizeMatch(match, teamId) {
  const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
  const awayId = String(match.awayID || match.away_id || match.team_b_id || "");
  const homeGoals = cleanNumber(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals);
  const awayGoals = cleanNumber(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals);
  const isHome = homeId === String(teamId);
  const goalsFor = isHome ? homeGoals : awayGoals;
  const goalsAgainst = isHome ? awayGoals : homeGoals;

  return {
    id: match.id || match.match_id || null,
    date_unix: match.date_unix || null,
    homeID: homeId || null,
    awayID: awayId || null,
    home_name: match.home_name || match.homeName || match.team_a_name || match.home || `Time ${homeId}`,
    away_name: match.away_name || match.awayName || match.team_b_name || match.away || `Time ${awayId}`,
    homeGoalCount: homeGoals,
    awayGoalCount: awayGoals,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    result: goalsFor > goalsAgainst ? "V" : goalsFor < goalsAgainst ? "D" : "E",
    venue: isHome ? "home" : "away"
  };
}

function cleanNumber(value) {
  if (value === undefined || value === null || value === "" || value === -1 || value === "-1") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
