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
      endpoint: "chutes",
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
    return res.status(500).json({ ok: false, error: "Erro interno ao buscar dados de chutes.", detail: error.message });
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
      return isVenue && !isCurrent && matchDate && matchDate < cutoff && isComplete(match) && hasUsefulData(match);
    })
    .sort(function(a, b) { return Number(b.date_unix || 0) - Number(a.date_unix || 0); })
    .map(function(match) { return normalizeMatch(match, teamId); });
}

function isComplete(match) {
  const status = String(match.status || match.game_status || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["complete", "completed", "finished", "ft", "fulltime", "final"].includes(status)) return true;
  return number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals) !== null && number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals) !== null;
}

function hasUsefulData(match) {
  return number(match.team_a_shots ?? match.home_shots) !== null ||
    number(match.team_b_shots ?? match.away_shots) !== null ||
    number(match.team_a_fouls ?? match.home_fouls) !== null ||
    number(match.team_a_freekicks ?? match.home_freekicks) !== null ||
    number(match.team_a_throwins ?? match.home_throwins) !== null;
}

function normalizeMatch(match, teamId) {
  const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
  const isHome = homeId === String(teamId);
  const homeGoals = number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals);
  const awayGoals = number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals);
  const homeShots = number(match.team_a_shots ?? match.home_shots);
  const awayShots = number(match.team_b_shots ?? match.away_shots);
  const homeOnTarget = number(match.team_a_shotsOnTarget ?? match.home_shots_on_target);
  const awayOnTarget = number(match.team_b_shotsOnTarget ?? match.away_shots_on_target);
  const homeOffTarget = number(match.team_a_shotsOffTarget ?? match.home_shots_off_target);
  const awayOffTarget = number(match.team_b_shotsOffTarget ?? match.away_shots_off_target);
  const totalShots = sum(homeShots, awayShots);
  const totalOnTarget = sum(homeOnTarget, awayOnTarget);
  const totalOffsides = sum(number(match.team_a_offsides), number(match.team_b_offsides));
  const totalFreekicks = sum(number(match.team_a_freekicks), number(match.team_b_freekicks));
  const totalGoalkicks = sum(number(match.team_a_goalkicks), number(match.team_b_goalkicks));
  const totalThrowins = sum(number(match.team_a_throwins), number(match.team_b_throwins));
  const shotsFor = isHome ? homeShots : awayShots;
  const shotsAgainst = isHome ? awayShots : homeShots;
  const shotsOnTarget = isHome ? homeOnTarget : awayOnTarget;
  const shotsOffTarget = isHome ? homeOffTarget : awayOffTarget;
  const goalsFor = isHome ? homeGoals : awayGoals;
  const goalsAgainst = isHome ? awayGoals : homeGoals;

  return {
    shotsFor,
    shotsAgainst,
    shotsTotal: totalShots,
    shotsOnTarget,
    shotsOnTargetTotal: totalOnTarget,
    shotsOffTarget,
    goalsFor,
    goalsAgainst,
    conversionRate: shotsFor && goalsFor !== null ? (goalsFor / shotsFor) * 100 : null,
    shotsPerGoalScored: goalsFor > 0 && shotsFor !== null ? shotsFor / goalsFor : null,
    offsides: isHome ? number(match.team_a_offsides) : number(match.team_b_offsides),
    offsidesTotal: totalOffsides,
    foulsCommitted: isHome ? number(match.team_a_fouls) : number(match.team_b_fouls),
    fouledAgainst: isHome ? number(match.team_b_fouls) : number(match.team_a_fouls),
    possession: isHome ? number(match.team_a_possession) : number(match.team_b_possession),
    draw: homeGoals !== null && awayGoals !== null ? homeGoals === awayGoals : null,
    freekicksTotal: totalFreekicks,
    goalkicksTotal: totalGoalkicks,
    throwinsTotal: totalThrowins
  };
}

