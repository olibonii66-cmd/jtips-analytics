export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY nao configurada na Vercel."
    });
  }

  const seasonId = String(req.query.season_id || req.query.seasonId || req.query.league_id || req.query.competition_id || "").trim();
  const maxTime = String(req.query.max_time || req.query.maxTime || "").trim();

  if (!seasonId) {
    return res.status(400).json({
      ok: false,
      error: "Informe o season_id da liga."
    });
  }

  try {
    const params = {
      key: apiKey,
      season_id: seasonId
    };

    if (maxTime) params.max_time = maxTime;

    const result = await fetchFootyStats("league-season", params);
    const league = extractLeague(result.data);

    if (!league) {
      return res.status(502).json({
        ok: false,
        error: "A FootyStats nao retornou dados da liga no endpoint league-season.",
        diagnostics: {
          season_id: seasonId,
          status: result.status,
          ok: result.ok,
          parse_error: result.parse_error
        }
      });
    }

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "completas-league",
      input: {
        season_id: seasonId,
        max_time: maxTime || null
      },
      data: {
        id: league.id || seasonId,
        name: league.name || league.english_name || league.league_name || null,
        country: league.country || null,
        season: league.season || null,
        averages: {
          over15: cleanNumber(league.seasonOver15Percentage_overall),
          over25: cleanNumber(league.seasonOver25Percentage_overall),
          over35: cleanNumber(league.seasonOver35Percentage_overall),
          btts: cleanNumber(league.seasonBTTSPercentage),
          goals_per_match: cleanNumber(league.seasonAVG_overall),
          cards_per_match: cleanNumber(league.cardsAVG_overall),
          corners_per_match: cleanNumber(league.cornersAVG_overall)
        },
        raw: league
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar medias da liga.",
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

function extractLeague(payload) {
  if (!payload) return null;
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data)) return payload.data[0] || null;
  if (payload.league && typeof payload.league === "object") return payload.league;
  if (payload.season && typeof payload.season === "object") return payload.season;
  if (typeof payload === "object" && (payload.id || payload.name || payload.seasonAVG_overall)) return payload;
  return null;
}

function cleanNumber(value) {
  if (value === undefined || value === null || value === "" || value === -1 || value === "-1") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
