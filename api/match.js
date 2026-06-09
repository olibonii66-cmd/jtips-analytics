const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";

function normalizeLogoUrl(value) {
  if (!value) return "";

  const logo = String(value).trim();
  if (!logo) return "";
  if (/^https?:\/\//i.test(logo)) return logo.replace(/^http:/i, "https:");
  if (logo.startsWith("//")) return `https:${logo}`;

  return `https://cdn.footystats.org/img/${logo.replace(/^\/?(?:img\/)?/i, "")}`;
}

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

async function optionalPagedRequest(path, params, maxPages = 8) {
  try {
    const firstPage = await fetchFootyStats(path, {
      ...params,
      page: 1,
      max_per_page: 500,
    });
    const items = extractList(firstPage);
    const totalPages = Math.min(
      Math.max(Number(firstPage?.pager?.max_page) || 1, 1),
      maxPages,
    );

    if (totalPages === 1) return items;

    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        optionalRequest(path, {
          ...params,
          page: index + 2,
          max_per_page: 500,
        }),
      ),
    );

    return [
      ...items,
      ...remainingPages.flatMap((payload) => extractList(payload)),
    ];
  } catch (error) {
    return [];
  }
}

function findTeam(teams, teamId) {
  return teams.find((team) => String(team.id) === String(teamId)) || null;
}

function playerTeamId(player) {
  return (
    player?.club_team_id ??
    player?.clubTeamID ??
    player?.club_teamID ??
    player?.team_id ??
    player?.teamID ??
    player?.club_id
  );
}

function normalizeTeam(team, fallback) {
  if (!team) {
    return {
      ...fallback,
      logo: normalizeLogoUrl(fallback?.logo),
    };
  }

  return {
    id: team.id,
    name: team.cleanName || team.name || team.full_name || fallback?.name,
    fullName: team.full_name || team.english_name || team.name || fallback?.name,
    shortHand: team.shortHand || team.shorthand || "",
    logo: normalizeLogoUrl(team.image || fallback?.logo),
    country: team.country || fallback?.country || "",
    tablePosition: team.table_position ?? null,
    performanceRank: team.performance_rank ?? null,
    risk: team.risk ?? null,
    stadium_name:
      team.stadium_name ||
      team.stadium?.name ||
      team.venue_name ||
      fallback?.stadium_name ||
      "",
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

    const [teamsPayload, homeLastPayload, awayLastPayload, players] =
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
          ? optionalPagedRequest("/league-players", {
              key: apiKey,
              league_id: leagueId,
            })
          : [],
      ]);

    const teams = extractList(teamsPayload);
    const homeTeam = normalizeTeam(findTeam(teams, match.homeID), {
      id: match.homeID,
      name: match.home_name,
      logo: match.home_image,
      country: match.country,
      stadium_name: match.stadium_name,
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
          (player) => String(playerTeamId(player)) === String(match.homeID),
        ),
        away: players.filter(
          (player) => String(playerTeamId(player)) === String(match.awayID),
        ),
      },
      availability: {
        teams: teams.length > 0,
        homeLast: extractList(homeLastPayload).length > 0,
        awayLast: extractList(awayLastPayload).length > 0,
        players: players.length > 0,
        homePlayers: players.some(
          (player) => String(playerTeamId(player)) === String(match.homeID),
        ),
        awayPlayers: players.some(
          (player) => String(playerTeamId(player)) === String(match.awayID),
        ),
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