function summarize(matches) {
  return {
    count: matches.length,
    team_shots: {
      shots_avg: avg(matches, "shotsFor"),
      conversion_rate: avg(matches, "conversionRate"),
      shots_on_target_avg: avg(matches, "shotsOnTarget"),
      shots_off_target_avg: avg(matches, "shotsOffTarget"),
      shots_per_goal: avg(matches, "shotsPerGoalScored"),
      over105: percent(matches, function(match) { return match.shotsFor > 10.5; }),
      over115: percent(matches, function(match) { return match.shotsFor > 11.5; }),
      over125: percent(matches, function(match) { return match.shotsFor > 12.5; }),
      over135: percent(matches, function(match) { return match.shotsFor > 13.5; }),
      over145: percent(matches, function(match) { return match.shotsFor > 14.5; }),
      over155: percent(matches, function(match) { return match.shotsFor > 15.5; }),
      on_target_over35: percent(matches, function(match) { return match.shotsOnTarget > 3.5; }),
      on_target_over45: percent(matches, function(match) { return match.shotsOnTarget > 4.5; }),
      on_target_over55: percent(matches, function(match) { return match.shotsOnTarget > 5.5; }),
      on_target_over65: percent(matches, function(match) { return match.shotsOnTarget > 6.5; })
    },
    match_shots: {
      over235: percent(matches, function(match) { return match.shotsTotal > 23.5; }),
      over245: percent(matches, function(match) { return match.shotsTotal > 24.5; }),
      over255: percent(matches, function(match) { return match.shotsTotal > 25.5; }),
      over265: percent(matches, function(match) { return match.shotsTotal > 26.5; }),
      on_target_over75: percent(matches, function(match) { return match.shotsOnTargetTotal > 7.5; }),
      on_target_over85: percent(matches, function(match) { return match.shotsOnTargetTotal > 8.5; }),
      on_target_over95: percent(matches, function(match) { return match.shotsOnTargetTotal > 9.5; })
    },
    offsides: {
      avg: avg(matches, "offsides"),
      over25: percent(matches, function(match) { return match.offsidesTotal > 2.5; }),
      over35: percent(matches, function(match) { return match.offsidesTotal > 3.5; })
    },
    misc: {
      fouls_committed_avg: avg(matches, "foulsCommitted"),
      fouled_against_avg: avg(matches, "fouledAgainst"),
      possession_avg: avg(matches, "possession"),
      draw_ft: percent(matches, function(match) { return match.draw === true; })
    },
    flow: {
      freekicks_avg: avg(matches, "freekicksTotal"),
      freekicks_over205: percent(matches, function(match) { return match.freekicksTotal > 20.5; }),
      freekicks_over215: percent(matches, function(match) { return match.freekicksTotal > 21.5; }),
      freekicks_over225: percent(matches, function(match) { return match.freekicksTotal > 22.5; }),
      freekicks_over235: percent(matches, function(match) { return match.freekicksTotal > 23.5; }),
      freekicks_over245: percent(matches, function(match) { return match.freekicksTotal > 24.5; }),
      freekicks_over255: percent(matches, function(match) { return match.freekicksTotal > 25.5; }),
      goalkicks_avg: avg(matches, "goalkicksTotal"),
      goalkicks_over85: percent(matches, function(match) { return match.goalkicksTotal > 8.5; }),
      goalkicks_over95: percent(matches, function(match) { return match.goalkicksTotal > 9.5; }),
      goalkicks_over105: percent(matches, function(match) { return match.goalkicksTotal > 10.5; }),
      goalkicks_over115: percent(matches, function(match) { return match.goalkicksTotal > 11.5; }),
      goalkicks_over125: percent(matches, function(match) { return match.goalkicksTotal > 12.5; }),
      goalkicks_over135: percent(matches, function(match) { return match.goalkicksTotal > 13.5; }),
      throwins_avg: avg(matches, "throwinsTotal"),
      throwins_over375: percent(matches, function(match) { return match.throwinsTotal > 37.5; }),
      throwins_over385: percent(matches, function(match) { return match.throwinsTotal > 38.5; }),
      throwins_over395: percent(matches, function(match) { return match.throwinsTotal > 39.5; }),
      throwins_over405: percent(matches, function(match) { return match.throwinsTotal > 40.5; }),
      throwins_over415: percent(matches, function(match) { return match.throwinsTotal > 41.5; }),
      throwins_over425: percent(matches, function(match) { return match.throwinsTotal > 42.5; }),
      throwins_over435: percent(matches, function(match) { return match.throwinsTotal > 43.5; }),
      throwins_over445: percent(matches, function(match) { return match.throwinsTotal > 44.5; })
    }
  };
}

function avg(matches, key) {
  const values = matches.map(function(match) { return match[key]; }).filter(function(value) { return value !== null && Number.isFinite(Number(value)); });
  if (!values.length) return null;
  return Number((values.reduce(function(total, value) { return total + Number(value); }, 0) / values.length).toFixed(2));
}

function percent(matches, predicate) {
  const valid = matches.filter(function(match) { return match.shotsFor !== null || match.freekicksTotal !== null || match.throwinsTotal !== null; });
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
