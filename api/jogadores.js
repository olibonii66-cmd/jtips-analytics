export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "FOOTYSTATS_API_KEY nao configurada na Vercel." });
  }

  const seasonId = String(req.query.season_id || req.query.seasonId || req.query.league_id || req.query.competition_id || "").trim();
  const homeId = String(req.query.home_id || req.query.homeId || "").trim();
  const awayId = String(req.query.away_id || req.query.awayId || "").trim();
  const homeName = String(req.query.home_name || req.query.homeName || "").trim();
  const awayName = String(req.query.away_name || req.query.awayName || "").trim();

  if (!seasonId) return res.status(400).json({ ok: false, error: "Informe o season_id da liga." });
  if (!homeId || !awayId) return res.status(400).json({ ok: false, error: "Informe home_id e away_id." });

  try {
    const result = await fetchFootyStats("league-players", {
      key: apiKey,
      league_id: seasonId,
      page: 1,
      max_per_page: 1000
    });

    const players = extractArray(result.data);
    const homePlayers = filterPlayersForTeam(players, homeId, homeName).map(normalizePlayer);
    const awayPlayers = filterPlayersForTeam(players, awayId, awayName).map(normalizePlayer);

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "jogadores",
      input: {
        season_id: seasonId,
        home_id: homeId,
        away_id: awayId,
        home_name: homeName || null,
        away_name: awayName || null
      },
      diagnostics: {
        league_players_ok: result.ok,
        league_players_status: result.status,
        league_players_count: players.length,
        home_players_count: homePlayers.length,
        away_players_count: awayPlayers.length,
        home_filter: buildFilterDiagnostics(players, homeId, homeName),
        away_filter: buildFilterDiagnostics(players, awayId, awayName)
      },
      data: {
        home: buildTeamLists(homePlayers),
        away: buildTeamLists(awayPlayers)
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erro interno ao buscar dados de jogadores.", detail: error.message });
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
  if (Array.isArray(payload.players)) return payload.players;
  if (payload.data && Array.isArray(payload.data.players)) return payload.data.players;
  if (payload.response && Array.isArray(payload.response.players)) return payload.response.players;
  return [];
}

function filterPlayersForTeam(players, teamId, teamName) {
  const byId = players.filter(function(player) {
    return belongsToTeamId(player, teamId);
  });

  if (byId.length) return byId;

  const byName = players.filter(function(player) {
    return belongsToTeamName(player, teamName);
  });

  if (byName.length) return byName;

  const compactName = compactTeamName(teamName);

  return players.filter(function(player) {
    return teamNameValues(player).some(function(value) {
      const compactValue = compactTeamName(value);
      return compactName && compactValue && (compactValue.includes(compactName) || compactName.includes(compactValue));
    });
  });
}

function belongsToTeamId(player, teamId) {
  const ids = [
    player.team_id,
    player.teamID,
    player.teamId,
    player.club_id,
    player.clubID,
    player.clubId,
    player.club_team_id,
    player.clubTeamID,
    player.clubTeamId,
    player.current_team_id,
    player.currentTeamID,
    player.currentTeamId,
    player.team_a_id,
    player.teamAID,
    player.teamAId,
    player.squad_team_id,
    player.squadTeamID,
    player.squadTeamId,
    player.parent_team_id,
    player.parentTeamID,
    player.parentTeamId
  ];

  return ids.some(function(value) {
    return value !== undefined && value !== null && String(value) === String(teamId);
  });
}

function belongsToTeamName(player, teamName) {
  const wanted = normalizeText(teamName);
  if (!wanted) return false;

  return teamNameValues(player).some(function(value) {
    const normalized = normalizeText(value);
    return normalized && normalized === wanted;
  });
}

function teamNameValues(player) {
  return [
    player.team_name,
    player.teamName,
    player.team,
    player.club_name,
    player.clubName,
    player.club,
    player.current_team_name,
    player.currentTeamName,
    player.current_team,
    player.currentTeam,
    player.squad_team_name,
    player.squadTeamName,
    player.parent_team_name,
    player.parentTeamName
  ].filter(function(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bec\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bsc\b/g, "")
    .replace(/\bpr\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactTeamName(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function buildFilterDiagnostics(players, teamId, teamName) {
  const byId = players.filter(function(player) { return belongsToTeamId(player, teamId); }).length;
  const byName = players.filter(function(player) { return belongsToTeamName(player, teamName); }).length;
  const sampleNames = Array.from(new Set(players.flatMap(teamNameValues))).slice(0, 20);

  return { by_id: byId, by_name: byName, requested_name: teamName || null, sample_team_names: sampleNames };
}

function normalizePlayer(player) {
  const yellowCards = number(
    player.yellow_cards_overall,
    player.yellow_cards,
    player.cards_yellow,
    player.yellowCards
  );
  const redCards = number(
    player.red_cards_overall,
    player.red_cards,
    player.cards_red,
    player.redCards
  );
  const cardsTotal = number(
    player.cards_overall,
    player.cards_total,
    player.cards,
    player.bookings_overall,
    player.bookings,
    sumNullable(yellowCards, redCards)
  );
  const minutes = number(
    player.minutes_overall,
    player.minutes,
    player.minutes_played,
    player.time_played,
    player.minutesPlayed
  );
  const directCardsPer90 = number(
    player.cards_per_90_overall,
    player.cards_per90_overall,
    player.cards_per_90,
    player.cards_per90,
    player.bookings_per_90,
    player.bookings_per90
  );
  const computedCardsPer90 = cardsTotal !== null && minutes && minutes > 0 ? Number(((cardsTotal / minutes) * 90).toFixed(2)) : null;

  return {
    name: String(
      player.full_name ||
      player.known_as ||
      player.player_name ||
      player.name ||
      "Jogador"
    ),
    nationality: String(
      player.nationality ||
      player.nationality_name ||
      player.country ||
      player.country_name ||
      player.birth_country ||
      ""
    ),
    goals: number(
      player.goals_overall,
      player.goals_total,
      player.goals,
      player.total_goals,
      player.season_goals
    ) || 0,
    cards: cardsTotal || 0,
    cards_per_90: directCardsPer90 !== null ? directCardsPer90 : computedCardsPer90 || 0,
    minutes: minutes || 0,
    raw_id: player.id || player.player_id || player.playerID || null
  };
}

function buildTeamLists(players) {
  return {
    scorers: topPlayers(players, "goals", true),
    cards: topPlayers(players, "cards", true),
    cards_per_90: topPlayers(players, "cards_per_90", true)
  };
}

function topPlayers(players, key, onlyPositive) {
  return players
    .filter(function(player) {
      const value = Number(player[key] || 0);
      if (onlyPositive && value <= 0) return false;
      return Number.isFinite(value);
    })
    .sort(function(a, b) {
      const byValue = Number(b[key] || 0) - Number(a[key] || 0);
      if (byValue !== 0) return byValue;
      return String(a.name).localeCompare(String(b.name), "pt-BR");
    })
    .slice(0, 6)
    .map(function(player) {
      return {
        name: player.name,
        nationality: player.nationality,
        value: Number(player[key] || 0),
        minutes: player.minutes
      };
    });
}

function number() {
  for (const value of arguments) {
    if (value === undefined || value === null || value === "" || value === -1 || value === "-1") continue;
    const clean = typeof value === "string" ? value.replace("%", "").replace(",", ".").trim() : value;
    const parsed = Number(clean);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function sumNullable(a, b) {
  if (a === null && b === null) return null;
  return Number(a || 0) + Number(b || 0);
}
