export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY não configurada na Vercel."
    });
  }

  const matchId = String(req.query.match_id || req.query.matchId || req.query.id || "").trim();

  const seasonId = String(
    req.query.season_id ||
    req.query.league_id ||
    req.query.competition_id ||
    req.query.seasonId ||
    req.query.leagueId ||
    ""
  ).trim();

  if (!matchId) {
    return res.status(400).json({
      ok: false,
      error: "Informe o match_id da partida."
    });
  }

  if (!seasonId) {
    return res.status(400).json({
      ok: false,
      error: "Informe o season_id ou league_id da competição."
    });
  }

  try {
    const [
      leagueMatchesResult,
      leagueTablesResult,
      leagueTeamsResult,
      leaguePlayersResult,
      leagueRefereesResult
    ] = await Promise.all([
      fetchFootyStats("league-matches", {
        key: apiKey,
        league_id: seasonId
      }),
      fetchFootyStats("league-tables", {
        key: apiKey,
        league_id: seasonId
      }),
      fetchFootyStats("league-teams", {
        key: apiKey,
        league_id: seasonId
      }),
      fetchFootyStats("league-players", {
        key: apiKey,
        league_id: seasonId
      }),
      fetchFootyStats("league-referees", {
        key: apiKey,
        league_id: seasonId
      })
    ]);

    const matches = extractArray(leagueMatchesResult.data);
    const teams = extractArray(leagueTeamsResult.data);
    const players = extractArray(leaguePlayersResult.data);
    const referees = extractArray(leagueRefereesResult.data);
    const table = extractLeagueTable(leagueTablesResult.data);

    const match = matches.find(function(item) {
      return String(item.id || item.match_id || "") === String(matchId);
    });

    if (!match) {
      return res.status(404).json({
        ok: false,
        error: "Partida não encontrada dentro do league-matches.",
        input: {
          match_id: matchId,
          season_id: seasonId
        },
        diagnostics: {
          league_matches_ok: leagueMatchesResult.ok,
          league_matches_count: matches.length,
          first_match_id: matches[0] ? matches[0].id : null
        }
      });
    }

    const homeId = String(match.homeID || match.home_id || match.team_a_id || "");
    const awayId = String(match.awayID || match.away_id || match.team_b_id || "");

    const homeTeam = findTeamById(teams, homeId);
    const awayTeam = findTeamById(teams, awayId);

    const homePlayers = filterPlayersByTeam(players, homeId);
    const awayPlayers = filterPlayersByTeam(players, awayId);

    const referee = findRefereeById(referees, match.refereeID || match.referee_id);

    const homeTable = findTableTeam(table, homeId, match.home_name);
    const awayTable = findTableTeam(table, awayId, match.away_name);

    const payload = buildCompleteMatchPayload({
      match,
      seasonId,
      homeId,
      awayId,
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers,
      referee,
      homeTable,
      awayTable,
      table,
      diagnostics: {
        league_matches_ok: leagueMatchesResult.ok,
        league_tables_ok: leagueTablesResult.ok,
        league_teams_ok: leagueTeamsResult.ok,
        league_players_ok: leaguePlayersResult.ok,
        league_referees_ok: leagueRefereesResult.ok,
        league_matches_count: matches.length,
        league_table_count: table.length,
        league_teams_count: teams.length,
        league_players_count: players.length,
        league_referees_count: referees.length
      }
    });

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "partida-completa",
      input: {
        match_id: matchId,
        season_id: seasonId
      },
      data: payload
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao montar partida completa.",
      detail: error.message
    });
  }
}

