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
      endpoint: "cartoes",
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
    return res.status(500).json({ ok: false, error: "Erro interno ao buscar dados de cartoes.", detail: error.message });
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
      return isVenue && !isCurrent && matchDate && matchDate < cutoff && isComplete(match) && hasCardData(match);
    })
    .sort(function(a, b) { return Number(b.date_unix || 0) - Number(a.date_unix || 0); })
    .map(function(match) { return normalizeMatch(match, teamId); });
}

function isComplete(match) {
  const status = String(match.status || match.game_status || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["complete", "completed", "finished", "ft", "fulltime", "final"].includes(status)) return true;
  return number(match.homeGoalCount ?? match.home_goals ?? match.team_a_goals) !== null && number(match.awayGoalCount ?? match.away_goals ?? match.team_b_goals) !== null;
}

function hasCardData(match) {
  return cardTotal(match, "home") !== null || cardTotal(match, "away") !== null;
}

function normalizeMatch(match, teamId) {
  const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
  const isHome = homeId === String(teamId);
  const homeCards = cardTotal(match, "home");
  const awayCards = cardTotal(match, "away");
  const totalCards = sum(homeCards, awayCards);
  const homeFirst = number(match.team_a_fh_cards ?? match.home_cards_1h);
  const awayFirst = number(match.team_b_fh_cards ?? match.away_cards_1h);
  const firstTotal = number(match.total_fh_cards ?? match.cards_1h) ?? sum(homeFirst, awayFirst);
  const homeSecondRaw = number(match.team_a_2h_cards ?? match.home_cards_2h);
  const awaySecondRaw = number(match.team_b_2h_cards ?? match.away_cards_2h);
  const homeSecond = homeSecondRaw === null && homeCards !== null && homeFirst !== null ? Math.max(homeCards - homeFirst, 0) : homeSecondRaw;
  const awaySecond = awaySecondRaw === null && awayCards !== null && awayFirst !== null ? Math.max(awayCards - awayFirst, 0) : awaySecondRaw;
  const secondTotal = number(match.total_2h_cards ?? match.cards_2h) ?? sum(homeSecond, awaySecond);
  const firstFor = isHome ? homeFirst : awayFirst;
  const firstAgainst = isHome ? awayFirst : homeFirst;
  const secondFor = isHome ? homeSecond : awaySecond;
  const secondAgainst = isHome ? awaySecond : homeSecond;

  return {
    for: isHome ? homeCards : awayCards,
    against: isHome ? awayCards : homeCards,
    total: totalCards,
    firstFor,
    firstAgainst,
    firstTotal,
    secondFor,
    secondAgainst,
    secondTotal,
    firstHadMore: firstFor !== null && firstAgainst !== null ? firstFor > firstAgainst : null,
    secondHadMore: secondFor !== null && secondAgainst !== null ? secondFor > secondAgainst : null
  };
}

function summarize(matches) {
  return {
    count: matches.length,
    avg_for: avg(matches, "for"),
    avg_against: avg(matches, "against"),
    avg_total: avg(matches, "total"),
    total: {
      over25: percent(matches, function(match) { return match.total > 2.5; }),
      over35: percent(matches, function(match) { return match.total > 3.5; }),
      over45: percent(matches, function(match) { return match.total > 4.5; }),
      over55: percent(matches, function(match) { return match.total > 5.5; }),
      over65: percent(matches, function(match) { return match.total > 6.5; })
    },
    team: {
      for_over05: percent(matches, function(match) { return match.for > 0.5; }),
      for_over15: percent(matches, function(match) { return match.for > 1.5; }),
      for_over25: percent(matches, function(match) { return match.for > 2.5; }),
      for_over35: percent(matches, function(match) { return match.for > 3.5; }),
      against_over05: percent(matches, function(match) { return match.against > 0.5; }),
      against_over15: percent(matches, function(match) { return match.against > 1.5; }),
      against_over25: percent(matches, function(match) { return match.against > 2.5; }),
      against_over35: percent(matches, function(match) { return match.against > 3.5; })
    },
    half: {
      avg_first_for: avg(matches, "firstFor"),
      avg_second_for: avg(matches, "secondFor"),
      avg_first_total: avg(matches, "firstTotal"),
      avg_second_total: avg(matches, "secondTotal"),
      first_had_more: percent(matches, function(match) { return match.firstHadMore === true; }),
      second_had_more: percent(matches, function(match) { return match.secondHadMore === true; }),
      first_for_over05: percent(matches, function(match) { return match.firstFor > 0.5; }),
      second_for_over05: percent(matches, function(match) { return match.secondFor > 0.5; }),
      first_total_under2: percent(matches, function(match) { return match.firstTotal < 2; }),
      second_total_under2: percent(matches, function(match) { return match.secondTotal < 2; }),
      first_total_2_3: percent(matches, function(match) { return match.firstTotal >= 2 && match.firstTotal <= 3; }),
      second_total_2_3: percent(matches, function(match) { return match.secondTotal >= 2 && match.secondTotal <= 3; }),
      first_total_over3: percent(matches, function(match) { return match.firstTotal > 3; }),
      second_total_over3: percent(matches, function(match) { return match.secondTotal > 3; })
    }
  };
}

function cardTotal(match, side) {
  if (side === "home") {
    const total = number(match.team_a_cards_num ?? match.home_cards);
    if (total !== null) return total;
    return sum(number(match.team_a_yellow_cards ?? match.home_yellow_cards), number(match.team_a_red_cards ?? match.home_red_cards));
  }

  const total = number(match.team_b_cards_num ?? match.away_cards);
  if (total !== null) return total;
  return sum(number(match.team_b_yellow_cards ?? match.away_yellow_cards), number(match.team_b_red_cards ?? match.away_red_cards));
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
