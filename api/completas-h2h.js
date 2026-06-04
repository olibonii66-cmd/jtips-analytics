export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY nao configurada na Vercel."
    });
  }

  const matchId = String(req.query.match_id || req.query.matchId || req.query.id || "").trim();
  const seasonId = String(req.query.season_id || req.query.seasonId || req.query.league_id || req.query.competition_id || "").trim();

  if (!matchId) {
    return res.status(400).json({
      ok: false,
      error: "Informe o match_id da partida."
    });
  }

  try {
    let resolvedMatchId = matchId;
    let leagueMatch = null;
    let leagueMatchesDiagnostics = null;

    if (seasonId) {
      const leagueMatchesResult = await fetchFootyStats("league-matches", {
        key: apiKey,
        league_id: seasonId,
        page: 1,
        max_per_page: 500
      });

      const matches = extractArray(leagueMatchesResult.data);
      leagueMatch = matches.find(function(item) {
        return String(item.id || item.match_id || "") === String(matchId);
      }) || null;

      if (leagueMatch) {
        resolvedMatchId = String(leagueMatch.id || leagueMatch.match_id || matchId);
      }

      leagueMatchesDiagnostics = {
        ok: leagueMatchesResult.ok,
        status: leagueMatchesResult.status,
        count: matches.length,
        resolved_from_league_matches: Boolean(leagueMatch)
      };
    }

    const matchDetailsResult = await fetchFootyStats("match", {
      key: apiKey,
      match_id: resolvedMatchId
    });

    const matchDetails = extractMatch(matchDetailsResult.data);

    if (!matchDetails) {
      return res.status(502).json({
        ok: false,
        error: "A FootyStats nao retornou detalhes da partida no endpoint match.",
        diagnostics: {
          requested_match_id: matchId,
          resolved_match_id: resolvedMatchId,
          league_matches: leagueMatchesDiagnostics,
          match_details_status: matchDetailsResult.status,
          match_details_ok: matchDetailsResult.ok
        }
      });
    }

    const data = {
      ...(leagueMatch || {}),
      ...matchDetails,
      h2h: matchDetails.h2h || leagueMatch?.h2h || null
    };

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "completas-h2h",
      input: {
        match_id: matchId,
        season_id: seasonId || null
      },
      diagnostics: {
        requested_match_id: matchId,
        resolved_match_id: resolvedMatchId,
        has_h2h: Boolean(data.h2h),
        league_matches: leagueMatchesDiagnostics,
        match_details_status: matchDetailsResult.status,
        match_details_ok: matchDetailsResult.ok
      },
      data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar H2H completo.",
      detail: error.message
    });
  }
}

async function fetchFootyStats(endpoint, params) {
  const url = buildUrl(`https://api.football-data-api.com/${endpoint}`, params);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json"
    }
  });

  const text = await response.text();
  let data = null;
  let parseError = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    parseError = error.message;
  }

  return {
    ok: response.ok && !parseError,
    status: response.status,
    endpoint,
    data,
    parse_error: parseError
  };
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

function extractMatch(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload.data && Array.isArray(payload.data)) return payload.data[0] || null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.match && typeof payload.match === "object") return payload.match;
  if (typeof payload === "object" && (payload.id || payload.match_id || payload.h2h)) return payload;
  return null;
}
