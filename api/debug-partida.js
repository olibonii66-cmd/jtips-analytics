export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY não configurada na Vercel."
    });
  }

  const matchId = String(req.query.match_id || req.query.matchId || "").trim();
  const seasonId = String(
    req.query.season_id ||
    req.query.league_id ||
    req.query.competition_id ||
    req.query.seasonId ||
    req.query.leagueId ||
    ""
  ).trim();

  const homeId = String(
    req.query.home_id ||
    req.query.homeID ||
    req.query.team_a_id ||
    req.query.team_a ||
    ""
  ).trim();

  const awayId = String(
    req.query.away_id ||
    req.query.awayID ||
    req.query.team_b_id ||
    req.query.team_b ||
    ""
  ).trim();

  const date = String(req.query.date || "").trim();
  const timezone = String(req.query.timezone || "America/Sao_Paulo").trim();

  const debugStartedAt = new Date().toISOString();

  try {
    const requests = buildDebugRequests({
      apiKey,
      matchId,
      seasonId,
      homeId,
      awayId,
      date,
      timezone
    });

    const results = [];

    for (const request of requests) {
      const result = await safeFetchJson(request);
      results.push(result);
    }

    const summary = buildSummary(results);

    return res.status(200).json({
      ok: true,
      source: "footystats",
      debug_started_at: debugStartedAt,
      debug_finished_at: new Date().toISOString(),
      input: {
        match_id: matchId || null,
        season_id: seasonId || null,
        home_id: homeId || null,
        away_id: awayId || null,
        date: date || null,
        timezone
      },
      summary,
      results
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno no debug da partida.",
      detail: error.message,
      input: {
        match_id: matchId || null,
        season_id: seasonId || null,
        home_id: homeId || null,
        away_id: awayId || null,
        date: date || null,
        timezone
      }
    });
  }
}

function buildDebugRequests(params) {
  const {
    apiKey,
    matchId,
    seasonId,
    homeId,
    awayId,
    date,
    timezone
  } = params;

  const requests = [];

  requests.push({
    label: "health-check-api-key",
    required: true,
    url: buildUrl("https://api.football-data-api.com/league-list", {
      key: apiKey,
      chosen_leagues_only: "true"
    })
  });

  requests.push({
    label: "todays-matches",
    required: false,
    url: buildUrl("https://api.football-data-api.com/todays-matches", {
      key: apiKey,
      timezone,
      date: date || undefined
    })
  });

  if (seasonId) {
    requests.push({
      label: "league-matches",
      required: false,
      url: buildUrl("https://api.football-data-api.com/league-matches", {
        key: apiKey,
        league_id: seasonId
      })
    });

    requests.push({
      label: "league-tables",
      required: false,
      url: buildUrl("https://api.football-data-api.com/league-tables", {
        key: apiKey,
        league_id: seasonId
      })
    });

    requests.push({
      label: "league-teams",
      required: false,
      url: buildUrl("https://api.football-data-api.com/league-teams", {
        key: apiKey,
        league_id: seasonId
      })
    });

    requests.push({
      label: "league-players",
      required: false,
      url: buildUrl("https://api.football-data-api.com/league-players", {
        key: apiKey,
        league_id: seasonId
      })
    });

    requests.push({
      label: "league-referees",
      required: false,
      url: buildUrl("https://api.football-data-api.com/league-referees", {
        key: apiKey,
        league_id: seasonId
      })
    });
  }

  if (matchId) {
    requests.push({
      label: "match-details-match_id",
      required: false,
      url: buildUrl("https://api.football-data-api.com/match-details", {
        key: apiKey,
        match_id: matchId
      })
    });

    requests.push({
      label: "match-details-id",
      required: false,
      url: buildUrl("https://api.football-data-api.com/match-details", {
        key: apiKey,
        id: matchId
      })
    });

    requests.push({
      label: "match",
      required: false,
      url: buildUrl("https://api.football-data-api.com/match", {
        key: apiKey,
        match_id: matchId
      })
    });
  }

  if (homeId) {
    requests.push({
      label: "home-team",
      required: false,
      url: buildUrl("https://api.football-data-api.com/team", {
        key: apiKey,
        team_id: homeId
      })
    });

    requests.push({
      label: "home-team-last-5",
      required: false,
      url: buildUrl("https://api.football-data-api.com/lastx", {
        key: apiKey,
        team_id: homeId,
        last_x_match_num: "5"
      })
    });

    requests.push({
      label: "home-team-last-10",
      required: false,
      url: buildUrl("https://api.football-data-api.com/lastx", {
        key: apiKey,
        team_id: homeId,
        last_x_match_num: "10"
      })
    });
  }

  if (awayId) {
    requests.push({
      label: "away-team",
      required: false,
      url: buildUrl("https://api.football-data-api.com/team", {
        key: apiKey,
        team_id: awayId
      })
    });

    requests.push({
      label: "away-team-last-5",
      required: false,
      url: buildUrl("https://api.football-data-api.com/lastx", {
        key: apiKey,
        team_id: awayId,
        last_x_match_num: "5"
      })
    });

    requests.push({
      label: "away-team-last-10",
      required: false,
      url: buildUrl("https://api.football-data-api.com/lastx", {
        key: apiKey,
        team_id: awayId,
        last_x_match_num: "10"
      })
    });
  }

  return requests;
}

