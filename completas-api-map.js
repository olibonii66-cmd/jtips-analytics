(function() {
  function hasValue(value) {
    return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1";
  }

  function cleanNumber(value) {
    if (!hasValue(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getRawMatch(data) {
    return data?.raw?.match_details || data?.raw?.match || selectedMatch?.raw || null;
  }

  function sameId(left, right) {
    return hasValue(left) && hasValue(right) && String(left) === String(right);
  }

  function normalizePreviousMatch(row, data) {
    const homeId = data?.ids?.home_id || selectedMatch?.raw?.homeID;
    const awayId = data?.ids?.away_id || selectedMatch?.raw?.awayID;
    const teamAId = row.team_a_id || row.homeID || row.home_id;
    const teamBId = row.team_b_id || row.awayID || row.away_id;
    const teamAIsHome = sameId(teamAId, homeId) || !sameId(teamAId, awayId);
    const homeGoals = teamAIsHome ? row.team_a_goals : row.team_b_goals;
    const awayGoals = teamAIsHome ? row.team_b_goals : row.team_a_goals;

    return {
      id: row.id || row.match_id || null,
      date_unix: row.date_unix || row.timestamp || row.date || null,
      home_name: teamAIsHome ? homeName() : awayName(),
      away_name: teamAIsHome ? awayName() : homeName(),
      homeGoalCount: cleanNumber(homeGoals),
      awayGoalCount: cleanNumber(awayGoals),
      team_a_id: teamAId || null,
      team_b_id: teamBId || null,
      raw: row
    };
  }

  function hasH2HContent(h2h) {
    if (!h2h || typeof h2h !== "object") return false;

    return Boolean(
      h2h.previous_matches_results ||
      h2h.betting_stats ||
      (Array.isArray(h2h.previous_matches_ids) && h2h.previous_matches_ids.length) ||
      (Array.isArray(h2h.previous_matches) && h2h.previous_matches.length) ||
      hasValue(h2h.total_matches) ||
      hasValue(h2h.totalMatches) ||
      hasValue(h2h.team_a_wins) ||
      hasValue(h2h.team_b_wins)
    );
  }

  function normalizeFootyStatsH2H(data) {
    const raw = getRawMatch(data);
    const original = raw?.h2h || data?.h2h;

    if (!raw || !original || original._jtipsNormalized || !hasH2HContent(original)) return;

    const results = original.previous_matches_results || original;
    const betting = original.betting_stats || original;
    const sourceMatches = Array.isArray(original.previous_matches_ids)
      ? original.previous_matches_ids
      : Array.isArray(original.previous_matches)
        ? original.previous_matches
        : [];

    const previousMatches = sourceMatches.map(function(row) {
      return normalizePreviousMatch(row, data);
    });

    const normalized = Object.assign({}, original, {
      _jtipsNormalized: true,
      previous_matches: previousMatches,
      matches: previousMatches,
      fixtures: previousMatches,
      team_a_win_home: cleanNumber(results.team_a_win_home),
      team_a_win_away: cleanNumber(results.team_a_win_away),
      team_b_win_home: cleanNumber(results.team_b_win_home),
      team_b_win_away: cleanNumber(results.team_b_win_away),
      team_a_wins: cleanNumber(results.team_a_wins),
      team_b_wins: cleanNumber(results.team_b_wins),
      draws: cleanNumber(results.draw || results.draws),
      total_matches: cleanNumber(results.totalMatches || results.total_matches || results.matches || results.total),
      team_a_win_percent: cleanNumber(results.team_a_win_percent),
      team_b_win_percent: cleanNumber(results.team_b_win_percent),
      over05: cleanNumber(betting.over05),
      over15: cleanNumber(betting.over15),
      over25: cleanNumber(betting.over25),
      over35: cleanNumber(betting.over35),
      over45: cleanNumber(betting.over45),
      over55: cleanNumber(betting.over55),
      btts: cleanNumber(betting.btts),
      team_a_clean_sheets: cleanNumber(betting.clubACS || betting.team_a_clean_sheets),
      team_b_clean_sheets: cleanNumber(betting.clubBCS || betting.team_b_clean_sheets),
      over05_percentage: cleanNumber(betting.over05Percentage),
      over15_percentage: cleanNumber(betting.over15Percentage),
      over25_percentage: cleanNumber(betting.over25Percentage),
      over35_percentage: cleanNumber(betting.over35Percentage),
      btts_percentage: cleanNumber(betting.bttsPercentage),
      avg_goals: cleanNumber(betting.avg_goals),
      total_goals: cleanNumber(betting.total_goals)
    });

    raw.h2h = normalized;
    data.h2h = normalized;
  }

  function applyLeagueAverages(data, league) {
    if (!data || !league?.averages) return;

    const raw = getRawMatch(data);
    if (!raw) return;

    const averages = league.averages;

    data.league_averages = averages;
    data.league = data.league || {};
    data.league.name = league.name || data.league.name || selectedMatch?.league || "Liga";
    data.league.country = league.country || data.league.country || null;

    raw.league_o15 = averages.over15;
    raw.over_15_league_average = averages.over15;
    raw.league_o25 = averages.over25;
    raw.over_25_league_average = averages.over25;
    raw.league_o35 = averages.over35;
    raw.over_35_league_average = averages.over35;
    raw.league_btts = averages.btts;
    raw.btts_league_average = averages.btts;
    raw.league_avg_goals = averages.goals_per_match;
    raw.average_goals = averages.goals_per_match;
    raw.league_cards_avg = averages.cards_per_match;
    raw.cards_league_average = averages.cards_per_match;
    raw.league_corners_avg = averages.corners_per_match;
    raw.corners_league_average = averages.corners_per_match;
  }

  function needsLeagueAverages(data) {
    return Boolean(
      data &&
      selectedMatch?.seasonId &&
      !data._completasLeagueLoading &&
      !data._completasLeagueLoaded &&
      !data._completasLeagueError
    );
  }

  async function loadLeagueAverages(data) {
    if (!needsLeagueAverages(data)) return;

    data._completasLeagueLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: selectedMatch.seasonId
      });
      const dateUnix = data.status?.date_unix || getRawMatch(data)?.date_unix;

      if (dateUnix) params.set("max_time", dateUnix);

      const response = await fetch(`/api/completas-league?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Medias da liga indisponiveis.");
      }

      applyLeagueAverages(data, payload.data);
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.completas_league = payload.input || null;
      data._completasLeagueLoaded = true;
    } catch (error) {
      data._completasLeagueError = error.message;
    } finally {
      data._completasLeagueLoading = false;
      if (selectedMatch?.complete === data) renderTab("completas");
    }
  }

  function needsH2H(data) {
    const raw = getRawMatch(data);
    return Boolean(
      data &&
      selectedMatch?.matchId &&
      !hasH2HContent(raw?.h2h || data.h2h) &&
      !data._completasH2HLoading &&
      !data._completasH2HLoaded &&
      !data._completasH2HError
    );
  }

  async function loadCompleteH2H(data) {
    if (!needsH2H(data)) return;

    data._completasH2HLoading = true;

    try {
      const params = new URLSearchParams({
        match_id: selectedMatch.matchId
      });

      if (selectedMatch.seasonId) params.set("season_id", selectedMatch.seasonId);

      const response = await fetch(`/api/completas-h2h?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "H2H completo indisponivel.");
      }

      data.raw = data.raw || {};
      data.raw.match_details = Object.assign({}, data.raw.match_details || data.raw.match || {}, payload.data);
      data.raw.match = Object.assign({}, data.raw.match || {}, payload.data);
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.completas_h2h = payload.diagnostics || null;
      data._completasH2HLoaded = true;
      normalizeFootyStatsH2H(data);
    } catch (error) {
      data._completasH2HError = error.message;
    } finally {
      data._completasH2HLoading = false;
      if (selectedMatch?.complete === data) renderTab("completas");
    }
  }

  function normalizeCompleteData() {
    try {
      const data = selectedMatch?.complete;
      normalizeFootyStatsH2H(data);
      loadLeagueAverages(data);
      loadCompleteH2H(data);
    } catch (error) {
      console.warn("Nao foi possivel normalizar dados da FootyStats", error);
    }
  }

  if (typeof renderCompletas === "function") {
    const previousRenderCompletas = renderCompletas;

    renderCompletas = function renderCompletasWithFootyStatsMap() {
      normalizeCompleteData();
      return previousRenderCompletas();
    };
  }

  if (typeof showStats === "function") {
    const previousShowStats = showStats;

    showStats = async function showStatsWithFootyStatsMap() {
      await previousShowStats.apply(this, arguments);
      normalizeCompleteData();
    };
  }
})();