async function fetchFootyStats(endpoint, params) {
  const url = buildUrl(`https://api.football-data-api.com/${endpoint}`, params);

  try {
    const response = await fetch(url, {
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

    return {
      ok: response.ok && !parseError,
      status: response.status,
      endpoint,
      data: json,
      parse_error: parseError,
      url: maskApiKey(url)
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      endpoint,
      data: null,
      error: error.message,
      url: maskApiKey(url)
    };
  }
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

function extractArray(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.matches)) return payload.matches;
  if (Array.isArray(payload.teams)) return payload.teams;
  if (Array.isArray(payload.players)) return payload.players;
  if (Array.isArray(payload.referees)) return payload.referees;
  if (Array.isArray(payload.table)) return payload.table;
  if (Array.isArray(payload.league_table)) return payload.league_table;

  if (payload.data && Array.isArray(payload.data.matches)) return payload.data.matches;
  if (payload.data && Array.isArray(payload.data.teams)) return payload.data.teams;
  if (payload.data && Array.isArray(payload.data.players)) return payload.data.players;
  if (payload.data && Array.isArray(payload.data.referees)) return payload.data.referees;
  if (payload.data && Array.isArray(payload.data.table)) return payload.data.table;
  if (payload.data && Array.isArray(payload.data.league_table)) return payload.data.league_table;

  return [];
}

function extractLeagueTable(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.table)) return payload.table;
  if (Array.isArray(payload.league_table)) return payload.league_table;
  if (Array.isArray(payload.all_matches_table_overall)) return payload.all_matches_table_overall;

  if (payload.data && Array.isArray(payload.data.table)) return payload.data.table;
  if (payload.data && Array.isArray(payload.data.league_table)) return payload.data.league_table;
  if (payload.data && Array.isArray(payload.data.all_matches_table_overall)) {
    return payload.data.all_matches_table_overall;
  }

  if (payload.data && typeof payload.data === "object") {
    const possibleArrays = Object.keys(payload.data)
      .map(function(key) {
        return payload.data[key];
      })
      .filter(Array.isArray);

    if (possibleArrays.length) {
      return possibleArrays[0];
    }
  }

  return [];
}

function findTeamById(teams, teamId) {
  if (!teamId) return null;

  return teams.find(function(team) {
    return String(
      team.id ||
      team.team_id ||
      team.teamID ||
      team.club_id ||
      team.clubID ||
      ""
    ) === String(teamId);
  }) || null;
}

function filterPlayersByTeam(players, teamId) {
  if (!teamId) return [];

  return players.filter(function(player) {
    const playerTeamId = String(
      player.team_id ||
      player.teamID ||
      player.club_id ||
      player.clubID ||
      player.current_team_id ||
      player.currentTeamID ||
      ""
    );

    return playerTeamId === String(teamId);
  });
}

function findRefereeById(referees, refereeId) {
  if (!refereeId) return null;

  return referees.find(function(referee) {
    return String(
      referee.id ||
      referee.referee_id ||
      referee.refereeID ||
      ""
    ) === String(refereeId);
  }) || null;
}

