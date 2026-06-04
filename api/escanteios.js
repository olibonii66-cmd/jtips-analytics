export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "FOOTYSTATS_API_KEY nao configurada na Vercel." });
  }

  const seasonId = String(req.query.season_id || req.query.seasonId || req.query.league_id || req.query.competition_id || "").trim();
  const matchId = String(req.query.match_id || req.query.matchId || "").trim();
  const homeId = String(req.query.home_id || req.query.homeId || "").trim();
  const awayId = String(req.query.away_id || req.query.awayId || "").trim();
  const dateUnix = Number(req.query.date_unix || req.query.dateUnix || 0);

  if (!seasonId) return res.status(400).json({ ok: false, error: "Informe o season_id da liga." });
  if (!homeId || !awayId) return res.status(400).json({ ok: false, error: "Informe home_id e away_id." });

  try {
    const result = await fetchFootyStats("league-matches", {
      key: apiKey,
      league_id: seasonId,
      page: 1,
      max_per_page: 1000
    });

    const matches = extractArray(result.data);
    const cutoff = Number.isFinite(dateUnix) && dateUnix > 0 ? dateUnix : Infinity;
    const homeMatches = buildVenueMatches(matches, homeId, "home", matchId, cutoff);
    const awayMatches = buildVenueMatches(matches, awayId, "away", matchId, cutoff);

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "escanteios",
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
        league_matches_count: matches.length,
        home_sample: homeMatches.length,
        away_sample: awayMatches.length
      },
      data: {
        home: summarize(homeMatches),
        away: summarize(awayMatches)
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erro interno ao buscar dados de escanteios.", detail: error.message });
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

function buildVenueMatches(matches, teamId, venue, currentMatchId, cutoff) {
  return matches
    .filter(function(match) {
      const id = String(match.id || match.match_id || "");
      const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
      const awayId = String(match.awayID || match.away_id || match.team_b_id || "");
      const matchDate = Number(match.date_unix || 0);
      const isCurrent = currentMatchId && id === String(currentMatchId);
      const isVenue = venue === "home" ? homeId === String(teamId) : awayId === String(teamId);
      return isVenue && !isCurrent && matchDate && matchDate < cutoff && isComplete(match) && hasCornerData(match);
    })
    .sort(function(a, b) { return Number(b.date_unix || 0) - Number(a.date_unix || 0); })
    .map(function(match) { return normalizeMatch(match, teamId); });
}

function isComplete(match) {
  const status = String(match.status || match.game_status || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["complete", "completed", "finished", "ft", "fulltime", "final"].includes(status)) return true;
  return number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals) !== null && number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals) !== null;
}

function hasCornerData(match) {
  return number(match.team_a_corners ?? match.home_corners) !== null || number(match.team_b_corners ?? match.away_corners) !== null || number(match.totalCornerCount ?? match.total_corners) !== null;
}

function normalizeMatch(match, teamId) {
  const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
  const isHome = homeId === String(teamId);
  const homeCorners = number(match.team_a_corners ?? match.home_corners);
  const awayCorners = number(match.team_b_corners ?? match.away_corners);
  const total = number(match.totalCornerCount ?? match.total_corners) ?? sum(homeCorners, awayCorners);
  const fhHome = number(match.team_a_fh_corners ?? match.home_corners_1h);
  const fhAway = number(match.team_b_fh_corners ?? match.away_corners_1h);
  const fhTotal = number(match.corner_fh_count ?? match.corners_1h) ?? sum(fhHome, fhAway);
  const shHomeRaw = number(match.team_a_2h_corners ?? match.home_corners_2h);
  const shAwayRaw = number(match.team_b_2h_corners ?? match.away_corners_2h);
  const shHome = shHomeRaw === null && homeCorners !== null && fhHome !== null ? Math.max(homeCorners - fhHome, 0) : shHomeRaw;
  const shAway = shAwayRaw === null && awayCorners !== null && fhAway !== null ? Math.max(awayCorners - fhAway, 0) : shAwayRaw;
  const shTotal = number(match.corner_2h_count ?? match.corners_2h) ?? sum(shHome, shAway);

  return {
    for: isHome ? homeCorners : awayCorners,
    against: isHome ? awayCorners : homeCorners,
    total,
    firstFor: isHome ? fhHome : fhAway,
    firstAgainst: isHome ? fhAway : fhHome,
    firstTotal: fhTotal,
    secondFor: isHome ? shHome : shAway,
    secondAgainst: isHome ? shAway : shHome,
    secondTotal: shTotal
  };
}

function summarize(matches) {
  return {
    count: matches.length,
    avg_for: avg(matches, "for"),
    avg_against: avg(matches, "against"),
    avg_total: avg(matches, "total"),
    match: {
      over6: percent(matches, function(match) { return match.total >= 7; }),
      over7: percent(matches, function(match) { return match.total >= 8; }),
      over8: percent(matches, function(match) { return match.total >= 9; }),
      over9: percent(matches, function(match) { return match.total >= 10; }),
      over10: percent(matches, function(match) { return match.total >= 11; }),
      over11: percent(matches, function(match) { return match.total >= 12; }),
      over12: percent(matches, function(match) { return match.total >= 13; }),
      over13: percent(matches, function(match) { return match.total >= 14; })
    },
    half: {
      first_over2: percent(matches, function(match) { return match.firstTotal >= 3; }),
      first_over3: percent(matches, function(match) { return match.firstTotal >= 4; }),
      first_over4: percent(matches, function(match) { return match.firstTotal >= 5; }),
      second_over2: percent(matches, function(match) { return match.secondTotal >= 3; }),
      second_over3: percent(matches, function(match) { return match.secondTotal >= 4; }),
      second_over4: percent(matches, function(match) { return match.secondTotal >= 5; }),
      avg_first: avg(matches, "firstTotal"),
      avg_second: avg(matches, "secondTotal")
    },
    team: {
      for_over25: percent(matches, function(match) { return match.for >= 3; }),
      for_over35: percent(matches, function(match) { return match.for >= 4; }),
      for_over45: percent(matches, function(match) { return match.for >= 5; }),
      against_over25: percent(matches, function(match) { return match.against >= 3; }),
      against_over35: percent(matches, function(match) { return match.against >= 4; }),
      against_over45: percent(matches, function(match) { return match.against >= 5; })
    }
  };
}

function avg(matches, key) {
  const values = matches.map(function(match) { return match[key]; }).filter(function(value) { return value !== null && Number.isFinite(Number(value)); });
  if (!values.length) return null;
  return Number((values.reduce(function(total, value) { return total + Number(value); }, 0) / values.length).toFixed(2));
}

function percent(matches, predicate) {
  const valid = matches.filter(function(match) { return match.total !== null; });
  if (!valid.length) return null;
  return Math.round((valid.filter(predicate).length / valid.length) * 100);
}

function number(value) {
  if (value === undefined || value === null || value === "" || value === -1 || value === "-1") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sum(a, b) {
  if (a === null && b === null) return null;
  return Number(a || 0) + Number(b || 0);
}