function buildUrl(baseUrl, params) {
  const searchParams = new URLSearchParams();

  Object.keys(params).forEach(function(key) {
    const value = params[key];

    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

async function safeFetchJson(request) {
  const startedAt = Date.now();

  try {
    const response = await fetch(request.url, {
      method: "GET",
      headers: {
        accept: "application/json"
      }
    });

    const text = await response.text();

    let json = null;
    let parseError = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch (error) {
      parseError = error.message;
    }

    const durationMs = Date.now() - startedAt;
    const dataInfo = inspectPayload(json);

    return {
      label: request.label,
      required: request.required,
      ok: response.ok,
      http_status: response.status,
      duration_ms: durationMs,
      url: maskApiKey(request.url),
      parse_error: parseError,
      payload_type: dataInfo.payload_type,
      data_count: dataInfo.data_count,
      top_level_keys: dataInfo.top_level_keys,
      important_keys: dataInfo.important_keys,
      sample: dataInfo.sample,
      raw: json || text
    };
  } catch (error) {
    return {
      label: request.label,
      required: request.required,
      ok: false,
      http_status: null,
      duration_ms: Date.now() - startedAt,
      url: maskApiKey(request.url),
      error: error.message,
      payload_type: null,
      data_count: 0,
      top_level_keys: [],
      important_keys: [],
      sample: null,
      raw: null
    };
  }
}

function inspectPayload(payload) {
  if (!payload) {
    return {
      payload_type: "empty",
      data_count: 0,
      top_level_keys: [],
      important_keys: [],
      sample: null
    };
  }

  const topLevelKeys = typeof payload === "object" && !Array.isArray(payload)
    ? Object.keys(payload)
    : [];

  const data = extractDataArray(payload);
  const firstItem = data[0] || null;

  const importantKeys = firstItem && typeof firstItem === "object"
    ? Object.keys(firstItem).filter(isImportantKey)
    : [];

  return {
    payload_type: Array.isArray(payload) ? "array" : typeof payload,
    data_count: data.length,
    top_level_keys: topLevelKeys,
    important_keys: importantKeys,
    sample: firstItem || buildObjectSample(payload)
  };
}

function extractDataArray(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.matches)) return payload.matches;
  if (Array.isArray(payload.fixtures)) return payload.fixtures;
  if (Array.isArray(payload.teams)) return payload.teams;
  if (Array.isArray(payload.players)) return payload.players;
  if (Array.isArray(payload.table)) return payload.table;
  if (Array.isArray(payload.league_table)) return payload.league_table;

  if (payload.data && Array.isArray(payload.data.matches)) {
    return payload.data.matches;
  }

  if (payload.data && Array.isArray(payload.data.teams)) {
    return payload.data.teams;
  }

  if (payload.data && Array.isArray(payload.data.players)) {
    return payload.data.players;
  }

  if (payload.data && Array.isArray(payload.data.table)) {
    return payload.data.table;
  }

  if (typeof payload.data === "object" && payload.data !== null) {
    return [payload.data];
  }

  if (typeof payload === "object") {
    return [payload];
  }

  return [];
}

function buildObjectSample(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const output = {};
  const keys = Object.keys(payload).slice(0, 30);

  keys.forEach(function(key) {
    output[key] = payload[key];
  });

  return output;
}

function isImportantKey(key) {
  const lower = String(key).toLowerCase();

  return (
    lower.includes("id") ||
    lower.includes("name") ||
    lower.includes("team") ||
    lower.includes("home") ||
    lower.includes("away") ||
    lower.includes("goal") ||
    lower.includes("corner") ||
    lower.includes("card") ||
    lower.includes("shot") ||
    lower.includes("xg") ||
    lower.includes("odd") ||
    lower.includes("btts") ||
    lower.includes("over") ||
    lower.includes("under") ||
    lower.includes("status") ||
    lower.includes("date") ||
    lower.includes("time") ||
    lower.includes("image") ||
    lower.includes("logo") ||
    lower.includes("player") ||
    lower.includes("position") ||
    lower.includes("minute") ||
    lower.includes("foul") ||
    lower.includes("possession")
  );
}

function buildSummary(results) {
  const working = results.filter(function(item) {
    return item.ok && !item.parse_error;
  });

  const withData = working.filter(function(item) {
    return Number(item.data_count || 0) > 0;
  });

  const failed = results.filter(function(item) {
    return !item.ok || item.parse_error;
  });

  return {
    total_requests: results.length,
    working_requests: working.length,
    requests_with_data: withData.length,
    failed_requests: failed.length,
    working_labels: working.map(function(item) {
      return item.label;
    }),
    labels_with_data: withData.map(function(item) {
      return item.label;
    }),
    failed_labels: failed.map(function(item) {
      return {
        label: item.label,
        http_status: item.http_status,
        error: item.error || item.parse_error || null
      };
    })
  };
}

function maskApiKey(url) {
  return String(url).replace(/key=([^&]+)/i, "key=***");
}
