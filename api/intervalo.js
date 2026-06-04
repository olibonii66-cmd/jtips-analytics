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
      endpoint: "intervalo",
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
    return res.status(500).json({ ok: false, error: "Erro interno ao buscar dados de intervalo.", detail: error.message });
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
      return isVenue && !isCurrent && matchDate && matchDate < cutoff && isComplete(match) && hasHalfData(match);
    })
    .sort(function(a, b) { return Number(b.date_unix || 0) - Number(a.date_unix || 0); })
    .map(function(match) { return normalizeMatch(match, teamId); });
}

function isComplete(match) {
  const status = String(match.status || match.game_status || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["complete", "completed", "finished", "ft", "fulltime", "final"].includes(status)) return true;
  return number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals) !== null && number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals) !== null;
}

function hasHalfData(match) {
  return number(match.ht_goals_team_a ?? match.homeGoalsHT ?? match.home_goals_ht) !== null || number(match.ht_goals_team_b ?? match.awayGoalsHT ?? match.away_goals_ht) !== null;
}

function normalizeMatch(match, teamId) {
  const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
  const isHome = homeId === String(teamId);
  const homeGoals = number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals);
  const awayGoals = number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals);
  const htHome = number(match.ht_goals_team_a ?? match.homeGoalsHT ?? match.home_goals_ht);
  const htAway = number(match.ht_goals_team_b ?? match.awayGoalsHT ?? match.away_goals_ht);
  const shHomeRaw = number(match.goals_2hg_team_a ?? match.homeGoals2H ?? match.home_goals_2h);
  const shAwayRaw = number(match.goals_2hg_team_b ?? match.awayGoals2H ?? match.away_goals_2h);
  const shHome = shHomeRaw === null && homeGoals !== null && htHome !== null ? Math.max(homeGoals - htHome, 0) : shHomeRaw;
  const shAway = shAwayRaw === null && awayGoals !== null && htAway !== null ? Math.max(awayGoals - htAway, 0) : shAwayRaw;
  const firstFor = isHome ? htHome : htAway;
  const firstAgainst = isHome ? htAway : htHome;
  const secondFor = isHome ? shHome : shAway;
  const secondAgainst = isHome ? shAway : shHome;

  return {
    firstFor,
    firstAgainst,
    secondFor,
    secondAgainst,
    firstWin: firstFor !== null && firstAgainst !== null ? firstFor > firstAgainst : null,
    firstDraw: firstFor !== null && firstAgainst !== null ? firstFor === firstAgainst : null,
    firstLoss: firstFor !== null && firstAgainst !== null ? firstFor < firstAgainst : null,
    secondWin: secondFor !== null && secondAgainst !== null ? secondFor > secondAgainst : null,
    secondDraw: secondFor !== null && secondAgainst !== null ? secondFor === secondAgainst : null,
    secondLoss: secondFor !== null && secondAgainst !== null ? secondFor < secondAgainst : null
  };
}

function summarize(matches) {
  return {
    count: matches.length,
    ht_ppg: ppg(matches, "firstWin", "firstDraw"),
    wdl: {
      win_first: percent(matches, function(match) { return match.firstWin; }),
      win_second: percent(matches, function(match) { return match.secondWin; }),
      draw_first: percent(matches, function(match) { return match.firstDraw; }),
      draw_second: percent(matches, function(match) { return match.secondDraw; }),
      loss_first: percent(matches, function(match) { return match.firstLoss; }),
      loss_second: percent(matches, function(match) { return match.secondLoss; })
    }
  };
}

function ppg(matches, winKey, drawKey) {
  const valid = matches.filter(function(match) { return match[winKey] !== null && match[drawKey] !== null; });
  if (!valid.length) return null;
  const points = valid.reduce(function(total, match) {
    if (match[winKey]) return total + 3;
    if (match[drawKey]) return total + 1;
    return total;
  }, 0);
  return Number((points / valid.length).toFixed(2));
}

function percent(matches, predicate) {
  const valid = matches.filter(function(match) { return match.firstWin !== null || match.secondWin !== null; });
  if (!valid.length) return null;
  return Math.round((valid.filter(predicate).length / valid.length) * 100);
}

function number(value) {
  if (value === undefined || value === null || value === "" || value === -1 || value === "-1") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
