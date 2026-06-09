const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (payload?.data && typeof payload.data === "object") return [payload.data];
  return payload && typeof payload === "object" ? [payload] : [];
}

async function fetchFootyStats(path, params, timeoutMs = 9000) {
  const url = new URL(path, FOOTYSTATS_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(`FootyStats respondeu ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function optionalRequest(path, params) {
  try {
    return await fetchFootyStats(path, params);
  } catch (error) {
    return null;
  }
}

function findTeam(teams, teamId) {
  return teams.find((team) => String(team.id) === String(teamId)) || null;
}

function normalizeTeam(team, fallback) {
  if (!team) return fallback;

  return {
    id: team.id,
    name: team.cleanName || team.name || team.full_name || fallback?.name,
    fullName: team.full_name || team.english_name || team.name || fallback?.name,
    shortHand: team.shortHand || team.shorthand || "",
    logo: team.image || fallback?.logo || "",
    country: team.country || fallback?.country || "",
    tablePosition: team.table_position ?? null,
    performanceRank: team.performance_rank ?? null,
    risk: team.risk ?? null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_KEY_MISSING",
      message: "FOOTYSTATS_API_KEY não configurada.",
    });
  }

  const matchId = Array.isArray(req.query.match_id)
    ? req.query.match_id[0]
    : req.query.match_id;
  const requestedLeagueId = Array.isArray(req.query.league_id)
    ? req.query.league_id[0]
    : req.query.league_id;

  if (!matchId) {
    return res.status(400).json({
      ok: false,
      error: "MATCH_ID_REQUIRED",
      message: "Informe match_id.",
    });
  }

  try {
    const matchPayload = await fetchFootyStats("/match", {
      key: apiKey,
      match_id: matchId,
    });
    const match = extractList(matchPayload)[0];

    if (!match) {
      return res.status(404).json({
        ok: false,
        error: "MATCH_NOT_FOUND",
        message: "Partida não encontrada.",
      });
    }

    const leagueId =
      requestedLeagueId ||
      match.competition_id ||
      match.league_id ||
      match.season_id;

    const [teamsPayload, homeLastPayload, awayLastPayload, playersPayload] =
      await Promise.all([
        leagueId
          ? optionalRequest("/league-teams", {
              key: apiKey,
              league_id: leagueId,
            })
          : null,
        match.homeID
          ? optionalRequest("/lastx", {
              key: apiKey,
              team_id: match.homeID,
              last_x: 5,
            })
          : null,
        match.awayID
          ? optionalRequest("/lastx", {
              key: apiKey,
              team_id: match.awayID,
              last_x: 5,
            })
          : null,
        leagueId
          ? optionalRequest("/league-players", {
              key: apiKey,
              league_id: leagueId,
            })
          : null,
      ]);

    const teams = extractList(teamsPayload);
    const players = extractList(playersPayload);
    const homeTeam = normalizeTeam(findTeam(teams, match.homeID), {
      id: match.homeID,
      name: match.home_name,
      logo: match.home_image,
      country: match.country,
    });
    const awayTeam = normalizeTeam(findTeam(teams, match.awayID), {
      id: match.awayID,
      name: match.away_name,
      logo: match.away_image,
      country: match.country,
    });

    res.setHeader(
      "Cache-Control",
      "s-maxage=600, stale-while-revalidate=1800",
    );

    return res.status(200).json({
      ok: true,
      timezone: "America/Sao_Paulo",
      match,
      teams: {
        home: homeTeam,
        away: awayTeam,
      },
      lastx: {
        home: extractList(homeLastPayload),
        away: extractList(awayLastPayload),
      },
      players: {
        home: players.filter(
          (player) => String(player.club_team_id) === String(match.homeID),
        ),
        away: players.filter(
          (player) => String(player.club_team_id) === String(match.awayID),
        ),
      },
      availability: {
        teams: teams.length > 0,
        homeLast: extractList(homeLastPayload).length > 0,
        awayLast: extractList(awayLastPayload).length > 0,
        players: players.length > 0,
      },
    });
  } catch (error) {
    return res.status(error.status || 502).json({
      ok: false,
      error: "FOOTYSTATS_FETCH_FAILED",
      message: "Não foi possível buscar os detalhes da partida.",
    });
  }
};