function findTableTeam(table, teamId, teamName) {
  if (!table.length) return null;

  const byId = table.find(function(row) {
    return String(
      row.id ||
      row.team_id ||
      row.teamID ||
      row.club_id ||
      row.clubID ||
      ""
    ) === String(teamId);
  });

  if (byId) return byId;

  const normalizedName = normalizeText(teamName);

  return table.find(function(row) {
    const rowName = normalizeText(
      row.name ||
      row.team_name ||
      row.teamName ||
      row.club_name ||
      ""
    );

    return rowName && normalizedName && rowName === normalizedName;
  }) || null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCompleteMatchPayload(input) {
  const {
    match,
    seasonId,
    homeId,
    awayId,
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    referee,
    homeTable,
    awayTable,
    table,
    diagnostics
  } = input;

  const homeName =
    match.home_name ||
    match.homeName ||
    match.team_a_name ||
    match.home_team_name ||
    match.home ||
    homeTeam?.name ||
    homeTeam?.team_name ||
    `Mandante ${homeId}`;

  const awayName =
    match.away_name ||
    match.awayName ||
    match.team_b_name ||
    match.away_team_name ||
    match.away ||
    awayTeam?.name ||
    awayTeam?.team_name ||
    `Visitante ${awayId}`;

  return {
    ids: {
      match_id: match.id || match.match_id || null,
      season_id: seasonId,
      home_id: homeId || null,
      away_id: awayId || null,
      referee_id: match.refereeID || match.referee_id || null
    },

    status: {
      raw: match.status || match.game_status || null,
      normalized: normalizeStatus(match.status || match.game_status, match),
      date_unix: match.date_unix || null,
      date_iso: match.date_unix ? new Date(Number(match.date_unix) * 1000).toISOString() : null
    },

    league: {
      competition_id: match.competition_id || seasonId,
      season: match.season || null,
      game_week: match.game_week || null,
      round_id: match.roundID || match.round_id || null
    },

    teams: {
      home: {
        id: homeId || null,
        name: homeName,
        image: normalizeImageUrl(match.home_image || homeTeam?.image || homeTeam?.logo || ""),
        url: match.home_url || homeTeam?.url || null,
        ppg: cleanValue(match.home_ppg),
        pre_match_ppg: cleanValue(match.pre_match_home_ppg),
        overall_pre_match_ppg: cleanValue(match.pre_match_teamA_overall_ppg),
        table: homeTable,
        raw: homeTeam
      },
      away: {
        id: awayId || null,
        name: awayName,
        image: normalizeImageUrl(match.away_image || awayTeam?.image || awayTeam?.logo || ""),
        url: match.away_url || awayTeam?.url || null,
        ppg: cleanValue(match.away_ppg),
        pre_match_ppg: cleanValue(match.pre_match_away_ppg),
        overall_pre_match_ppg: cleanValue(match.pre_match_teamB_overall_ppg),
        table: awayTable,
        raw: awayTeam
      }
    },

    score: {
      home_goals: cleanValue(match.homeGoalCount),
      away_goals: cleanValue(match.awayGoalCount),
      total_goals: cleanValue(match.totalGoalCount || match.overallGoalCount),
      winner_team_id: cleanValue(match.winningTeam),
      home_goal_timings: match.homeGoals_timings || match.homeGoals || [],
      away_goal_timings: match.awayGoals_timings || match.awayGoals || [],
      over05: booleanOrValue(match.over05),
      over15: booleanOrValue(match.over15),
      over25: booleanOrValue(match.over25),
      over35: booleanOrValue(match.over35),
      over45: booleanOrValue(match.over45),
      over55: booleanOrValue(match.over55),
      btts: booleanOrValue(match.btts)
    },

    goals: {
      full_time: {
        home: cleanValue(match.homeGoalCount),
        away: cleanValue(match.awayGoalCount),
        total: cleanValue(match.totalGoalCount || match.overallGoalCount)
      },
      first_half: {
        home: cleanValue(match.ht_goals_team_a),
        away: cleanValue(match.ht_goals_team_b),
        total: cleanValue(match.HTGoalCount)
      },
      second_half: {
        home: cleanValue(match.goals_2hg_team_a),
        away: cleanValue(match.goals_2hg_team_b),
        total: cleanValue(match.GoalCount_2hg)
      },
      timings: {
        recorded: cleanValue(match.goal_timings_recorded),
        disabled: cleanValue(match.goalTimingDisabled),
        home: match.homeGoals_timings || match.homeGoals || [],
        away: match.awayGoals_timings || match.awayGoals || []
      },
      minute_ranges: {
        home_0_10: cleanValue(match.team_a_0_10_min_goals),
        away_0_10: cleanValue(match.team_b_0_10_min_goals)
      }
    },

    xg: {
      actual: {
        home: cleanValue(match.team_a_xg),
        away: cleanValue(match.team_b_xg),
        total: cleanValue(match.total_xg)
      },
      prematch: {
        home: cleanValue(match.team_a_xg_prematch),
        away: cleanValue(match.team_b_xg_prematch),
        total: cleanValue(match.total_xg_prematch)
      }
    },

    corners: {
      full_time: {
        home: cleanValue(match.team_a_corners),
        away: cleanValue(match.team_b_corners),
        total: cleanValue(match.totalCornerCount)
      },
      first_half: {
        home: cleanValue(match.team_a_fh_corners),
        away: cleanValue(match.team_b_fh_corners),
        total: cleanValue(match.corner_fh_count)
      },
      second_half: {
        home: cleanValue(match.team_a_2h_corners),
        away: cleanValue(match.team_b_2h_corners),
        total: cleanValue(match.corner_2h_count)
      },
      potential: {
        total: cleanValue(match.corners_potential),
        over85: cleanValue(match.corners_o85_potential),
        over95: cleanValue(match.corners_o95_potential),
        over105: cleanValue(match.corners_o105_potential)
      },
      timings: {
        recorded: cleanValue(match.corner_timings_recorded),
        home_0_10: cleanValue(match.team_a_corners_0_10_min),
        away_0_10: cleanValue(match.team_b_corners_0_10_min)
      }
    },

    cards: {
      full_time: {
        home_total: cleanValue(match.team_a_cards_num),
        away_total: cleanValue(match.team_b_cards_num),
        total: sumClean(match.team_a_cards_num, match.team_b_cards_num),
        home_yellow: cleanValue(match.team_a_yellow_cards),
        away_yellow: cleanValue(match.team_b_yellow_cards),
        home_red: cleanValue(match.team_a_red_cards),
        away_red: cleanValue(match.team_b_red_cards)
      },
      first_half: {
        home: cleanValue(match.team_a_fh_cards),
        away: cleanValue(match.team_b_fh_cards),
        total: cleanValue(match.total_fh_cards)
      },
      second_half: {
        home: cleanValue(match.team_a_2h_cards),
        away: cleanValue(match.team_b_2h_cards),
        total: cleanValue(match.total_2h_cards)
      },
      potential: {
        total: cleanValue(match.cards_potential)
      },
      timings: {
        recorded: cleanValue(match.card_timings_recorded),
        home_0_10: cleanValue(match.team_a_cards_0_10_min),
        away_0_10: cleanValue(match.team_b_cards_0_10_min)
      }
    },

    shots: {
      full_time: {
        home_total: cleanValue(match.team_a_shots),
        away_total: cleanValue(match.team_b_shots),
        total: sumClean(match.team_a_shots, match.team_b_shots),
        home_on_target: cleanValue(match.team_a_shotsOnTarget),
        away_on_target: cleanValue(match.team_b_shotsOnTarget),
        total_on_target: sumClean(match.team_a_shotsOnTarget, match.team_b_shotsOnTarget),
        home_off_target: cleanValue(match.team_a_shotsOffTarget),
        away_off_target: cleanValue(match.team_b_shotsOffTarget),
        total_off_target: sumClean(match.team_a_shotsOffTarget, match.team_b_shotsOffTarget)
      },
      attacks: {
        home_attacks: cleanValue(match.team_a_attacks),
        away_attacks: cleanValue(match.team_b_attacks),
        home_dangerous: cleanValue(match.team_a_dangerous_attacks),
        away_dangerous: cleanValue(match.team_b_dangerous_attacks),
        recorded: cleanValue(match.attacks_recorded)
      },
      possession: {
        home: cleanValue(match.team_a_possession),
        away: cleanValue(match.team_b_possession)
      }
    },

    discipline_and_flow: {
      fouls: {
        home: cleanValue(match.team_a_fouls),
        away: cleanValue(match.team_b_fouls),
        total: sumClean(match.team_a_fouls, match.team_b_fouls)
      },
      offsides: {
        home: cleanValue(match.team_a_offsides),
        away: cleanValue(match.team_b_offsides),
        total: sumClean(match.team_a_offsides, match.team_b_offsides),
        potential: cleanValue(match.offsides_potential)
      },
      throwins: {
        recorded: cleanValue(match.throwins_recorded),
        home: cleanValue(match.team_a_throwins),
        away: cleanValue(match.team_b_throwins),
        total: sumClean(match.team_a_throwins, match.team_b_throwins)
      },
      freekicks: {
        recorded: cleanValue(match.freekicks_recorded),
        home: cleanValue(match.team_a_freekicks),
        away: cleanValue(match.team_b_freekicks),
        total: sumClean(match.team_a_freekicks, match.team_b_freekicks)
      },
      goalkicks: {
        recorded: cleanValue(match.goalkicks_recorded),
        home: cleanValue(match.team_a_goalkicks),
        away: cleanValue(match.team_b_goalkicks),
        total: sumClean(match.team_a_goalkicks, match.team_b_goalkicks)
      }
    },

    penalties: {
      home_won: cleanValue(match.team_a_penalties_won),
      away_won: cleanValue(match.team_b_penalties_won),
      home_goals: cleanValue(match.team_a_penalty_goals),
      away_goals: cleanValue(match.team_b_penalty_goals),
      home_missed: cleanValue(match.team_a_penalty_missed),
      away_missed: cleanValue(match.team_b_penalty_missed),
      recorded: cleanValue(match.pens_recorded)
    },

    potentials: {
      goals: {
        over05: cleanValue(match.o05_potential),
        over15: cleanValue(match.o15_potential),
        over25: cleanValue(match.o25_potential),
        over35: cleanValue(match.o35_potential),
        over45: cleanValue(match.o45_potential),
        under05: cleanValue(match.u05_potential),
        under15: cleanValue(match.u15_potential),
        under25: cleanValue(match.u25_potential),
        under35: cleanValue(match.u35_potential),
        under45: cleanValue(match.u45_potential),
        avg: cleanValue(match.avg_potential)
      },
      btts: {
        full_time: cleanValue(match.btts_potential),
        first_half: cleanValue(match.btts_fhg_potential),
        second_half: cleanValue(match.btts_2hg_potential)
      },
      corners: {
        total: cleanValue(match.corners_potential),
        over85: cleanValue(match.corners_o85_potential),
        over95: cleanValue(match.corners_o95_potential),
        over105: cleanValue(match.corners_o105_potential)
      },
      cards: {
        total: cleanValue(match.cards_potential)
      },
      offsides: {
        total: cleanValue(match.offsides_potential)
      }
    },

    odds: {
      result: {
        home: cleanOdd(match.odds_ft_1),
        draw: cleanOdd(match.odds_ft_x),
        away: cleanOdd(match.odds_ft_2)
      },
      goals: {
        over05: cleanOdd(match.odds_ft_over05),
        over15: cleanOdd(match.odds_ft_over15),
        over25: cleanOdd(match.odds_ft_over25),
        over35: cleanOdd(match.odds_ft_over35),
        over45: cleanOdd(match.odds_ft_over45),
        under05: cleanOdd(match.odds_ft_under05),
        under15: cleanOdd(match.odds_ft_under15),
        under25: cleanOdd(match.odds_ft_under25),
        under35: cleanOdd(match.odds_ft_under35),
        under45: cleanOdd(match.odds_ft_under45)
      },
      btts: {
        yes: cleanOdd(match.odds_btts_yes),
        no: cleanOdd(match.odds_btts_no)
      },
      clean_sheet: {
        home_yes: cleanOdd(match.odds_team_a_cs_yes),
        home_no: cleanOdd(match.odds_team_a_cs_no),
        away_yes: cleanOdd(match.odds_team_b_cs_yes),
        away_no: cleanOdd(match.odds_team_b_cs_no)
      },
      double_chance: {
        home_or_draw: cleanOdd(match.odds_doublechance_1x),
        home_or_away: cleanOdd(match.odds_doublechance_12),
        draw_or_away: cleanOdd(match.odds_doublechance_x2)
      },
      half_time: {
        result_home: cleanOdd(match.odds_1st_half_result_1),
        result_draw: cleanOdd(match.odds_1st_half_result_x),
        result_away: cleanOdd(match.odds_1st_half_result_2),
        over05: cleanOdd(match.odds_1st_half_over05),
        over15: cleanOdd(match.odds_1st_half_over15),
        over25: cleanOdd(match.odds_1st_half_over25),
        over35: cleanOdd(match.odds_1st_half_over35),
        under05: cleanOdd(match.odds_1st_half_under05),
        under15: cleanOdd(match.odds_1st_half_under15),
        under25: cleanOdd(match.odds_1st_half_under25),
        under35: cleanOdd(match.odds_1st_half_under35)
      },
      second_half: {
        result_home: cleanOdd(match.odds_2nd_half_result_1),
        result_draw: cleanOdd(match.odds_2nd_half_result_x),
        result_away: cleanOdd(match.odds_2nd_half_result_2),
        over05: cleanOdd(match.odds_2nd_half_over05),
        over15: cleanOdd(match.odds_2nd_half_over15),
        over25: cleanOdd(match.odds_2nd_half_over25),
        over35: cleanOdd(match.odds_2nd_half_over35),
        under05: cleanOdd(match.odds_2nd_half_under05),
        under15: cleanOdd(match.odds_2nd_half_under15),
        under25: cleanOdd(match.odds_2nd_half_under25),
        under35: cleanOdd(match.odds_2nd_half_under35)
      },
      corners: {
        over75: cleanOdd(match.odds_corners_over_75),
        over85: cleanOdd(match.odds_corners_over_85),
        over95: cleanOdd(match.odds_corners_over_95),
        over105: cleanOdd(match.odds_corners_over_105),
        over115: cleanOdd(match.odds_corners_over_115),
        under75: cleanOdd(match.odds_corners_under_75),
        under85: cleanOdd(match.odds_corners_under_85),
        under95: cleanOdd(match.odds_corners_under_95),
        under105: cleanOdd(match.odds_corners_under_105),
        under115: cleanOdd(match.odds_corners_under_115),
        home: cleanOdd(match.odds_corners_1),
        draw: cleanOdd(match.odds_corners_x),
        away: cleanOdd(match.odds_corners_2)
      },
      other: {
        win_to_nil_home: cleanOdd(match.odds_win_to_nil_1),
        win_to_nil_away: cleanOdd(match.odds_win_to_nil_2),
        dnb_home: cleanOdd(match.odds_dnb_1),
        dnb_away: cleanOdd(match.odds_dnb_2)
      }
    },

    venue: {
      stadium_name: cleanText(match.stadium_name),
      stadium_location: cleanText(match.stadium_location),
      attendance: cleanValue(match.attendance)
    },

    referee: {
      id: match.refereeID || match.referee_id || null,
      raw: referee
    },

    players: {
      home: sortPlayers(homePlayers),
      away: sortPlayers(awayPlayers)
    },

    league_table: {
      home: homeTable,
      away: awayTable,
      all: table
    },

    raw: {
      match,
      home_team: homeTeam,
      away_team: awayTeam
    },

    diagnostics
  };
}

function normalizeStatus(status, match) {
  const value = String(status || "").toLowerCase().trim();

  if (
    value === "complete" ||
    value === "completed" ||
    value === "finished" ||
    value === "final" ||
    value === "ft"
  ) {
    return "done";
  }

  const unix = match.date_unix;

  if (unix && Number.isFinite(Number(unix))) {
    const matchTime = Number(unix) * 1000;

    if (matchTime > Date.now()) {
      return "pre";
    }
  }

  return "pre";
}

function normalizeImageUrl(value) {
  if (!value) return "";

  const clean = String(value).trim();

  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
  if (clean.startsWith("//")) return `https:${clean}`;
  if (clean.startsWith("/img/")) return `https://cdn.footystats.org${clean}`;
  if (clean.startsWith("img/")) return `https://cdn.footystats.org/${clean}`;
  if (clean.startsWith("/teams/")) return `https://cdn.footystats.org/img${clean}`;
  if (clean.startsWith("teams/")) return `https://cdn.footystats.org/img/${clean}`;

  return `https://cdn.footystats.org/img/${clean.replace(/^\/+/, "")}`;
}

function cleanValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === -1 ||
    value === "-1"
  ) {
    return null;
  }

  return value;
}

