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
      endpoint: "gols",
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
    return res.status(500).json({ ok: false, error: "Erro interno ao buscar dados de gols.", detail: error.message });
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
      return isVenue && !isCurrent && matchDate && matchDate < cutoff && isComplete(match);
    })
    .sort(function(a, b) { return Number(b.date_unix || 0) - Number(a.date_unix || 0); })
    .map(function(match) { return normalizeMatch(match, teamId); });
}

function isComplete(match) {
  const status = String(match.status || match.game_status || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["complete", "completed", "finished", "ft", "fulltime", "final"].includes(status)) return true;
  return hasScore(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals) && hasScore(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals);
}

function normalizeMatch(match, teamId) {
  const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
  const awayId = String(match.awayID || match.away_id || match.team_b_id || "");
  const isHome = homeId === String(teamId);
  const homeGoals = number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals);
  const awayGoals = number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals);
  const htHome = number(match.ht_goals_team_a ?? match.homeGoalsHT ?? match.home_goals_ht);
  const htAway = number(match.ht_goals_team_b ?? match.awayGoalsHT ?? match.away_goals_ht);
  const shHomeRaw = number(match.goals_2hg_team_a ?? match.homeGoals2H ?? match.home_goals_2h);
  const shAwayRaw = number(match.goals_2hg_team_b ?? match.awayGoals2H ?? match.away_goals_2h);
  const shHome = shHomeRaw === null && htHome !== null && homeGoals !== null ? Math.max(homeGoals - htHome, 0) : shHomeRaw;
  const shAway = shAwayRaw === null && htAway !== null && awayGoals !== null ? Math.max(awayGoals - htAway, 0) : shAwayRaw;

  return {
    goalsFor: isHome ? homeGoals : awayGoals,
    goalsAgainst: isHome ? awayGoals : homeGoals,
    firstFor: isHome ? htHome : htAway,
    firstAgainst: isHome ? htAway : htHome,
    secondFor: isHome ? shHome : shAway,
    secondAgainst: isHome ? shAway : shHome,
    totalGoals: sum(homeGoals, awayGoals),
    firstTotal: sum(htHome, htAway),
    secondTotal: sum(shHome, shAway),
    btts: homeGoals > 0 && awayGoals > 0,
    bttsFirst: htHome > 0 && htAway > 0,
    bttsSecond: shHome > 0 && shAway > 0,
    won: (isHome ? homeGoals : awayGoals) > (isHome ? awayGoals : homeGoals),
    draw: homeGoals === awayGoals
  };
}

function summarize(matches) {
  const count = matches.length;

  return {
    count,
    scored: {
      avg: avg(matches, "goalsFor"),
      over05: percent(matches, function(match) { return match.goalsFor >= 1; }),
      over15: percent(matches, function(match) { return match.goalsFor >= 2; }),
      over25: percent(matches, function(match) { return match.goalsFor >= 3; }),
      over35: percent(matches, function(match) { return match.goalsFor >= 4; }),
      failed: percent(matches, function(match) { return match.goalsFor === 0; }),
      first: percent(matches, function(match) { return match.firstFor >= 1; }),
      second: percent(matches, function(match) { return match.secondFor >= 1; }),
      both_halves: percent(matches, function(match) { return match.firstFor >= 1 && match.secondFor >= 1; }),
      avg_first: avg(matches, "firstFor"),
      avg_second: avg(matches, "secondFor")
    },
    conceded: {
      avg: avg(matches, "goalsAgainst"),
      over05: percent(matches, function(match) { return match.goalsAgainst >= 1; }),
      over15: percent(matches, function(match) { return match.goalsAgainst >= 2; }),
      over25: percent(matches, function(match) { return match.goalsAgainst >= 3; }),
      over35: percent(matches, function(match) { return match.goalsAgainst >= 4; }),
      clean_sheets: percent(matches, function(match) { return match.goalsAgainst === 0; }),
      clean_first: percent(matches, function(match) { return match.firstAgainst === 0; }),
      clean_second: percent(matches, function(match) { return match.secondAgainst === 0; }),
      avg_first: avg(matches, "firstAgainst"),
      avg_second: avg(matches, "secondAgainst")
    },
    match_goals: {
      over05: percent(matches, function(match) { return match.totalGoals >= 1; }),
      over15: percent(matches, function(match) { return match.totalGoals >= 2; }),
      over25: percent(matches, function(match) { return match.totalGoals >= 3; }),
      over35: percent(matches, function(match) { return match.totalGoals >= 4; }),
      over45: percent(matches, function(match) { return match.totalGoals >= 5; }),
      under05: percent(matches, function(match) { return match.totalGoals < 1; }),
      under15: percent(matches, function(match) { return match.totalGoals < 2; }),
      under25: percent(matches, function(match) { return match.totalGoals < 3; }),
      under35: percent(matches, function(match) { return match.totalGoals < 4; }),
      under45: percent(matches, function(match) { return match.totalGoals < 5; }),
      btts: percent(matches, function(match) { return match.btts; }),
      btts_win: percent(matches, function(match) { return match.btts && match.won; }),
      btts_draw: percent(matches, function(match) { return match.btts && match.draw; }),
      btts_over25: percent(matches, function(match) { return match.btts && match.totalGoals >= 3; }),
      btts_no_over25: percent(matches, function(match) { return !match.btts && match.totalGoals >= 3; })
    },
    halves: {
      btts_first: percent(matches, function(match) { return match.bttsFirst; }),
      over05_first: percent(matches, function(match) { return match.firstTotal >= 1; }),
      over15_first: percent(matches, function(match) { return match.firstTotal >= 2; }),
      over25_first: percent(matches, function(match) { return match.firstTotal >= 3; }),
      btts_second: percent(matches, function(match) { return match.bttsSecond; }),
      btts_both_halves: percent(matches, function(match) { return match.bttsFirst && match.bttsSecond; }),
      over05_second: percent(matches, function(match) { return match.secondTotal >= 1; }),
      over15_second: percent(matches, function(match) { return match.secondTotal >= 2; }),
      over25_second: percent(matches, function(match) { return match.secondTotal >= 3; }),
      under05_first: percent(matches, function(match) { return match.firstTotal < 1; }),
      under15_first: percent(matches, function(match) { return match.firstTotal < 2; }),
      under25_first: percent(matches, function(match) { return match.firstTotal < 3; }),
      under05_second: percent(matches, function(match) { return match.secondTotal < 1; }),
      under15_second: percent(matches, function(match) { return match.secondTotal < 2; }),
      under25_second: percent(matches, function(match) { return match.secondTotal < 3; })
    }
  };
}

function avg(matches, key) {
  const values = matches.map(function(match) { return match[key]; }).filter(function(value) { return value !== null && Number.isFinite(Number(value)); });
  if (!values.length) return null;
  return Number((values.reduce(function(total, value) { return total + Number(value); }, 0) / values.length).toFixed(2));
}

function percent(matches, predicate) {
  const valid = matches.filter(function(match) { return match.totalGoals !== null; });
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

function hasScore(value) {
  return number(value) !== null;
}
