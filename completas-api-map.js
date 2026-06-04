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

  function normalizeFootyStatsH2H(data) {
    const raw = getRawMatch(data);
    const original = raw?.h2h || data?.h2h;

    if (!raw || !original || original._jtipsNormalized) return;

    const results = original.previous_matches_results || {};
    const betting = original.betting_stats || {};
    const previousMatches = Array.isArray(original.previous_matches_ids)
      ? original.previous_matches_ids.map(function(row) { return normalizePreviousMatch(row, data); })
      : [];

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
      draws: cleanNumber(results.draw),
      total_matches: cleanNumber(results.totalMatches),
      team_a_win_percent: cleanNumber(results.team_a_win_percent),
      team_b_win_percent: cleanNumber(results.team_b_win_percent),
      over05: cleanNumber(betting.over05),
      over15: cleanNumber(betting.over15),
      over25: cleanNumber(betting.over25),
      over35: cleanNumber(betting.over35),
      over45: cleanNumber(betting.over45),
      over55: cleanNumber(betting.over55),
      btts: cleanNumber(betting.btts),
      team_a_clean_sheets: cleanNumber(betting.clubACS),
      team_b_clean_sheets: cleanNumber(betting.clubBCS),
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

  function normalizeCompleteData() {
    try {
      normalizeFootyStatsH2H(selectedMatch?.complete);
    } catch (error) {
      console.warn("Nao foi possivel normalizar H2H da FootyStats", error);
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
      if (selectedMatch?.complete) renderTab("completas");
    };
  }
})();