function cleanText(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === -1 ||
    value === "-1"
  ) {
    return "";
  }

  return String(value);
}

function cleanOdd(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === -1 ||
    value === "-1" ||
    value === 0 ||
    value === "0"
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return Number(number.toFixed(2));
}

function sumClean(a, b) {
  const first = cleanValue(a);
  const second = cleanValue(b);

  if (first === null && second === null) return null;

  return Number(first || 0) + Number(second || 0);
}

function booleanOrValue(value) {
  if (value === true) return true;
  if (value === false) return false;

  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;

  return cleanValue(value);
}

function sortPlayers(players) {
  return players
    .map(normalizePlayer)
    .sort(function(a, b) {
      const goalsDiff = Number(b.goals || 0) - Number(a.goals || 0);
      if (goalsDiff !== 0) return goalsDiff;

      return Number(b.minutes || 0) - Number(a.minutes || 0);
    });
}

function normalizePlayer(player) {
  return {
    id: player.id || player.player_id || player.playerID || null,
    name: player.full_name || player.known_as || player.name || player.player_name || "Jogador",
    position: player.position || player.position_short || "",
    age: cleanValue(player.age),
    nationality: player.nationality || player.country || "",
    appearances: cleanValue(player.appearances || player.apps || player.matches),
    minutes: cleanValue(player.minutes || player.minutes_played),
    goals: cleanValue(player.goals_overall || player.goals || player.total_goals),
    assists: cleanValue(player.assists_overall || player.assists || player.total_assists),
    cards: cleanValue(player.cards_overall || player.cards || player.yellow_cards),
    image: normalizeImageUrl(player.image || player.player_image || ""),
    raw: player
  };
}

function maskApiKey(url) {
  return String(url).replace(/key=([^&]+)/i, "key=***");
}
