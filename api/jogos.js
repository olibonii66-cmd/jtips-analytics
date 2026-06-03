export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY não configurada na Vercel."
    });
  }

  try {
    const date = req.query.date || "";
    const timezone = req.query.timezone || "America/Sao_Paulo";

    const matchParams = new URLSearchParams({
      key: apiKey,
      timezone
    });

    if (date) {
      matchParams.set("date", date);
    }

    const matchesUrl = `https://api.football-data-api.com/todays-matches?${matchParams.toString()}`;
    const leaguesUrl = `https://api.football-data-api.com/league-list?key=${encodeURIComponent(apiKey)}&chosen_leagues_only=true`;

    const [matchesResponse, leaguesResponse] = await Promise.all([
      fetch(matchesUrl),
      fetch(leaguesUrl)
    ]);

    const matchesData = await matchesResponse.json().catch(function() {
      return null;
    });

    const leaguesData = await leaguesResponse.json().catch(function() {
      return null;
    });

    if (!matchesResponse.ok) {
      return res.status(matchesResponse.status).json({
        ok: false,
        error: "Erro ao buscar jogos na FootyStats.",
        status: matchesResponse.status,
        data: matchesData
      });
    }

    const leagueMap = buildLeagueMap(leaguesData);
    const rawMatches = extractMatches(matchesData);

    const enrichedMatches = rawMatches.map(function(match) {
      const seasonId = String(
        match.competition_id ||
        match.league_id ||
        match.season_id ||
        match.competitionID ||
        match.leagueID ||
        match.seasonID ||
        ""
      );

      const leagueInfo = leagueMap[seasonId] || null;

      return {
        ...match,
        resolved_league_id: seasonId || null,
        resolved_league_name: leagueInfo ? leagueInfo.name : null,
        resolved_league_country: leagueInfo ? leagueInfo.country : null
      };
    });

    const enrichedData = {
      ...(matchesData || {}),
      data: enrichedMatches
    };

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "todays-matches",
      date: date || "today",
      timezone,
      raw: enrichedData,
      leagues_loaded: Object.keys(leagueMap).length
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar jogos.",
      detail: error.message
    });
  }
}

function extractMatches(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.matches)) return raw.matches;
  if (Array.isArray(raw.fixtures)) return raw.fixtures;

  return [];
}

function buildLeagueMap(raw) {
  const map = {};
  const rootList = extractLeagueList(raw);

  rootList.forEach(function(item) {
    walkLeagueNode(item, {
      country: item.country || item.country_name || "",
      leagueName: item.league_name || item.name || item.competition_name || ""
    }, map);
  });

  return map;
}

function extractLeagueList(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.leagues)) return raw.leagues;

  if (raw.data && Array.isArray(raw.data.leagues)) {
    return raw.data.leagues;
  }

  return [];
}

function walkLeagueNode(node, context, map) {
  if (!node || typeof node !== "object") return;

  const country =
    node.country ||
    node.country_name ||
    context.country ||
    "";

  const leagueName =
    node.league_name ||
    node.name ||
    node.competition_name ||
    context.leagueName ||
    "";

  const seasonArrays = [
    node.season,
    node.seasons,
    node.season_details,
    node.seasonDetail
  ].filter(Array.isArray);

  seasonArrays.forEach(function(seasons) {
    seasons.forEach(function(season) {
      const seasonId =
        season.id ||
        season.season_id ||
        season.competition_id ||
        season.league_id;

      if (!seasonId) return;

      map[String(seasonId)] = {
        id: String(seasonId),
        country,
        league_name: leagueName,
        name: country && leagueName ? `${country} › ${leagueName}` : leagueName || `Liga ${seasonId}`
      };
    });
  });

  Object.keys(node).forEach(function(key) {
    const value = node[key];

    if (Array.isArray(value)) {
      value.forEach(function(child) {
        if (child && typeof child === "object") {
          walkLeagueNode(child, { country, leagueName }, map);
        }
      });
    }
  });
}
