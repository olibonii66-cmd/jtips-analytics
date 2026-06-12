const API_BASE_URL = "/api/footystats";
const APP_TIMEZONE = "America/Sao_Paulo";
const API_TIMEOUT = 20000;

const TARGET_LEAGUES = [
  { key: "brasileirao-a", name: "Brasileirão Série A", short: "BRA", country: "Brasil", color: "#00c853", aliases: ["serie a", "brasileirao", "brasileirão"] },
  { key: "brasileirao-b", name: "Brasileirão Série B", short: "BRB", country: "Brasil", color: "#f4b400", aliases: ["serie b", "brasileirao serie b", "brasileirão série b"] },
  { key: "copa-do-brasil", name: "Copa do Brasil", short: "CDB", country: "Brasil", color: "#5ee68c", aliases: ["copa do brasil"] },
  { key: "libertadores", name: "CONMEBOL Libertadores", short: "LIB", country: "América do Sul", color: "#ff8f3d", aliases: ["copa libertadores", "libertadores"] },
  { key: "premier-league", name: "Premier League", short: "PL", country: "Inglaterra", color: "#9d8cff", aliases: ["premier league"] },
  { key: "la-liga", name: "La Liga", short: "LL", country: "Espanha", color: "#ff5d6c", aliases: ["la liga", "primera division", "primera división"] },
  { key: "bundesliga", name: "Bundesliga", short: "BUN", country: "Alemanha", color: "#e84747", aliases: ["bundesliga"] },
  { key: "serie-a-italia", name: "Serie A Italiana", short: "ITA", country: "Itália", color: "#59a8ff", aliases: ["serie a"] },
  { key: "ligue-1", name: "Ligue 1", short: "L1", country: "França", color: "#35b8a0", aliases: ["ligue 1"] }
];

const PAGE_META = {
  dashboard: { title: "Visão geral", eyebrow: "Central de análise" },
  jogos: { title: "Jogos e resultados", eyebrow: "Agenda esportiva" },
  odds: { title: "Odds e valor", eyebrow: "Mercados e probabilidades" },
  tips: { title: "Tips do dia", eyebrow: "Análises editoriais" }
};

const state = {
  mode: "api",
  selectedDate: startOfDay(new Date()),
  leagues: [],
  leagueIndex: [],
  matchTeams: [],
  matches: [],
  teamStats: [],
  players: [],
  loadedTeamStatsLeagueKeys: [],
  loadedPlayerLeagueKeys: [],
  tips: [],
  valueBets: [],
  matchStatus: "all",
  matchLeague: "all",
  matchSearch: "",
  minValue: 3,
  tipFilter: "all",
  activeSection: "dashboard",
  loading: false
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  setupTheme();
  setupNavigation();
  setupFilters();
  setupModal();
  renderDateStrip();
  setTodayLabel();
  await loadApplicationData();
}

function cacheElements() {
  [
    "sidebar", "sidebarOverlay", "menuToggle", "closeSidebar", "pageTitle", "pageEyebrow",
    "themeToggle", "refreshButton", "lastUpdate", "apiStatus", "liveNavBadge",
    "dashboardMetrics", "featuredMatches", "featuredTip", "dateStrip",
    "previousDate", "nextDate", "goToday",
    "matchSearch", "matchLeagueFilter", "matchStatusFilter", "matchesTableBody",
    "oddsSummary", "valueRange",
    "matchesEmpty", "valueRangeLabel", "valueBetsGrid",
    "tipsFilter", "tipsGrid", "matchModal",
    "modalTitle", "matchModalBody", "toastRegion", "todayLabel"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

async function loadApplicationData({ refresh = false } = {}) {
  setLoading(true);

  try {
    if (!isApiConfigured()) {
      throw new Error("A API só pode ser acessada pela Vercel ou pelo comando vercel dev.");
    }

    await loadRealData();
    state.mode = "api";
  } catch (error) {
    console.error("Falha ao carregar FootyStats:", error);
    clearApiData();
    state.mode = "error";
    showToast(
      "Não foi possível conectar à FootyStats",
      error.message || "Confira a função da Vercel e a variável FOOTYSTATS_API_KEY.",
      "error"
    );
  } finally {
    state.valueBets = buildValueBets(state.matches);
    state.tips = buildTips(state.matches);
    updateApiStatus();
    renderAll();
    setLoading(false);
    updateLastSync();
  }
}

async function loadRealData() {
  let availableLeagues = [];

  try {
    const leaguePayload = await apiFetch("/league-list", { chosen_leagues_only: "true" });
    availableLeagues = getDataArray(leaguePayload);
  } catch (error) {
    console.warn("Lista de ligas indisponível; continuando com jogos do dia.", error);
  }

  state.leagueIndex = buildLeagueIndex(availableLeagues);
  state.leagues = resolveTargetLeagues(availableLeagues);

  const rawMatches = await fetchMatchesForSelectedDate();
  state.leagues = mergeLeagueLists(state.leagues, deriveLeaguesFromMatches(rawMatches));

  if (!state.leagues.length && state.leagueIndex.length) {
    state.leagues = state.leagueIndex
      .slice()
      .sort((a, b) => b.year - a.year || b.seasonId - a.seasonId)
      .slice(0, 18)
      .map((league) => ({
        key: league.key,
        name: league.name,
        short: league.short,
        country: league.country,
        color: league.color,
        id: league.id,
        seasonId: league.seasonId,
        season: league.year,
        apiName: league.name
      }));
  }

  await loadMatchTeams();
  state.matches = rawMatches.map((match) => normalizeMatch(match));
}
async function loadMatchesForDate() {
  setLoading(true, "matches");
  try {
    if (!isApiConfigured()) {
      throw new Error("Execute o projeto com vercel dev ou abra a versão publicada.");
    }

    if (!state.matchTeams.length) {
      await loadMatchTeams();
    }

    const rawMatches = await fetchMatchesForSelectedDate();
    state.matches = rawMatches.map((match) => normalizeMatch(match));
    state.mode = "api";

    state.valueBets = buildValueBets(state.matches);
    state.tips = buildTips(state.matches);
    renderDateStrip();
    renderDashboard();
    renderMatches();
    renderOdds();
    renderTips();
    updateLastSync();
  } catch (error) {
    console.error(error);
    renderMatchesError("Não foi possível carregar as partidas desta data.");
    showToast("Agenda indisponível", "Tente novamente em alguns instantes.", "error");
  } finally {
    setLoading(false, "matches");
  }
}



async function fetchMatchesForSelectedDate() {
  const dateKey = formatApiDate(state.selectedDate);
  let dailyEndpointError = null;

  // O endpoint diário já filtra por data e evita baixar calendários inteiros.
  try {
    return await fetchTodayMatches(dateKey);
  } catch (error) {
    dailyEndpointError = error;
    console.warn("todays-matches indisponível; tentando league-matches.", error);
  }

  if (!state.leagues.length) {
    throw dailyEndpointError || new Error("Nenhuma liga disponível para consultar a agenda.");
  }

  const leagueResults = await Promise.allSettled(state.leagues.map((league) => fetchLeagueMatchesForDate(league, dateKey)));
  if (leagueResults.every((result) => result.status === "rejected")) {
    throw leagueResults[0].reason || dailyEndpointError || new Error("A agenda não pôde ser carregada.");
  }
  const matches = leagueResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return uniqueMatches(matches);
}

async function fetchTodayMatches(dateKey) {
  const matches = [];
  let page = 1;
  let maxPage = 1;

  do {
    const payload = await apiFetch("/todays-matches", {
      date: dateKey,
      timezone: APP_TIMEZONE,
      page
    });
    matches.push(...getDataArray(payload));
    maxPage = getPagerMaxPage(payload) || maxPage;
    page += 1;
  } while (page <= maxPage && page <= 5);

  // Não refiltrar no navegador evita perder jogos por diferença de fuso.
  return uniqueMatches(matches);
}

async function fetchLeagueMatchesForDate(league, dateKey) {
  const seasonId = league.seasonId || league.id;
  if (!seasonId) return [];

  const payload = await apiFetch("/league-matches", {
    season_id: seasonId,
    page: 1,
    max_per_page: 1000
  });
  const matches = getDataArray(payload);

  return matches.filter((match) => isMatchOnSelectedDate(match, dateKey));
}

function getPagerMaxPage(payload) {
  return Number(payload?.pager?.max_page || payload?.data?.pager?.max_page || payload?.pagination?.max_page || 1);
}

function isMatchOnSelectedDate(match, dateKey) {
  const timestamp = getMatchTimestamp(match);
  if (!timestamp || !Number.isFinite(timestamp)) return true;
  return formatApiDate(new Date(timestamp)) === dateKey;
}

function uniqueMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const id = String(match.id || match.match_id || `${match.homeID}-${match.awayID}-${match.date_unix}`);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}


async function loadMatchTeams() {
  if (!state.leagues.length) {
    state.matchTeams = [];
    return;
  }

  const teamRequests = state.leagues.map(async (league) => {
    try {
      const leagueId = league.seasonId || league.id;
      if (!leagueId) return [];
      const payload = await apiFetch("/league-teams", { season_id: leagueId });
      return getDataArray(payload).map((team) => normalizeTeamIdentity(team, league));
    } catch (error) {
      console.warn(`Times indisponíveis para ${league.name}:`, error);
      return [];
    }
  });

  const groups = await Promise.all(teamRequests);
  state.matchTeams = groups.flat();
}
async function apiFetch(endpoint, params = {}) {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.searchParams.set("endpoint", endpoint.replace(/^\/+/, ""));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`FootyStats respondeu com HTTP ${response.status}.`);
    }

    const payload = await response.json();
    if (payload?.success === false || payload?.error) {
      throw new Error(payload.message || payload.error || "A API recusou a solicitação.");
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("A FootyStats demorou mais que o esperado para responder.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildLeagueIndex(rawLeagues) {
  return rawLeagues.flatMap((league) => {
    const seasons = Array.isArray(league.season)
      ? league.season
      : Array.isArray(league.seasons)
        ? league.seasons
        : [league.season || league];

    return seasons.map((season) => {
      const name = cleanLeagueName(
        league.name ||
        league.league_name ||
        league.competition_name ||
        season.name ||
        season.league_name ||
        season.competition_name ||
        "Campeonato"
      );
      const country = league.country || season.country || "";
      const seasonId = Number(season.id || season.season_id || league.season_id || league.id || 0);
      return {
        raw: league,
        season,
        id: Number(league.id || league.league_id || seasonId || 0),
        seasonId,
        key: slugify(`${name}-${seasonId || country}`),
        name,
        short: initials(name).slice(0, 3).toUpperCase(),
        country,
        color: colorFromString(name),
        year: Number(season.year || season.ending_year || league.ending_year || 0)
      };
    });
  }).filter((league) => league.seasonId || league.id || league.name !== "Campeonato");
}

function resolveTargetLeagues(rawLeagues) {
  const normalizedAvailable = buildLeagueIndex(rawLeagues);

  return TARGET_LEAGUES.map((target) => {
    const candidates = normalizedAvailable.filter((available) => {
      const name = normalizeText(available.name);
      const country = normalizeText(available.country);
      const targetCountry = normalizeText(target.country);
      const aliasMatch = target.aliases.some((alias) => name.includes(normalizeText(alias)));

      if (!aliasMatch) return false;
      if (target.key === "libertadores") return true;
      if (target.key === "serie-a-italia") return country.includes("ital");
      if (target.key === "brasileirao-a" || target.key === "brasileirao-b" || target.key === "copa-do-brasil") {
        return country.includes("brazil") || country.includes("brasil");
      }
      return country.includes(targetCountry) || targetCountry.includes(country);
    });

    const latest = candidates.sort((a, b) => b.year - a.year || b.seasonId - a.seasonId)[0];
    if (!latest?.seasonId) return null;

    return {
      ...target,
      id: latest.raw.id || latest.seasonId,
      seasonId: latest.seasonId,
      season: latest.season.year || latest.season.season || latest.year,
      apiName: latest.name
    };
  }).filter(Boolean);
}

function deriveLeaguesFromMatches(matches) {
  const byKey = new Map();

  (matches || []).forEach((match) => {
    const competitionId = Number(match.competition_id || match.season_id || match.league_id || match.competition?.id || match.league?.id || 0);
    const indexed = competitionId
      ? state.leagueIndex.find((league) => Number(league.seasonId) === competitionId || Number(league.id) === competitionId)
      : null;

    const fallbackName = cleanLeagueName(match.competition_name || match.league_name || match.season_name || indexed?.name || (competitionId ? `Campeonato ${competitionId}` : "Campeonato"));
    const league = {
      key: indexed?.key || slugify(`${fallbackName}-${competitionId || "api"}`),
      name: indexed?.name || fallbackName,
      short: indexed?.short || initials(fallbackName).slice(0, 3).toUpperCase(),
      country: indexed?.country || match.country || match.country_name || "",
      color: indexed?.color || colorFromString(fallbackName),
      id: indexed?.id || competitionId,
      seasonId: indexed?.seasonId || competitionId,
      season: indexed?.year || match.season || "",
      apiName: indexed?.name || fallbackName
    };

    if (!byKey.has(league.key)) byKey.set(league.key, league);
  });

  return Array.from(byKey.values());
}

function mergeLeagueLists(primary, secondary) {
  const merged = new Map();
  [...(primary || []), ...(secondary || [])].forEach((league) => {
    if (!league) return;
    const key = league.key || slugify(`${league.name || "campeonato"}-${league.seasonId || league.id || "api"}`);
    if (!merged.has(key)) merged.set(key, { ...league, key });
  });
  return Array.from(merged.values());
}

function normalizeMatch(raw) {
  const league = findLeagueForRawMatch(raw);
  const timestamp = getMatchTimestamp(raw);
  const status = normalizeStatus(raw.status, timestamp, raw);
  const homeId = Number(raw.homeID || raw.home_id || raw.homeTeam?.id || raw.team_a_id || raw.team_a?.id || 0);
  const awayId = Number(raw.awayID || raw.away_id || raw.awayTeam?.id || raw.team_b_id || raw.team_b?.id || 0);
  const rawHomeName = raw.home_name || raw.homeTeam?.name || raw.home_team_name || raw.team_a_name || raw.team_a?.name || "";
  const rawAwayName = raw.away_name || raw.awayTeam?.name || raw.away_team_name || raw.team_b_name || raw.team_b?.name || "";
  const homeTeam = findMatchTeam(homeId, rawHomeName);
  const awayTeam = findMatchTeam(awayId, rawAwayName);
  const homeName = rawHomeName || homeTeam?.name || "Mandante";
  const awayName = rawAwayName || awayTeam?.name || "Visitante";
  const homeGoals = numberOrNull(raw.homeGoalCount ?? raw.home_score ?? raw.team_a_score ?? raw.homeGoals?.length);
  const awayGoals = numberOrNull(raw.awayGoalCount ?? raw.away_score ?? raw.team_b_score ?? raw.awayGoals?.length);
  const homeLogo = getTeamLogo(raw, "home") || homeTeam?.image || getNationalTeamFlagUrl(homeName) || null;
  const awayLogo = getTeamLogo(raw, "away") || awayTeam?.image || getNationalTeamFlagUrl(awayName) || null;
  const leagueName = extractLeagueName(raw, league);
  const leagueKey = league?.key || slugify(`${leagueName}-${raw.competition_id || raw.season_id || "outros"}`);

  return {
    ...raw,
    id: raw.id || raw.match_id || hashString(`${homeName}${awayName}${timestamp}`),
    leagueKey,
    league: leagueName,
    leagueShort: league?.short || initials(leagueName).slice(0, 3).toUpperCase(),
    leagueColor: league?.color || colorFromString(leagueName),
    competitionId: Number(raw.competition_id || raw.season_id || raw.competition?.id || 0),
    homeId,
    awayId,
    homeName,
    awayName,
    homeLogo,
    awayLogo,
    homeGoals,
    awayGoals,
    timestamp,
    date: new Date(timestamp),
    status,
    minute: normalizeMinute(raw.minute ?? raw.match_minute ?? raw.elapsed ?? raw.game_minute),
    odds: {
      home: firstPositiveNumber(raw.odds_ft_1, raw.odds_1, raw.odds?.home),
      draw: firstPositiveNumber(raw.odds_ft_x, raw.odds_ft_X, raw.odds_x, raw.odds?.draw),
      away: firstPositiveNumber(raw.odds_ft_2, raw.odds_2, raw.odds?.away),
      over15: firstPositiveNumber(raw.odds_ft_over15, raw.odds_over_15, raw.odds?.over15),
      over25: firstPositiveNumber(raw.odds_ft_over25, raw.odds_over_25, raw.odds?.over25),
      under25: firstPositiveNumber(raw.odds_ft_under25, raw.odds_under_25, raw.odds?.under25),
      btts: firstPositiveNumber(raw.odds_btts_yes, raw.odds_btts, raw.odds?.btts),
      bttsNo: firstPositiveNumber(raw.odds_btts_no, raw.odds?.bttsNo),
      dc1x: firstPositiveNumber(raw.odds_doublechance_1x, raw.odds_dc_1x),
      dc12: firstPositiveNumber(raw.odds_doublechance_12, raw.odds_dc_12),
      dcx2: firstPositiveNumber(raw.odds_doublechance_x2, raw.odds_dc_x2),
      cornersOver85: firstPositiveNumber(raw.odds_corners_over_85, raw.odds_corners_over_8_5),
      cornersOver95: firstPositiveNumber(raw.odds_corners_over_95, raw.odds_corners_over_9_5),
      cornersUnder105: firstPositiveNumber(raw.odds_corners_under_105, raw.odds_corners_under_10_5)
    },
    probabilities: {
      home: firstProbability(raw.home_win_percentage, raw.homeWinProbability, raw.probability_home),
      draw: firstProbability(raw.draw_percentage, raw.drawProbability, raw.probability_draw),
      away: firstProbability(raw.away_win_percentage, raw.awayWinProbability, raw.probability_away),
      // Campos overXX são booleanos de resultado; os campos *_potential são as probabilidades.
      over05: firstProbability(raw.o05_potential, raw.over_05_percentage, raw.over05Probability),
      over15: firstProbability(raw.o15_potential, raw.over_15_percentage, raw.over15Probability),
      over25: firstProbability(raw.o25_potential, raw.over_25_percentage, raw.over25Probability),
      over35: firstProbability(raw.o35_potential, raw.over_35_percentage, raw.over35Probability),
      over45: firstProbability(raw.o45_potential, raw.over_45_percentage, raw.over45Probability),
      under05: firstProbability(raw.u05_potential, raw.under_05_percentage),
      under15: firstProbability(raw.u15_potential, raw.under_15_percentage),
      under25: firstProbability(raw.u25_potential, raw.under_25_percentage),
      under35: firstProbability(raw.u35_potential, raw.under_35_percentage),
      under45: firstProbability(raw.u45_potential, raw.under_45_percentage),
      btts: firstProbability(raw.btts_potential, raw.btts_percentage, raw.bttsProbability),
      bttsFh: firstProbability(raw.btts_fhg_potential, raw.btts_fh_potential, raw.bttsFirstHalfProbability),
      btts2h: firstProbability(raw.btts_2hg_potential, raw.btts_2h_potential, raw.bttsSecondHalfProbability),
      over05Ht: firstProbability(raw.o05HT_potential, raw.o05_ht_potential, raw.over05_fh_potential),
      over15Ht: firstProbability(raw.o15HT_potential, raw.o15_ht_potential, raw.over15_fh_potential),
      over05_2h: firstProbability(raw.o05_2H_potential, raw.o05_2h_potential, raw.over05_2h_potential),
      over15_2h: firstProbability(raw.o15_2H_potential, raw.o15_2h_potential, raw.over15_2h_potential),
      cornersOver85: firstProbability(raw.corners_o85_potential, raw.corners_over_85_percentage, raw.cornersOver85Probability),
      cornersOver95: firstProbability(raw.corners_o95_potential, raw.corners_over_95_percentage, raw.cornersOver95Probability),
      cornersOver105: firstProbability(raw.corners_o105_potential, raw.corners_over_105_percentage, raw.cornersOver105Probability),
      cardsOver35: firstProbability(raw.cards_o35_potential, raw.cards_over_35_percentage, raw.cardsOver35Probability),
      cardsOver45: firstProbability(raw.cards_o45_potential, raw.cards_over_45_percentage, raw.cardsOver45Probability),
      cardsOver55: firstProbability(raw.cards_o55_potential, raw.cards_over_55_percentage, raw.cardsOver55Probability)
    },
    stats: {
      possessionHome: nullablePositiveNumber(raw.team_a_possession),
      possessionAway: nullablePositiveNumber(raw.team_b_possession),
      shotsHome: nullablePositiveNumber(raw.team_a_shots),
      shotsAway: nullablePositiveNumber(raw.team_b_shots),
      shotsOnTargetHome: nullablePositiveNumber(raw.team_a_shotsOnTarget),
      shotsOnTargetAway: nullablePositiveNumber(raw.team_b_shotsOnTarget),
      shotsOffTargetHome: nullablePositiveNumber(raw.team_a_shotsOffTarget),
      shotsOffTargetAway: nullablePositiveNumber(raw.team_b_shotsOffTarget),
      cornersHome: nullablePositiveNumber(raw.team_a_corners),
      cornersAway: nullablePositiveNumber(raw.team_b_corners),
      cornersTotal: nullablePositiveNumber(raw.totalCornerCount),
      yellowHome: nullablePositiveNumber(raw.team_a_yellow_cards),
      yellowAway: nullablePositiveNumber(raw.team_b_yellow_cards),
      redHome: nullablePositiveNumber(raw.team_a_red_cards),
      redAway: nullablePositiveNumber(raw.team_b_red_cards),
      cardsHome: firstNumber(raw.team_a_cards_num, addNullable(raw.team_a_yellow_cards, raw.team_a_red_cards)),
      cardsAway: firstNumber(raw.team_b_cards_num, addNullable(raw.team_b_yellow_cards, raw.team_b_red_cards)),
      foulsHome: nullablePositiveNumber(raw.team_a_fouls),
      foulsAway: nullablePositiveNumber(raw.team_b_fouls),
      offsidesHome: nullablePositiveNumber(raw.team_a_offsides),
      offsidesAway: nullablePositiveNumber(raw.team_b_offsides),
      xgHome: nullablePositiveNumber(raw.team_a_xg),
      xgAway: nullablePositiveNumber(raw.team_b_xg),
      xgTotal: nullablePositiveNumber(raw.total_xg),
      xgPrematchHome: nullablePositiveNumber(raw.team_a_xg_prematch),
      xgPrematchAway: nullablePositiveNumber(raw.team_b_xg_prematch),
      xgPrematchTotal: nullablePositiveNumber(raw.total_xg_prematch),
      homePpg: nullablePositiveNumber(raw.pre_match_home_ppg ?? raw.pre_match_teamA_overall_ppg),
      awayPpg: nullablePositiveNumber(raw.pre_match_away_ppg ?? raw.pre_match_teamB_overall_ppg),
      totalGoals: nullablePositiveNumber(raw.totalGoalCount),
      htGoals: nullablePositiveNumber(raw.HTGoalCount),
      secondHalfGoals: nullablePositiveNumber(raw.GoalCount_2hg),
      htGoalsHome: nullablePositiveNumber(raw.ht_goals_team_a),
      htGoalsAway: nullablePositiveNumber(raw.ht_goals_team_b),
      secondHalfGoalsHome: nullablePositiveNumber(raw.goals_2hg_team_a),
      secondHalfGoalsAway: nullablePositiveNumber(raw.goals_2hg_team_b),
      cornersPotential: nullablePositiveNumber(raw.corners_potential),
      cornersFhHome: nullablePositiveNumber(raw.team_a_fh_corners),
      cornersFhAway: nullablePositiveNumber(raw.team_b_fh_corners),
      cornersFhTotal: nullablePositiveNumber(raw.corner_fh_count),
      corners2hHome: nullablePositiveNumber(raw.team_a_2h_corners),
      corners2hAway: nullablePositiveNumber(raw.team_b_2h_corners),
      corners2hTotal: nullablePositiveNumber(raw.corner_2h_count),
      cardsPotential: nullablePositiveNumber(raw.cards_potential),
      cardsFhHome: nullablePositiveNumber(raw.team_a_fh_cards),
      cardsFhAway: nullablePositiveNumber(raw.team_b_fh_cards),
      cardsFhTotal: nullablePositiveNumber(raw.total_fh_cards),
      cards2hHome: nullablePositiveNumber(raw.team_a_2h_cards),
      cards2hAway: nullablePositiveNumber(raw.team_b_2h_cards),
      cards2hTotal: nullablePositiveNumber(raw.total_2h_cards),
      attacksRecorded: nullablePositiveNumber(raw.attacks_recorded)
    }
  };
}

function normalizeTeamIdentity(raw, league) {
  const name = raw.cleanName || raw.name || raw.full_name || raw.english_name || "Time";
  return {
    ...raw,
    id: Number(raw.id || raw.team_id),
    name,
    fullName: raw.full_name || raw.english_name || name,
    shortHand: raw.shortHand || raw.short_name || initials(name),
    image: sanitizeImageUrl(raw.image || raw.logo || raw.team_logo || raw.team_badge || raw.badge || raw.crest || raw.image_url || raw.logo_url),
    leagueKey: league.key,
    color: colorFromString(name)
  };
}

function normalizeTeam(raw, league) {
  const stats = Array.isArray(raw.stats) ? (raw.stats[0] || {}) : (raw.stats || raw);
  const played = nullablePositiveNumber(stats.seasonMatchesPlayed_overall ?? stats.matches_played ?? stats.matchesPlayed);
  const wins = nullablePositiveNumber(stats.seasonWinsNum_overall ?? stats.wins ?? stats.wins_overall);
  const draws = nullablePositiveNumber(stats.seasonDrawsNum_overall ?? stats.draws);
  const goals = nullablePositiveNumber(stats.seasonGoals_overall ?? stats.goals_scored ?? stats.goals);
  const conceded = nullablePositiveNumber(stats.seasonConceded_overall ?? stats.goals_conceded ?? stats.conceded);
  return {
    ...raw,
    id: Number(raw.id || raw.team_id),
    name: raw.name || raw.full_name || raw.english_name || "Time",
    leagueKey: league.key,
    color: colorFromString(raw.name || String(raw.id)),
    played,
    wins,
    draws,
    losses: nullablePositiveNumber(stats.seasonLossesNum_overall ?? stats.losses),
    winRate: nullablePositiveNumber(stats.winPercentage_overall ?? stats.win_percentage) ??
      (played && wins !== null ? Math.round((wins / played) * 100) : null),
    goals,
    conceded,
    goalsPerMatch: nullablePositiveNumber(stats.seasonScoredAVG_overall ?? stats.goals_per_match) ??
      (played && goals !== null ? goals / played : null),
    possession: nullablePositiveNumber(stats.possessionAVG_overall ?? stats.average_possession),
    cards: nullablePositiveNumber(stats.cardsAVG_overall ?? stats.cards_per_match),
    cardsAgainst: nullablePositiveNumber(stats.cardsAgainstAVG_overall ?? stats.cards_against_per_match ?? stats.cards_against),
    corners: nullablePositiveNumber(stats.cornersAVG_overall ?? stats.corners_per_match ?? stats.average_corners),
    cornersAgainst: nullablePositiveNumber(stats.cornersAgainstAVG_overall ?? stats.corners_against_per_match ?? stats.corners_against),
    shots: nullablePositiveNumber(stats.shotsAVG_overall ?? stats.shots_per_match ?? stats.average_shots ?? stats.shotsAVG),
    shotsOnTarget: nullablePositiveNumber(stats.shotsOnTargetAVG_overall ?? stats.shots_on_target_per_match ?? stats.shots_on_target),
    shotsOffTarget: nullablePositiveNumber(stats.shotsOffTargetAVG_overall ?? stats.shots_off_target_per_match ?? stats.shots_off_target),
    offsides: nullablePositiveNumber(stats.offsidesAVG_overall ?? stats.offsides_per_match),
    fouls: nullablePositiveNumber(stats.foulsAVG_overall ?? stats.fouls_per_match),
    fouled: nullablePositiveNumber(stats.fouledAVG_overall ?? stats.fouled_per_match ?? stats.fouls_suffered_per_match),
    concededPerMatch: nullablePositiveNumber(stats.seasonConcededAVG_overall ?? stats.goals_conceded_per_match ?? stats.conceded_per_match),
    ppg: nullablePositiveNumber(stats.seasonPPG_overall ?? stats.ppg) ??
      (played && wins !== null && draws !== null ? ((wins * 3) + draws) / played : null)
  };
}

function normalizePlayer(raw, teams) {
  const team = teams.find((item) => item.id === Number(raw.club_team_id || raw.team_id));
  const appearances = nullablePositiveNumber(raw.appearances_overall ?? raw.appearances);
  const goals = nullablePositiveNumber(raw.goals_overall ?? raw.goals);
  const assists = nullablePositiveNumber(raw.assists_overall ?? raw.assists);
  const minutes = nullablePositiveNumber(raw.minutes_played_overall ?? raw.minutes_played);
  return {
    ...raw,
    id: Number(raw.id || raw.player_id),
    teamId: Number(raw.club_team_id || raw.team_id || 0),
    name: raw.known_as || raw.full_name || [raw.first_name, raw.last_name].filter(Boolean).join(" ") || "Jogador",
    team: team?.name || raw.club_team_name || raw.team_name || "Clube",
    appearances,
    goals,
    assists,
    minutes,
    cards: nullablePositiveNumber(raw.cards_overall ?? raw.yellow_cards_overall ?? raw.cards ?? raw.yellow_cards),
    yellowCards: nullablePositiveNumber(raw.yellow_cards_overall ?? raw.yellow_cards),
    redCards: nullablePositiveNumber(raw.red_cards_overall ?? raw.red_cards),
    minutesPerGoal: goals && minutes !== null ? Math.round(minutes / goals) : null,
    cardsPer90: minutes ? round(((nullablePositiveNumber(raw.cards_overall ?? raw.yellow_cards_overall ?? raw.cards ?? raw.yellow_cards) || 0) / minutes) * 90, 2) : null,
    rating: nullablePositiveNumber(raw.rating || raw.performance_rating)
  };
}

function clearApiData() {
  state.leagues = [];
  state.leagueIndex = [];
  state.matchTeams = [];
  state.matches = [];
  state.teamStats = [];
  state.players = [];
  state.loadedTeamStatsLeagueKeys = [];
  state.loadedPlayerLeagueKeys = [];
  state.tips = [];
  state.valueBets = [];
}

function renderAll() {
  populateLeagueFilters();
  renderDashboard();
  renderDateStrip();
  renderMatches();
  renderOdds();
  renderTips();
}

function populateLeagueFilters() {
  const allOption = `<option value="all">Todos os campeonatos</option>`;
  const options = state.leagues.map((league) => `<option value="${league.key}">${escapeHtml(league.name)}</option>`).join("");
  if (els.matchLeagueFilter) {
    els.matchLeagueFilter.innerHTML = allOption + options;
    els.matchLeagueFilter.value = state.matchLeague;
  }
}
function renderDashboard() {
  const liveCount = state.matches.filter((match) => match.status === "live").length;

  if (els.dashboardMetrics) {
    els.dashboardMetrics.innerHTML = "";
    els.dashboardMetrics.classList.add("hidden");
  }

  const featured = getFeaturedMatches(3);

  els.featuredMatches.innerHTML = featured.length
    ? featured.map(featuredMatchTemplate).join("")
    : emptyInline("Nenhum jogo com leitura acima de 70% nesta data.");

  const tip = getFeaturedTip();
  els.featuredTip.innerHTML = tip ? featuredTipTemplate(tip) : emptyInline("Nenhuma tip acima de 70% disponível agora.");
  els.liveNavBadge.textContent = String(liveCount);
  els.liveNavBadge.classList.toggle("hidden", liveCount === 0);
}

function getFeaturedMatches(limit = 3) {
  return state.matches
    .map((match) => ({ match, market: bestMarketForMatch(match) }))
    .filter(({ market }) => Number.isFinite(market.probability) && market.probability >= 0.7)
    .sort((a, b) => {
      const probabilityDiff = (b.market.probability || 0) - (a.market.probability || 0);
      if (probabilityDiff) return probabilityDiff;
      return (b.market.value || 0) - (a.market.value || 0);
    })
    .slice(0, limit)
    .map(({ match }) => match);
}

function getFeaturedTip() {
  return state.tips
    .filter((tip) => Number.isFinite(tip.probability) && tip.probability >= 0.7)
    .sort((a, b) => {
      const probabilityDiff = (b.probability || 0) - (a.probability || 0);
      if (probabilityDiff) return probabilityDiff;
      return (b.value || 0) - (a.value || 0);
    })[0] || null;
}

function metricCard(icon, label, value, suffix, color, trend) {
  return `
    <article class="metric-card" style="--metric-color:${color};--metric-soft:${hexToRgba(color, 0.12)}">
      <div class="metric-card__top">
        <span class="metric-card__icon"><i class="${icon}"></i></span>
        <span class="metric-card__trend"><i class="fa-solid fa-arrow-trend-up"></i> ${escapeHtml(trend)}</span>
      </div>
      <p class="metric-card__label">${escapeHtml(label)}</p>
      <p class="metric-card__value">${escapeHtml(String(value))}<small>${escapeHtml(suffix)}</small></p>
    </article>
  `;
}

function featuredMatchTemplate(match) {
  const insight = bestMarketForMatch(match);
  return `
    <button class="featured-match" type="button" data-match-id="${match.id}">
      <div class="match-meta">
        <strong>${formatMatchTime(match)}</strong>
        <span>${escapeHtml(match.leagueShort)}</span>
      </div>
      <div class="match-teams">
        ${compactTeamRow(match.homeName, match.homeGoals, match.leagueColor, match.homeLogo, match.status === "complete")}
        ${compactTeamRow(match.awayName, match.awayGoals, secondaryColor(match.leagueColor), match.awayLogo, match.status === "complete")}
      </div>
      <div class="match-insight">
        <small>Melhor leitura</small>
        <strong>${escapeHtml(insight.label)}</strong>
      </div>
    </button>
  `;
}

function featuredTipTemplate(tip) {
  return `
    <div class="tip-match">
      ${tipTeam(tip.homeName, tip.homeColor, tip.homeLogo)}
      <span class="tip-versus">VS</span>
      ${tipTeam(tip.awayName, tip.awayColor, tip.awayLogo)}
    </div>
    <div class="tip-market-box">
      <div class="tip-market-row">
        <div><small>Mercado sugerido</small><strong>${escapeHtml(tip.market)}</strong></div>
        <span class="odd-highlight">${formatOdd(tip.odd)}</span>
      </div>
      <div class="confidence-row"><span>Confiança da análise</span>${stars(tip.confidence)}</div>
    </div>
    <button class="button button--ghost" style="width:100%;margin-top:12px" type="button" data-go-to="tips">Ver análise completa</button>
  `;
}

function renderDateStrip() {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(state.selectedDate, index - 3));
  els.dateStrip.innerHTML = dates.map((date) => {
    const active = isSameDay(date, state.selectedDate);
    const today = isSameDay(date, new Date());
    return `
      <button class="date-chip ${active ? "active" : ""}" type="button" data-date="${formatApiDate(date)}">
        ${today ? "Hoje" : capitalize(formatDate(date, { weekday: "short" }).replace(".", ""))}
        <strong>${date.getDate()}</strong>
      </button>
    `;
  }).join("");

  els.dateStrip.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedDate = parseLocalDate(button.dataset.date);
      await loadMatchesForDate();
    });
  });
}

function renderMatches() {
  const filtered = state.matches.filter((match) => {
    const leagueMatch = state.matchLeague === "all" || match.leagueKey === state.matchLeague;
    const statusMatch = state.matchStatus === "all" || match.status === state.matchStatus;
    const query = normalizeText(state.matchSearch);
    const searchMatch = !query || normalizeText(`${match.homeName} ${match.awayName} ${match.league}`).includes(query);
    return leagueMatch && statusMatch && searchMatch;
  }).sort((a, b) => a.timestamp - b.timestamp);

  els.matchesTableBody.innerHTML = filtered.map(matchTableRow).join("");
  els.matchesEmpty.classList.toggle("hidden", filtered.length > 0);
  bindMatchButtons();
}

function matchTableRow(match) {
  const market = bestMarketForMatch(match);
  return `
    <tr>
      <td class="table-time"><strong>${formatTime(match.date)}</strong><small>${formatDate(match.date, { day: "2-digit", month: "short" })}</small></td>
      <td><div class="table-league table-league--plain"><span>${escapeHtml(match.league)}</span></div></td>
      <td><div class="table-match">
        ${tableTeam(match.homeName, match.homeGoals, match.leagueColor, match.homeLogo, shouldShowMatchScore(match))}
        ${tableTeam(match.awayName, match.awayGoals, secondaryColor(match.leagueColor), match.awayLogo, shouldShowMatchScore(match))}
      </div></td>
      <td>${statusPill(match)}</td>
      <td><span class="market-pill">${escapeHtml(market.label)}</span></td>
      <td class="table-odd">${formatOdd(market.odd)}</td>
      <td><button class="icon-button table-action" type="button" data-match-id="${match.id}" aria-label="Ver análise"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></td>
    </tr>
  `;
}

function renderMatchesError(message) {
  els.matchesTableBody.innerHTML = `
    <tr><td colspan="7"><div class="error-state"><i class="fa-solid fa-cloud-arrow-down"></i><h3>Agenda indisponível</h3><p>${escapeHtml(message)}</p></div></td></tr>
  `;
  els.matchesEmpty.classList.add("hidden");
}

function miniStat(icon, label, value, color) {
  return `
    <div class="mini-stat">
      <span class="mini-stat__icon" style="--stat-color:${color}"><i class="${icon}"></i></span>
      <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong></div>
    </div>
  `;
}

function renderOdds() {
  const filtered = state.valueBets.filter((bet) => {
    return bet.value >= state.minValue;
  });

  const averageValue = average(filtered.map((bet) => bet.value));
  const topValue = filtered[0]?.value ?? null;
  const averageOdd = average(filtered.map((bet) => bet.odd));

  els.oddsSummary.innerHTML = [
    miniStat("fa-solid fa-gem", "Value bets", filtered.length, "#00c853"),
    miniStat("fa-solid fa-arrow-trend-up", "Valor médio", formatAverage(averageValue, 1, "%"), "#59a8ff"),
    miniStat("fa-solid fa-bolt", "Maior edge", topValue === null ? "—" : `${round(topValue, 1)}%`, "#ffb547"),
    miniStat("fa-solid fa-coins", "Odd média", formatAverage(averageOdd, 2), "#9d8cff")
  ].join("");

  els.valueBetsGrid.innerHTML = filtered.length
    ? filtered.slice(0, 12).map(valueBetCard).join("")
    : `<div class="panel empty-state" style="grid-column:1/-1"><i class="fa-solid fa-filter-circle-xmark"></i><h3>Nenhuma value bet neste filtro</h3><p>Reduza o valor mínimo ou escolha outro mercado.</p></div>`;
}

function valueBetCard(bet) {
  return `
    <article class="value-card">
      <div class="value-card__top">
        <span>${escapeHtml(bet.league)} · ${formatTime(bet.match.date)}</span>
        <span class="value-pill ${bet.value >= 7 ? "high" : "medium"}">${bet.value >= 7 ? "Alto valor" : "Valor moderado"}</span>
      </div>
      <div class="value-card__match">
        <div class="value-card__team">${teamCrest(bet.match.homeName, bet.match.leagueColor)}<span>${escapeHtml(bet.match.homeName)}</span></div>
        <span class="value-card__vs">VS</span>
        <div class="value-card__team">${teamCrest(bet.match.awayName, secondaryColor(bet.match.leagueColor))}<span>${escapeHtml(bet.match.awayName)}</span></div>
      </div>
      <div class="value-card__market">
        ${valueCell("Mercado", bet.market)}
        ${valueCell("Prob. modelo", `${round(bet.probability * 100, 1)}%`)}
        ${valueCell("Odd", formatOdd(bet.odd))}
        ${valueCell("Value", `+${round(bet.value, 1)}%`, true)}
      </div>
    </article>
  `;
}

function valueCell(label, value, accent = false) {
  return `<div class="value-cell"><small>${label}</small><strong class="${accent ? "accent" : ""}">${escapeHtml(String(value))}</strong></div>`;
}

function buildValueBets(matches) {
  const bets = [];
  matches.filter((match) => match.status !== "complete").forEach((match) => {
    const model = {
      home: match.probabilities.home,
      draw: match.probabilities.draw,
      away: match.probabilities.away,
      over25: match.probabilities.over25,
      btts: match.probabilities.btts
    };

    [
      ["1x2", `Vitória ${match.homeName}`, match.odds.home, model.home],
      ["1x2", "Empate", match.odds.draw, model.draw],
      ["1x2", `Vitória ${match.awayName}`, match.odds.away, model.away],
      ["goals", "Mais de 2.5 gols", match.odds.over25, model.over25],
      ["btts", "Ambas marcam - Sim", match.odds.btts, model.btts]
    ].forEach(([marketType, market, odd, probability]) => {
      if (!Number.isFinite(odd) || !Number.isFinite(probability)) return;
      const value = ((probability * odd) - 1) * 100;
      if (value > 0) {
        bets.push({
          id: `${match.id}-${marketType}-${market}`,
          match,
          leagueKey: match.leagueKey,
          league: match.league,
          marketType,
          market,
          odd,
          probability,
          value
        });
      }
    });
  });
  return bets.sort((a, b) => b.value - a.value);
}

function buildTips(matches) {
  return state.valueBets.slice(0, 9).map((bet) => {
    const confidence = clamp(Math.round(2.6 + (bet.value / 4)), 2, 5);
    const isLive = bet.match.status === "live";
    const comfortLines = buildComfortLines(bet.match);
    return {
      id: bet.id,
      matchId: bet.match.id,
      league: bet.league,
      leagueKey: bet.leagueKey,
      homeName: bet.match.homeName,
      awayName: bet.match.awayName,
      homeColor: bet.match.leagueColor,
      awayColor: secondaryColor(bet.match.leagueColor),
      homeLogo: bet.match.homeLogo,
      awayLogo: bet.match.awayLogo,
      market: bet.market,
      odd: bet.odd,
      probability: bet.probability,
      confidence,
      value: bet.value,
      isLive,
      time: formatMatchTime(bet.match),
      comfortLines,
      insight: bettingInsight(bet, comfortLines),
      analysis: analysisText(bet)
    };
  });
}

function analysisText(bet) {
  return `A ScoutBet estima ${round(bet.probability * 100, 1)}% de probabilidade para este mercado. Com odd ${formatOdd(bet.odd)}, o valor esperado calculado é de +${round(bet.value, 1)}%.`;
}

function buildComfortLines(match) {
  const p = match.probabilities || {};
  const goals = strongestSide("Gols", [
    { label: "Mais de 1.5", probability: p.over15 },
    { label: "Menos de 2.5", probability: invertProbability(p.over25) },
    { label: "Mais de 2.5", probability: p.over25 },
    { label: "Menos de 3.5", probability: invertProbability(p.over35) },
    { label: "Mais de 3.5", probability: p.over35 }
  ], "fa-solid fa-futbol");

  const corners = strongestSide("Escanteios", [
    { label: "Mais de 8.5", probability: p.cornersOver85 },
    { label: "Menos de 8.5", probability: invertProbability(p.cornersOver85) },
    { label: "Mais de 9.5", probability: p.cornersOver95 },
    { label: "Menos de 9.5", probability: invertProbability(p.cornersOver95) },
    { label: "Mais de 10.5", probability: p.cornersOver105 },
    { label: "Menos de 10.5", probability: invertProbability(p.cornersOver105) }
  ], "fa-regular fa-flag");

  const cards = strongestSide("Cartões", [
    { label: "Mais de 3.5", probability: p.cardsOver35 },
    { label: "Menos de 3.5", probability: invertProbability(p.cardsOver35) },
    { label: "Mais de 4.5", probability: p.cardsOver45 },
    { label: "Menos de 4.5", probability: invertProbability(p.cardsOver45) },
    { label: "Mais de 5.5", probability: p.cardsOver55 },
    { label: "Menos de 5.5", probability: invertProbability(p.cardsOver55) }
  ], "fa-solid fa-square");

  const homeProtection = safeProbability(p.home) + safeProbability(p.draw);
  const awayProtection = safeProbability(p.away) + safeProbability(p.draw);
  const doubleChance = strongestSide("Vencer ou empatar", [
    { label: match.homeName, probability: homeProtection > 0 ? Math.min(homeProtection, 0.99) : null },
    { label: match.awayName, probability: awayProtection > 0 ? Math.min(awayProtection, 0.99) : null }
  ], "fa-solid fa-shield-halved");

  return [goals, corners, cards, doubleChance];
}

function strongestSide(title, options, icon) {
  const valid = options
    .filter((option) => Number.isFinite(option.probability))
    .sort((a, b) => b.probability - a.probability);
  if (!valid.length) {
    return { title, label: "Dados insuficientes", probability: null, icon };
  }
  return { title, label: valid[0].label, probability: valid[0].probability, icon };
}

function invertProbability(probability) {
  return Number.isFinite(probability) ? clamp(1 - probability, 0.01, 0.99) : null;
}

function safeProbability(probability) {
  return Number.isFinite(probability) ? probability : 0;
}

function bettingInsight(bet, comfortLines) {
  const strongLines = comfortLines.filter((line) => Number.isFinite(line.probability) && line.probability >= 0.7);
  const lineText = strongLines.length
    ? strongLines.slice(0, 2).map((line) => `${line.title.toLowerCase()} em ${line.label}`).join(" e ")
    : "os dados disponíveis";
  return `A entrada ${bet.market.toLowerCase()} ganha força porque ${lineText} sustentam uma leitura confortável. A odd ${formatOdd(bet.odd)} fica interessante frente à probabilidade estimada de ${round(bet.probability * 100, 1)}%.`;
}

function renderTips() {
  const filtered = state.tips.filter((tip) => {
    if (state.tipFilter === "high") return tip.confidence >= 4;
    if (state.tipFilter === "value") return tip.value >= 7;
    if (state.tipFilter === "live") return tip.isLive;
    return true;
  });

  els.tipsGrid.innerHTML = filtered.length
    ? filtered.map(tipCard).join("")
    : `<div class="panel empty-state" style="grid-column:1/-1"><i class="fa-regular fa-lightbulb"></i><h3>Nenhuma tip neste filtro</h3><p>Escolha outra categoria para ver as análises disponíveis.</p></div>`;

  bindMatchButtons();
}

function tipCard(tip) {
  return `
    <article class="tip-card tip-card--comfort">
      <div class="tip-card__top">
        <span>${escapeHtml(tip.league)} · ${escapeHtml(tip.time)}</span>
        ${tip.isLive ? `<span class="live-pill"><i></i> Ao vivo</span>` : `<span>${stars(tip.confidence)}</span>`}
      </div>
      <div class="tip-card__body">
        <div class="tip-card__match-panel">
          <div class="tip-card__side">
            <small>Mandante</small>
            ${teamCrest(tip.homeName, tip.homeColor, tip.homeLogo)}
            <strong>${escapeHtml(tip.homeName)}</strong>
            <span>Dados insuficientes</span>
          </div>
          <div class="tip-card__versus">VS</div>
          <div class="tip-card__side tip-card__side--right">
            <small>Visitante</small>
            ${teamCrest(tip.awayName, tip.awayColor, tip.awayLogo)}
            <strong>${escapeHtml(tip.awayName)}</strong>
            <span>Dados insuficientes</span>
          </div>
        </div>

        <div class="comfort-lines">
          <div class="comfort-lines__head"><i class="fa-solid fa-bolt"></i><strong>Linhas de Conforto</strong></div>
          ${tip.comfortLines.map(comfortLineTemplate).join("")}
        </div>

        <div class="tip-card__insight">
          <small><i class="fa-regular fa-lightbulb"></i> Insight da aposta</small>
          <p>${escapeHtml(tip.insight)}</p>
        </div>

        <div class="tip-card__pick"><small>Entrada sugerida</small><strong>${escapeHtml(tip.market)}</strong></div>
        <div class="tip-card__footer">
          <div><small>Odd de referência</small><strong>${formatOdd(tip.odd)}</strong></div>
          <button class="button button--ghost" type="button" data-match-id="${tip.matchId}">Ver números</button>
        </div>
      </div>
    </article>
  `;
}

function comfortLineTemplate(line) {
  const probabilityText = Number.isFinite(line.probability) ? `${round(line.probability * 100, 1)}%` : "—";
  const progress = Number.isFinite(line.probability) ? Math.round(line.probability * 100) : 0;
  return `
    <div class="comfort-line">
      <div class="comfort-line__meta">
        <span><i class="${line.icon}"></i>${escapeHtml(line.title)}</span>
        <strong>${escapeHtml(line.label)}</strong>
        <em>${probabilityText}</em>
      </div>
      <div class="comfort-line__track"><span style="width:${progress}%"></span></div>
    </div>
  `;
}

function setupNavigation() {
  document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo(item.dataset.section);
      closeSidebar();
    });
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-go-to]");
    if (trigger) navigateTo(trigger.dataset.goTo);
  });

  els.menuToggle.addEventListener("click", openSidebar);
  els.closeSidebar.addEventListener("click", closeSidebar);
  els.sidebarOverlay.addEventListener("click", closeSidebar);
  window.addEventListener("hashchange", () => navigateTo(location.hash.slice(1) || "dashboard", false));

  const initialSection = PAGE_META[location.hash.slice(1)] ? location.hash.slice(1) : "dashboard";
  navigateTo(initialSection, false);
}

function navigateTo(section, updateHash = true) {
  if (!PAGE_META[section]) section = "dashboard";
  state.activeSection = section;
  document.querySelectorAll(".page-section").forEach((page) => page.classList.toggle("active", page.id === section));
  document.querySelectorAll(".nav-item[data-section]").forEach((item) => item.classList.toggle("active", item.dataset.section === section));
  els.pageTitle.textContent = PAGE_META[section].title;
  els.pageEyebrow.textContent = PAGE_META[section].eyebrow;
  if (updateHash) history.pushState(null, "", `#${section}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupFilters() {
  els.previousDate.addEventListener("click", async () => {
    state.selectedDate = addDays(state.selectedDate, -1);
    await loadMatchesForDate();
  });
  els.nextDate.addEventListener("click", async () => {
    state.selectedDate = addDays(state.selectedDate, 1);
    await loadMatchesForDate();
  });
  els.goToday.addEventListener("click", async () => {
    state.selectedDate = startOfDay(new Date());
    await loadMatchesForDate();
  });

  els.matchSearch.addEventListener("input", (event) => {
    state.matchSearch = event.target.value;
    renderMatches();
  });
  if (els.matchLeagueFilter) {
    els.matchLeagueFilter.addEventListener("change", (event) => {
      state.matchLeague = event.target.value;
      renderMatches();
    });
  }
  els.matchStatusFilter.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.matchStatus = button.dataset.status;
      setActiveButton(els.matchStatusFilter, button);
      renderMatches();
    });
  });

  if (els.valueRange) {
    els.valueRange.addEventListener("input", (event) => {
      state.minValue = Number(event.target.value);
      els.valueRangeLabel.textContent = `${state.minValue}%`;
      renderOdds();
    });
  }

  els.tipsFilter.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.tipFilter = button.dataset.tipFilter;
      setActiveButton(els.tipsFilter, button);
      renderTips();
    });
  });

  if (els.refreshButton) els.refreshButton.addEventListener("click", () => loadApplicationData({ refresh: true }));
}

function setupTheme() {
  const stored = localStorage.getItem("scoutbet-theme");
  const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = stored || preferred;
  els.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("scoutbet-theme", next);
  });
}

function setupModal() {
  els.matchModal.querySelectorAll("[data-close-modal]").forEach((item) => item.addEventListener("click", closeModal));
  els.matchModal.addEventListener("click", (event) => {
    const subTabButton = event.target.closest("[data-numbers-subtab]");
    if (subTabButton) {
      switchNumbersSubtab(subTabButton.dataset.numbersSubtab, subTabButton.closest("[data-numbers-subtabs-root]"));
      return;
    }

    const tabButton = event.target.closest("[data-numbers-tab]");
    if (tabButton) switchNumbersTab(tabButton.dataset.numbersTab);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function bindMatchButtons() {
  document.querySelectorAll("[data-match-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => openMatchModal(button.dataset.matchId));
  });
}

async function openMatchModal(matchId) {
  const baseMatch = state.matches.find((item) => String(item.id) === String(matchId));
  if (!baseMatch) return;

  els.matchModal.classList.add("open");
  els.matchModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  els.modalTitle.textContent = `${baseMatch.homeName} x ${baseMatch.awayName}`;

  // Nunca deixar o usuário preso no loading: a API /match pode vir vazia ou demorar.
  // Primeiro renderiza os dados já disponíveis da lista; depois tenta enriquecer em segundo plano.
  els.matchModalBody.innerHTML = safeMatchModalTemplate(baseMatch);

  try {
    const detailedMatch = await withTimeout(fetchOfficialMatchDetails(baseMatch), 7000, "Detalhe da partida indisponível.");
    await Promise.allSettled([
      withTimeout(ensureTeamStatsForMatch(detailedMatch), 7000, "Dados dos times indisponíveis."),
      withTimeout(ensurePlayersForMatch(detailedMatch), 7000, "Jogadores indisponíveis.")
    ]);
    els.modalTitle.textContent = `${detailedMatch.homeName} x ${detailedMatch.awayName}`;
    els.matchModalBody.innerHTML = safeMatchModalTemplate(detailedMatch);
  } catch (error) {
    console.warn("Dados extras indisponíveis, mantendo dados da lista:", error);
  }
}

function withTimeout(promise, ms = 7000, message = "Tempo excedido.") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

async function fetchOfficialMatchDetails(match) {
  const payload = await apiFetch("/match", { match_id: match.id });
  const raw = pickSingleRecord(payload) || payload;
  const normalized = normalizeMatch({ ...match, ...raw });
  const index = state.matches.findIndex((item) => String(item.id) === String(match.id));
  if (index >= 0) state.matches[index] = { ...state.matches[index], ...normalized };
  return index >= 0 ? state.matches[index] : normalized;
}

function pickSingleRecord(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload.data && Array.isArray(payload.data)) return payload.data[0] || null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.match && typeof payload.match === "object") return payload.match;
  if (payload.id || payload.match_id) return payload;
  const list = getDataArray(payload);
  return list[0] || null;
}

async function ensureTeamStatsForMatch(match) {
  const league = state.leagues.find((item) => item.key === match.leagueKey);
  if (!league || state.loadedTeamStatsLeagueKeys.includes(league.key)) return;
  try {
    const payload = await apiFetch("/league-teams", {
      season_id: league.seasonId || league.id,
      include: "stats"
    });
    const teams = getDataArray(payload).map((team) => normalizeTeam(team, league));
    const existing = new Set(state.teamStats.map((team) => String(team.id)));
    teams.forEach((team) => {
      if (!existing.has(String(team.id))) state.teamStats.push(team);
    });
  } catch (error) {
    console.warn(`Dados dos times indisponíveis para ${league.name}:`, error);
  } finally {
    state.loadedTeamStatsLeagueKeys.push(league.key);
  }
}

async function ensurePlayersForMatch(match) {
  const league = state.leagues.find((item) => item.key === match.leagueKey);
  if (!league || state.loadedPlayerLeagueKeys.includes(league.key)) return;
  try {
    const payload = await apiFetch("/league-players", { season_id: league.seasonId || league.id, page: 1 });
    const teams = state.teamStats.length ? state.teamStats : state.matchTeams;
    const players = getDataArray(payload).map((player) => normalizePlayer(player, teams));
    const existing = new Set(state.players.map((player) => String(player.id)));
    players.forEach((player) => { if (!existing.has(String(player.id))) state.players.push(player); });
    state.loadedPlayerLeagueKeys.push(league.key);
  } catch (error) {
    console.warn(`Jogadores indisponíveis para ${league.name}:`, error);
    state.loadedPlayerLeagueKeys.push(league.key);
  }
}


function safeMatchModalTemplate(match) {
  try {
    return matchModalTemplate(match);
  } catch (error) {
    console.error("Erro ao renderizar Ver números:", error);
    return basicMatchModalTemplate(match, error);
  }
}

function basicMatchModalTemplate(match, error = null) {
  return `
    <div class="numbers-modal numbers-modal--real numbers-modal--tabs">
      <div class="numbers-hero numbers-hero--real">
        <div class="numbers-team">${teamCrest(match.homeName, match.leagueColor, match.homeLogo)}<strong>${escapeHtml(match.homeName)}</strong><span>Mandante</span></div>
        <div class="numbers-center"><strong>${shouldShowMatchScore(match) ? `${match.homeGoals} – ${match.awayGoals}` : "VS"}</strong><span>${escapeHtml(formatMatchTime(match))}</span>${statusPill(match)}</div>
        <div class="numbers-team">${teamCrest(match.awayName, secondaryColor(match.leagueColor), match.awayLogo)}<strong>${escapeHtml(match.awayName)}</strong><span>Visitante</span></div>
      </div>
      ${numbersTabsNav()}
      <div class="numbers-panels">
        ${numbersTabPanel("resumo", "Resumo", "fa-solid fa-chart-simple", `
          <div class="numbers-grid numbers-grid--summary">
            ${modalMarket("Campeonato", match.league || "—")}
            ${modalMarket("Status", statusLabel(match))}
            ${modalMarket("Resultado", shouldShowMatchScore(match) ? `${match.homeGoals} – ${match.awayGoals}` : "Disponível somente após finalização oficial")}
          </div>
          ${error ? `<p class="numbers-empty-note">Algumas seções não puderam ser renderizadas, mas os dados principais da partida foram mantidos.</p>` : ""}
        `, true)}
        ${numbersTabPanel("gols", "Gols", "fa-solid fa-futbol", renderGoalsNumbersTab(match))}
        ${numbersTabPanel("escanteios", "Escanteios", "fa-solid fa-flag", renderCornersNumbersTab(match))}
        ${numbersTabPanel("cartoes", "Cartões", "fa-solid fa-square", renderCardsNumbersTab(match))}
        ${numbersTabPanel("finalizacoes", "Finalizações", "fa-solid fa-bullseye", renderShotsNumbersTab(match))}
        ${numbersTabPanel("jogadores", "Jogadores", "fa-solid fa-user-group", renderPlayersNumbersTab(match))}
      </div>
    </div>
  `;
}

/* Modal Ver números - versão com abas por estatística */
function matchModalTemplate(match) {
  const market = bestMarketForMatch(match);
  const homeStats = teamNumbersForMatch(match, "home");
  const awayStats = teamNumbersForMatch(match, "away");
  const homePlayers = matchPlayers(match, "home");
  const awayPlayers = matchPlayers(match, "away");

  return `
    <div class="numbers-modal numbers-modal--real numbers-modal--tabs">
      <div class="numbers-hero numbers-hero--real">
        <div class="numbers-team">
          ${teamCrest(match.homeName, match.leagueColor, match.homeLogo)}
          <strong>${escapeHtml(match.homeName)}</strong>
          <span>Mandante</span>
        </div>
        <div class="numbers-center">
          <strong>${shouldShowMatchScore(match) ? `${match.homeGoals} – ${match.awayGoals}` : "VS"}</strong>
          <span>${escapeHtml(formatMatchTime(match))}</span>
          ${statusPill(match)}
        </div>
        <div class="numbers-team">
          ${teamCrest(match.awayName, secondaryColor(match.leagueColor), match.awayLogo)}
          <strong>${escapeHtml(match.awayName)}</strong>
          <span>Visitante</span>
        </div>
      </div>

      ${numbersTabsNav()}

      <div class="numbers-panels">
        ${numbersTabPanel("resumo", "Resumo", "fa-solid fa-chart-simple", `
          <div class="numbers-grid numbers-grid--summary">
            ${modalMarket("Campeonato", match.league || "—")}
            ${modalMarket("Status", statusLabel(match))}
            ${modalMarket("Mercado", market.label)}
            ${modalMarket("Probabilidade", formatProbability(market.probability))}
          </div>
          <div class="numbers-note"><small>Insight da aposta</small><strong>${escapeHtml(modalAnalysis(match, market))}</strong></div>
        `, true)}

        ${numbersTabPanel("gols", "Gols", "fa-solid fa-futbol", renderGoalsNumbersTab(match))}

        ${numbersTabPanel("escanteios", "Escanteios", "fa-solid fa-flag", renderCornersNumbersTab(match))}

        ${numbersTabPanel("cartoes", "Cartões", "fa-solid fa-square", renderCardsNumbersTab(match))}

        ${numbersTabPanel("finalizacoes", "Finalizações", "fa-solid fa-bullseye", renderShotsNumbersTab(match))}

        ${numbersTabPanel("jogadores", "Jogadores", "fa-solid fa-user-group", renderPlayersNumbersTab(match))}
      </div>
    </div>
  `;
}

function modalMarket(label, value) {
  return `
    <div class="modal-market">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function numbersTabsNav() {
  const tabs = [
    ["resumo", "Resumo"],
    ["gols", "Gols"],
    ["escanteios", "Escanteios"],
    ["cartoes", "Cartões"],
    ["finalizacoes", "Finalizações"],
    ["jogadores", "Jogadores"]
  ];
  return `
    <div class="numbers-tabs" role="tablist" aria-label="Estatísticas da partida">
      ${tabs.map(([id, label], index) => `
        <button type="button" class="numbers-tab ${index === 0 ? "is-active" : ""}" data-numbers-tab="${id}" role="tab" aria-selected="${index === 0 ? "true" : "false"}">${escapeHtml(label)}</button>
      `).join("")}
    </div>
  `;
}

function numbersTabPanel(id, title, icon, content, active = false) {
  return `
    <section class="numbers-section numbers-panel ${active ? "is-active" : ""}" data-numbers-panel="${id}" role="tabpanel">
      <div class="numbers-section__head"><i class="${icon}"></i><strong>${escapeHtml(title)}</strong></div>
      ${content}
    </section>
  `;
}

function switchNumbersTab(tabId) {
  if (!tabId) return;
  els.matchModal.querySelectorAll("[data-numbers-tab]").forEach((button) => {
    const isActive = button.dataset.numbersTab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  els.matchModal.querySelectorAll("[data-numbers-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.numbersPanel === tabId);
  });
}


function renderGoalsNumbersTab(match) {
  const overRows = [
    goalPredictionRow("Over 0.5", match, "over05"),
    goalPredictionRow("Over 1.5", match, "over15"),
    goalPredictionRow("Over 2.5", match, "over25"),
    goalPredictionRow("Over 3.5", match, "over35"),
    goalPredictionRow("Over 4.5", match, "over45"),
    goalPredictionRow("BTTS", match, "btts"),
    goalPredictionRow("BTTS & Win", match, "bttsWin"),
    goalPredictionRow("BTTS & Draw", match, "bttsDraw"),
    goalPredictionRow("BTTS & Over 2.5", match, "bttsOver25"),
    goalPredictionRow("BTTS No & Over 2.5", match, "bttsNoOver25")
  ];
  const underRows = [
    goalPredictionRow("Under 0.5", match, "under05"),
    goalPredictionRow("Under 1.5", match, "under15"),
    goalPredictionRow("Under 2.5", match, "under25"),
    goalPredictionRow("Under 3.5", match, "under35"),
    goalPredictionRow("Under 4.5", match, "under45")
  ];
  return `
    <div class="goal-predictions" data-numbers-subtabs-root="gols">
      <div class="goal-predictions__title">
        <strong>Over 2.5 &amp; BTTS Predictions</strong>
        <span>Quantos gols haverá nesta partida?</span>
      </div>
      <p class="goal-predictions__description">${escapeHtml(match.homeName)} e ${escapeHtml(match.awayName)}: dados de Over 0.5 a 4.5 e BTTS.</p>
      <div class="goal-predictions__tabs" role="tablist">
        <button type="button" class="numbers-subtab is-active" data-numbers-subtab="over-goals"><i class="fa-regular fa-futbol"></i> Over X Goals</button>
        <button type="button" class="numbers-subtab" data-numbers-subtab="under-goals">Under X Goals</button>
      </div>
      ${goalPredictionPanel("over-goals", "Match Goals", match, overRows, true)}
      ${goalPredictionPanel("under-goals", "Under X Goals", match, underRows)}
      ${officialDataLegend()}
    </div>
  `;
}

function goalPredictionPanel(id, heading, match, rows, active = false) {
  return `
    <div class="numbers-subpanel ${active ? "is-active" : ""}" data-numbers-subpanel="${id}">
      <div class="goal-predictions__table-wrap">
        <table class="goal-predictions__table">
          <thead>
            <tr>
              <th>${escapeHtml(heading)}</th>
              <th>${escapeHtml(match.homeName)}</th>
              <th>${escapeHtml(match.awayName)}</th>
              <th>Average</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function goalPredictionRow(label, match, key) {
  const home = goalSideProbability(match, key, "home");
  const away = goalSideProbability(match, key, "away");
  const average = goalOverallProbability(match, key, averageProbability(home, away));
  return `
    <tr>
      <th>${escapeHtml(label)}</th>
      ${goalPredictionCell(home)}
      ${goalPredictionCell(away)}
      ${goalPredictionCell(average)}
    </tr>
  `;
}

function goalSideProbability(match, key, side) {
  const prefix = side === "home" ? "home" : "away";
  const teamPrefix = side === "home" ? "team_a" : "team_b";
  const aliases = {
    over05: ["o05", "over_05", "over05"],
    over15: ["o15", "over_15", "over15"],
    over25: ["o25", "over_25", "over25"],
    over35: ["o35", "over_35", "over35"],
    over45: ["o45", "over_45", "over45"],
    under05: ["u05", "under_05", "under05"],
    under15: ["u15", "under_15", "under15"],
    under25: ["u25", "under_25", "under25"],
    under35: ["u35", "under_35", "under35"],
    under45: ["u45", "under_45", "under45"],
    btts: ["btts"],
    bttsWin: ["btts_win", "btts_and_win"],
    bttsDraw: ["btts_draw", "btts_and_draw"],
    bttsOver25: ["btts_o25", "btts_over_25"],
    bttsNoOver25: ["btts_no_o25", "btts_no_over_25"],
    over05Ht: ["o05HT", "o05_ht", "over05_fh"],
    over15Ht: ["o15HT", "o15_ht", "over15_fh"],
    bttsFh: ["btts_fhg", "btts_fh"],
    over05_2h: ["o05_2H", "o05_2h", "over05_2h"],
    over15_2h: ["o15_2H", "o15_2h", "over15_2h"],
    btts2h: ["btts_2hg", "btts_2h"]
  };
  const values = (aliases[key] || [key]).flatMap((name) => [
    match[`${prefix}_${name}_potential`],
    match[`${teamPrefix}_${name}_potential`],
    match[`${prefix}_${name}_percentage`],
    match[`${teamPrefix}_${name}_percentage`]
  ]);
  return firstGoalProbability(...values);
}

function goalOverallProbability(match, key, fallback = null) {
  const aliases = {
    over05: ["o05_potential", "over_05_percentage", "over05Probability"],
    over15: ["o15_potential", "over_15_percentage", "over15Probability"],
    over25: ["o25_potential", "over_25_percentage", "over25Probability"],
    over35: ["o35_potential", "over_35_percentage", "over35Probability"],
    over45: ["o45_potential", "over_45_percentage", "over45Probability"],
    under05: ["u05_potential", "under_05_percentage"],
    under15: ["u15_potential", "under_15_percentage"],
    under25: ["u25_potential", "under_25_percentage"],
    under35: ["u35_potential", "under_35_percentage"],
    under45: ["u45_potential", "under_45_percentage"],
    btts: ["btts_potential", "btts_percentage", "bttsProbability"],
    bttsWin: ["btts_win_potential", "btts_and_win_potential"],
    bttsDraw: ["btts_draw_potential", "btts_and_draw_potential"],
    bttsOver25: ["btts_o25_potential", "btts_over_25_potential"],
    bttsNoOver25: ["btts_no_o25_potential", "btts_no_over_25_potential"],
    over05Ht: ["o05HT_potential", "o05_ht_potential", "over05_fh_potential"],
    over15Ht: ["o15HT_potential", "o15_ht_potential", "over15_fh_potential"],
    bttsFh: ["btts_fhg_potential", "btts_fh_potential"],
    over05_2h: ["o05_2H_potential", "o05_2h_potential", "over05_2h_potential"],
    over15_2h: ["o15_2H_potential", "o15_2h_potential", "over15_2h_potential"],
    btts2h: ["btts_2hg_potential", "btts_2h_potential"]
  };
  const values = (aliases[key] || []).map((name) => match[name]);
  return firstGoalProbability(...values, match.probabilities?.[key], fallback);
}

function firstGoalProbability(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) continue;
    return clamp(number > 1 ? number / 100 : number, 0, 1);
  }
  return null;
}

function averageProbability(...values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function goalPredictionCell(probability) {
  const percentage = Number.isFinite(probability) ? Math.round(probability * 100) : null;
  const tone = percentage === null ? "empty" : percentage >= 50 ? "positive" : "negative";
  return `<td class="${tone}">${percentage === null ? "—" : `${percentage}%`}</td>`;
}

function renderCornersNumbersTab(match) {
  const home = teamNumbersForMatch(match, "home");
  const away = teamNumbersForMatch(match, "away");
  const total = firstNumber(match.stats.cornersPotential, sumIfKnown(home.corners, away.corners));
  const totalRows = [6, 7, 8, 9, 10, 11, 12, 13].map((line) =>
    comparisonProbabilityRow(`Mais de ${line}`, match, `corners_over_${line}`, probabilityFromAverage(home.corners, line), probabilityFromAverage(away.corners, line))
  );
  const teamRows = [
    comparisonValueRow("Escanteios conquistados por partida", home.corners, away.corners),
    comparisonValueRow("Escanteios contra / Partida", home.cornersAgainst, away.cornersAgainst),
    ...[2.5, 3.5, 4.5].map((line) => comparisonProbabilityRow(`Mais de ${formatLine(line)} cantos para`, match, `team_corners_for_${line}`, probabilityFromAverage(home.corners, line), probabilityFromAverage(away.corners, line))),
    ...[2.5, 3.5, 4.5].map((line) => comparisonProbabilityRow(`Mais de ${formatLine(line)} escanteios contra`, match, `team_corners_against_${line}`, probabilityFromAverage(home.cornersAgainst, line), probabilityFromAverage(away.cornersAgainst, line)))
  ];
  return predictionSection({
    root: "escanteios",
    title: "Número de escanteios:",
    subtitle: "Quantos escanteios haverá?",
    icon: "fa-solid fa-flag",
    summary: predictionSummary(total, "Escanteios / Partida", match, home.corners, away.corners, "Escanteios"),
    tabs: [
      ["corners-total", "Total de escanteios", comparisonTable("Escanteios da partida", match, totalRows), true],
      ["corners-team", "Escanteios da equipe", `<p class="prediction-description">Dados individuais de escanteios das equipes ${escapeHtml(match.homeName)} e ${escapeHtml(match.awayName)}.</p>${comparisonTable("Cantos da equipe", match, teamRows)}`]
    ]
  });
}

function renderCardsNumbersTab(match) {
  const home = teamNumbersForMatch(match, "home");
  const away = teamNumbersForMatch(match, "away");
  const total = firstNumber(match.stats.cardsPotential, sumIfKnown(home.cards, away.cards));
  const totalRows = [2.5, 3.5, 4.5, 5.5, 6.5].map((line) =>
    comparisonProbabilityRow(`Mais de ${formatLine(line)}`, match, `cards_over_${line}`, probabilityFromAverage(home.cards, line), probabilityFromAverage(away.cards, line))
  );
  const teamRows = [
    comparisonValueRow("Cartas para média", home.cards, away.cards),
    ...[0.5, 1.5, 2.5, 3.5].map((line) => comparisonProbabilityRow(`Mais de ${formatLine(line)} para`, match, `team_cards_for_${line}`, probabilityFromAverage(home.cards, line), probabilityFromAverage(away.cards, line))),
    comparisonGroupRow("Cartas Contra"),
    ...[0.5, 1.5, 2.5, 3.5].map((line) => comparisonProbabilityRow(`Mais de ${formatLine(line)} contra`, match, `team_cards_against_${line}`, probabilityFromAverage(home.cardsAgainst, line), probabilityFromAverage(away.cardsAgainst, line)))
  ];
  return predictionSection({
    root: "cartoes",
    title: "Número de cartas",
    icon: "fa-solid fa-clone",
    summary: predictionSummary(total, "Total de cartões por partida", match, home.cards, away.cards, "Cartões"),
    tabs: [
      ["cards-total", "Total de cartões", comparisonTable("Cartões de combinação", match, totalRows), true],
      ["cards-team", "Cartões da equipe", comparisonTable("Cartões de Equipe", match, teamRows)]
    ]
  });
}

function renderShotsNumbersTab(match) {
  const home = teamNumbersForMatch(match, "home");
  const away = teamNumbersForMatch(match, "away");
  const commonRows = [
    comparisonValueRow("Chutes / Partida", home.shots, away.shots),
    comparisonValueRow("Taxa de conversão de chutes", home.shotConversion, away.shotConversion, "%"),
    comparisonValueRow("Tiros no alvo / M", home.shotsOnTarget, away.shotsOnTarget),
    comparisonValueRow("Tiros fora do alvo / M", home.shotsOffTarget, away.shotsOffTarget),
    comparisonValueRow("Chutes por gol marcado", home.shotsPerGoal, away.shotsPerGoal),
    ...[10.5, 11.5, 12.5, 13.5, 14.5, 15.5].map((line) => comparisonProbabilityRow(`Chutes da equipe acima de ${formatLine(line)}`, match, `team_shots_${line}`, probabilityFromAverage(home.shots, line), probabilityFromAverage(away.shots, line)))
  ];
  const matchRows = [23.5, 24.5, 25.5, 26.5].map((line) =>
    comparisonProbabilityRow(`Match Shots Acima de ${formatLine(line)}`, match, `match_shots_${line}`, probabilityFromAverage(sumIfKnown(home.shots, away.shots), line), null)
  ).concat([
    comparisonProbabilityRow("Disparos no alvo acima de 7,5", match, "match_sot_7.5", probabilityFromAverage(sumIfKnown(home.shotsOnTarget, away.shotsOnTarget), 7.5), null),
    comparisonProbabilityRow("Match Shots On Target Over 8.5", match, "match_sot_8.5", probabilityFromAverage(sumIfKnown(home.shotsOnTarget, away.shotsOnTarget), 8.5), null),
    comparisonProbabilityRow("Match Shots On Target Over 9.5", match, "match_sot_9.5", probabilityFromAverage(sumIfKnown(home.shotsOnTarget, away.shotsOnTarget), 9.5), null)
  ]);
  const secondaryRows = [
    comparisonGroupRow("Estatísticas de impedimento"),
    comparisonValueRow("Impedimentos / Partida", home.offsides, away.offsides),
    comparisonProbabilityRow("Mais de 2,5 impedimentos", match, "offsides_2.5", probabilityFromAverage(home.offsides, 2.5), probabilityFromAverage(away.offsides, 2.5)),
    comparisonProbabilityRow("Mais de 3,5 impedimentos", match, "offsides_3.5", probabilityFromAverage(home.offsides, 3.5), probabilityFromAverage(away.offsides, 3.5)),
    comparisonGroupRow("Estatísticas diversas"),
    comparisonValueRow("Faltas cometidas / partida", home.fouls, away.fouls),
    comparisonValueRow("Falta sofrida / Partida", home.fouled, away.fouled),
    comparisonValueRow("Posse média", home.possession, away.possession, "%")
  ];
  return predictionSection({
    root: "finalizacoes",
    title: "Chutes a gol, impedimentos, faltas e muito mais",
    tabs: [
      ["team-shots", "Fotos da equipe", `${comparisonTable("Fotos da equipe", match, commonRows)}${comparisonTable("", match, secondaryRows)}`, true],
      ["match-shots", "Match Shots", `${comparisonTable("Match Shots", match, matchRows)}${comparisonTable("", match, secondaryRows)}`]
    ]
  });
}

function renderPlayersNumbersTab(match) {
  const homePlayers = matchPlayers(match, "home");
  const awayPlayers = matchPlayers(match, "away");
  return `
    <div class="player-predictions">
      ${playerPairSection("Artilheiros", match, homePlayers, awayPlayers, "goals")}
      <h3 class="player-predictions__divider"><i class="fa-solid fa-clone"></i> Quem será contratado?</h3>
      ${playerPairSection("Cartões entregues", match, homePlayers, awayPlayers, "cards")}
      <h3 class="player-predictions__divider"><i class="fa-solid fa-clone"></i> Cartões por 90 minutos</h3>
      ${playerPairSection("Cartões / 90", match, homePlayers, awayPlayers, "cards90")}
    </div>
  `;
}

function predictionSection({ root, title, subtitle = "", icon = "", summary = "", tabs }) {
  return `
    <div class="prediction-layout" data-numbers-subtabs-root="${escapeHtml(root)}">
      <div class="prediction-layout__title">
        ${icon ? `<i class="${icon}"></i>` : ""}
        <strong>${escapeHtml(title)}</strong>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
      </div>
      ${summary}
      <div class="prediction-layout__tabs" role="tablist">
        ${tabs.map(([id, label, , active]) => `<button type="button" class="numbers-subtab ${active ? "is-active" : ""}" data-numbers-subtab="${id}">${escapeHtml(label)}</button>`).join("")}
      </div>
      ${tabs.map(([id, , content, active]) => `<div class="numbers-subpanel ${active ? "is-active" : ""}" data-numbers-subpanel="${id}">${content}</div>`).join("")}
      ${officialDataLegend()}
    </div>
  `;
}

function predictionSummary(total, label, match, homeValue, awayValue, unit) {
  return `
    <div class="prediction-summary">
      <div class="prediction-summary__main">
        <strong>${formatStatValue(total)}</strong>
        <b>${escapeHtml(label)}</b>
        <small>Média combinada entre ${escapeHtml(match.homeName)} e ${escapeHtml(match.awayName)}</small>
      </div>
      ${predictionTeamCard(match.homeName, homeValue, unit)}
      ${predictionTeamCard(match.awayName, awayValue, unit)}
    </div>
  `;
}

function predictionTeamCard(name, value, unit) {
  return `<div class="prediction-team-card"><strong>${formatStatValue(value)}</strong><span>/ Partida</span><small>${escapeHtml(unit)} · ${escapeHtml(name)}</small></div>`;
}

function comparisonTable(heading, match, rows) {
  return `
    <div class="comparison-table-wrap">
      <table class="comparison-table">
        <thead><tr><th>${escapeHtml(heading)}</th><th>${escapeHtml(match.homeName)}</th><th>${escapeHtml(match.awayName)}</th><th>Média</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

function comparisonValueRow(label, home, away, suffix = "") {
  const avg = average([home, away]);
  return `<tr><th>${escapeHtml(label)}</th>${comparisonValueCell(home, suffix)}${comparisonValueCell(away, suffix)}${comparisonValueCell(avg, suffix)}</tr>`;
}

function comparisonProbabilityRow(label, match, key, homeFallback = null, awayFallback = null) {
  const home = predictionField(match, key, "home", homeFallback);
  const away = predictionField(match, key, "away", awayFallback);
  const avg = predictionField(match, key, "average", averageProbability(home, away));
  return `<tr><th>${escapeHtml(label)}</th>${goalPredictionCell(home)}${goalPredictionCell(away)}${goalPredictionCell(avg)}</tr>`;
}

function comparisonGroupRow(label) {
  return `<tr class="comparison-table__group"><th colspan="4">${escapeHtml(label)}</th></tr>`;
}

function comparisonValueCell(value, suffix = "") {
  const number = nullablePositiveNumber(value);
  return `<td class="${number === null ? "empty" : "positive"}">${number === null ? "—" : `${round(number, suffix === "%" ? 0 : 2)}${suffix}`}</td>`;
}

function predictionField(match, key, scope, fallback = null) {
  const normalized = key.replace(/\./g, "_");
  const prefixes = scope === "home" ? ["home", "team_a"] : scope === "away" ? ["away", "team_b"] : ["average", "avg", "match"];
  const values = prefixes.flatMap((prefix) => [
    match[`${prefix}_${normalized}_potential`],
    match[`${prefix}_${normalized}_percentage`],
    match[`${prefix}_${normalized}`]
  ]);
  return firstGoalProbability(...values, fallback);
}

function probabilityFromAverage(value, line) {
  return null;
}

function sumIfKnown(a, b) {
  const first = nullablePositiveNumber(a);
  const second = nullablePositiveNumber(b);
  return first === null || second === null ? null : first + second;
}

function formatLine(value) {
  return String(value).replace(".", ",");
}

function playerPairSection(title, match, homePlayers, awayPlayers, metric) {
  return `<div class="player-predictions__grid">${playerRankingCard(`${title} - ${match.homeName}`, homePlayers, metric, "home")}${playerRankingCard(`${title} - ${match.awayName}`, awayPlayers, metric, "away")}</div>`;
}

function playerRankingCard(title, players, metric, side) {
  const sorted = [...players].sort((a, b) => playerMetric(b, metric) - playerMetric(a, metric)).slice(0, 7);
  const max = Math.max(...sorted.map((player) => playerMetric(player, metric)), 1);
  return `
    <article class="player-ranking-card player-ranking-card--${side}">
      <h4>${escapeHtml(title)}</h4>
      <div>${sorted.length ? sorted.map((player) => {
        const value = playerMetric(player, metric);
        const width = Math.max(8, (value / max) * 100);
        return `<div class="player-ranking-row"><span style="width:${width}%"></span><p>🇧🇷 ${escapeHtml(player.name)} <b>${round(value, metric === "cards90" ? 2 : 0)}</b></p></div>`;
      }).join("") : `<p class="numbers-empty-note">Dados de jogadores indisponíveis.</p>`}</div>
      <small>* Estatísticas da temporada</small>
    </article>
  `;
}

function matchPlayers(match, side) {
  const teamId = side === "home" ? match.homeId : match.awayId;
  const teamName = normalizeText(side === "home" ? match.homeName : match.awayName);
  return state.players.filter((player) => {
    if (teamId && Number(player.teamId) === Number(teamId)) return true;
    return teamName && normalizeText(player.team) === teamName;
  });
}

function renderNumbersSubtabs(rootId, groups) {
  const first = groups[0]?.[0];
  return `
    <div class="numbers-subtabs-wrap" data-numbers-subtabs-root="${escapeHtml(rootId)}">
      <div class="numbers-subtabs" role="tablist">
        ${groups.map(([id, title], index) => `<button type="button" class="numbers-subtab ${index === 0 ? "is-active" : ""}" data-numbers-subtab="${escapeHtml(id)}">${escapeHtml(title)}</button>`).join("")}
      </div>
      ${groups.map(([id, title, rows], index) => `
        <div class="numbers-subpanel ${index === 0 ? "is-active" : ""}" data-numbers-subpanel="${escapeHtml(id)}">
          <div class="numbers-data-card">
            <h4>${escapeHtml(title)}</h4>
            <div class="numbers-lines-list">${rows.join("")}</div>
          </div>
        </div>
      `).join("")}
      ${officialDataLegend()}
    </div>
  `;
}

function switchNumbersSubtab(subtabId, root) {
  if (!subtabId || !root) return;
  root.querySelectorAll("[data-numbers-subtab]").forEach((button) => button.classList.toggle("is-active", button.dataset.numbersSubtab === subtabId));
  root.querySelectorAll("[data-numbers-subpanel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.numbersSubpanel === subtabId));
}

function numberLine(label, value, suffix = "") {
  return `
    <div class="numbers-line numbers-line--plain">
      <div class="numbers-line__meta"><span>${escapeHtml(label)}</span><strong>${formatStatValue(value, suffix)}</strong></div>
    </div>
  `;
}

function goalLine(label, probability) {
  const pct = formatProbabilityNumber(probability);
  const width = pct === null ? 0 : pct;
  return `
    <div class="numbers-line">
      <div class="numbers-line__meta"><span>${escapeHtml(label)}</span><strong>${pct === null ? "—" : `${pct}%`}</strong></div>
      <div class="numbers-line__track"><span style="width:${width}%"></span></div>
    </div>
  `;
}

function statLine(label, homeValue, awayValue, totalValue = null, suffix = "") {
  return `
    <div class="numbers-stat-row">
      <strong>${formatStatValue(homeValue, suffix)}</strong>
      <div><span>${escapeHtml(label)}</span><div class="numbers-stat-bar">${statBar(homeValue, awayValue)}</div>${totalValue !== null && totalValue !== undefined ? `<small>Total: ${formatStatValue(totalValue, suffix)}</small>` : ""}</div>
      <strong>${formatStatValue(awayValue, suffix)}</strong>
    </div>
  `;
}

function statBar(homeValue, awayValue) {
  const home = nullablePositiveNumber(homeValue) || 0;
  const away = nullablePositiveNumber(awayValue) || 0;
  const total = home + away;
  const homeWidth = total ? (home / total) * 100 : 50;
  const awayWidth = total ? (away / total) * 100 : 50;
  return `<i style="width:${homeWidth}%"></i><b style="width:${awayWidth}%"></b>`;
}

function formatStatValue(value, suffix = "") {
  const number = nullablePositiveNumber(value);
  if (number === null) return "—";
  return `${round(number, suffix === "%" ? 0 : 2)}${suffix}`;
}

function formatProbability(value) {
  const pct = formatProbabilityNumber(value);
  return pct === null ? "—" : `${pct}%`;
}

function formatProbabilityNumber(value) {
  const prob = clampProbability(value);
  if (!Number.isFinite(prob)) return null;
  return Math.round(prob * 100);
}

function inverseProbability(value) {
  const prob = clampProbability(value);
  return Number.isFinite(prob) ? 1 - prob : null;
}

function estimateFromPotential(value, delta = 0) {
  const pct = formatProbabilityNumber(value);
  if (pct === null) return null;
  return clamp((pct + delta) / 100, 0.01, 0.99);
}

function probabilityFromTotal(total, line) {
  const number = nullablePositiveNumber(total);
  if (number === null) return null;
  return number > line ? 0.75 : number === line ? 0.5 : 0.35;
}

function probabilityFromStat(homeValue, awayValue, line) {
  const home = nullablePositiveNumber(homeValue);
  const away = nullablePositiveNumber(awayValue);
  const best = Math.max(home || 0, away || 0);
  if (!best) return null;
  return probabilityFromTotal(best, line);
}

function shotConversion(match, side) {
  if (match.status !== "complete") return null;
  const shots = side === "home" ? match.stats.shotsHome : match.stats.shotsAway;
  const goals = side === "home" ? match.homeGoals : match.awayGoals;
  if (!nullablePositiveNumber(shots) || !nullablePositiveNumber(goals)) return null;
  return (goals / shots) * 100;
}

function shotsPerGoal(match, side) {
  if (match.status !== "complete") return null;
  const shots = side === "home" ? match.stats.shotsHome : match.stats.shotsAway;
  const goals = side === "home" ? match.homeGoals : match.awayGoals;
  if (!nullablePositiveNumber(shots) || !nullablePositiveNumber(goals)) return null;
  return shots / goals;
}

function playersColumn(teamName, players, metric) {
  const sorted = [...players].sort((a, b) => playerMetric(b, metric) - playerMetric(a, metric)).slice(0, 5);
  return `
    <div class="numbers-player-list">
      <h5>${escapeHtml(teamName)}</h5>
      ${sorted.length ? sorted.map((player) => playerMetricRow(player, metric)).join("") : `<p class="numbers-empty-note">Dados de jogadores indisponíveis.</p>`}
    </div>
  `;
}

function playerMetricRow(player, metric) {
  const value = playerMetric(player, metric);
  return `
    <div class="numbers-player-row">
      <span>${escapeHtml(player.name)}</span>
      <strong>${value ? round(value, metric === "cards90" ? 2 : 0) : "—"}</strong>
    </div>
  `;
}

function playerMetric(player, metric) {
  if (metric === "goals") return nullablePositiveNumber(player.goals) || 0;
  if (metric === "cards") return nullablePositiveNumber(player.cards) || 0;
  if (metric === "cards90") return nullablePositiveNumber(player.cardsPer90) || 0;
  return 0;
}

function officialDataLegend() {
  return `<p class="numbers-empty-note">Dados preenchidos somente quando a FootyStats envia campos oficiais pelos endpoints /match, /league-matches ou /league-players.</p>`;
}

function teamNumbersForMatch(match, side) {
  const teamId = side === "home" ? match.homeId : match.awayId;
  const teamName = side === "home" ? match.homeName : match.awayName;
  const team = findTeamStatsRecord(teamId, teamName, match.leagueKey);
  const played = nullablePositiveNumber(team?.played ?? team?.seasonMatchesPlayed_overall ?? team?.matches_played);
  const goals = nullablePositiveNumber(team?.goals ?? team?.seasonGoals_overall ?? team?.goals_scored);
  const conceded = nullablePositiveNumber(team?.conceded ?? team?.seasonConceded_overall ?? team?.goals_conceded);
  return {
    goalsPerMatch: firstNumber(team?.goalsPerMatch, team?.seasonScoredAVG_overall, team?.goals_per_match, goals !== null && played ? goals / played : null),
    concededPerMatch: firstNumber(team?.concededPerMatch, team?.seasonConcededAVG_overall, team?.goals_conceded_per_match, conceded !== null && played ? conceded / played : null),
    corners: firstNumber(team?.corners, team?.cornersAVG_overall, team?.corners_per_match, team?.average_corners),
    cornersAgainst: firstNumber(team?.cornersAgainst, team?.cornersAgainstAVG_overall, team?.corners_against_per_match),
    cards: firstNumber(team?.cards, team?.cardsAVG_overall, team?.cards_per_match, team?.average_cards),
    cardsAgainst: firstNumber(team?.cardsAgainst, team?.cardsAgainstAVG_overall, team?.cards_against_per_match),
    shots: firstNumber(team?.shots, team?.shotsAVG_overall, team?.shots_per_match, team?.average_shots),
    shotsOnTarget: firstNumber(team?.shotsOnTarget, team?.shotsOnTargetAVG_overall, team?.shots_on_target_per_match),
    shotsOffTarget: firstNumber(team?.shotsOffTarget, team?.shotsOffTargetAVG_overall, team?.shots_off_target_per_match),
    shotConversion: firstNumber(team?.shotConversion, team?.shotConversionAVG_overall, team?.shot_conversion),
    shotsPerGoal: firstNumber(team?.shotsPerGoal, team?.shots_per_goal),
    offsides: firstNumber(team?.offsides, team?.offsidesAVG_overall, team?.offsides_per_match),
    fouls: firstNumber(team?.fouls, team?.foulsAVG_overall, team?.fouls_per_match),
    fouled: firstNumber(team?.fouled, team?.fouledAVG_overall, team?.fouled_per_match, team?.fouls_suffered_per_match),
    possession: firstNumber(team?.possession, team?.possessionAVG_overall, team?.average_possession)
  };
}

function findTeamStatsRecord(teamId, teamName, leagueKey) {
  const normalized = normalizeText(teamName || "");
  return state.teamStats.find((team) => teamId && Number(team.id) === Number(teamId)) ||
    state.teamStats.find((team) => leagueKey && team.leagueKey === leagueKey && normalizeText(team.name || team.fullName || "") === normalized) ||
    state.teamStats.find((team) => normalizeText(team.name || team.fullName || "") === normalized) ||
    state.matchTeams.find((team) => teamId && Number(team.id) === Number(teamId)) ||
    state.matchTeams.find((team) => normalizeText(team.name || team.fullName || "") === normalized) || null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = nullablePositiveNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function teamStatCard(teamName, label, value, suffix = "") {
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  return `
    <div class="numbers-team-stat">
      <small>${escapeHtml(label)}</small>
      <strong>${hasValue ? `${round(Number(value), suffix ? 0 : 2)}${suffix}` : "—"}</strong>
      <span>${escapeHtml(teamName)}</span>
    </div>
  `;
}

function officialDataNote(...args) {
  const message = args[args.length - 1];
  const values = args.slice(0, -1);
  const hasAny = values.some((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  return hasAny ? "" : `<p class="numbers-empty-note">${escapeHtml(message)}</p>`;
}

function closeModal() {
  els.matchModal.classList.remove("open");
  els.matchModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function updateApiStatus() {
  const isConnected = state.mode === "api";
  els.apiStatus.innerHTML = `
    <span class="status-dot" style="${isConnected ? "" : "background:var(--danger);box-shadow:0 0 0 4px var(--danger-soft)"}"></span>
    <div>
      <strong>${isConnected ? "FootyStats conectada" : "FootyStats desconectada"}</strong>
      <small>${isConnected ? `${state.leagues.length} ligas sincronizadas` : "Nenhum dado fictício será exibido"}</small>
    </div>
  `;
}

function setLoading(loading, scope = "all") {
  state.loading = loading;
  if (scope === "all") {
    els.refreshButton.classList.toggle("is-spinning", loading);
    els.refreshButton.disabled = loading;
  }
}

function updateLastSync() {
  els.lastUpdate.textContent = `às ${formatTime(new Date())}`;
}

function showToast(title, message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-triangle-exclamation" : "fa-circle-check"}"></i><div><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>`;
  els.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5200);
}

function openSidebar() {
  els.sidebar.classList.add("open");
  els.sidebarOverlay.classList.add("visible");
}

function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.sidebarOverlay.classList.remove("visible");
}

function setTodayLabel() {
  if (els.todayLabel) {
    els.todayLabel.textContent = formatDate(new Date(), { day: "numeric", month: "long" });
  }
}

function setActiveButton(container, activeButton) {
  container.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === activeButton));
}

function getDataArray(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.data,
    payload?.data?.data,
    payload?.data?.matches,
    payload?.data?.fixtures,
    payload?.matches,
    payload?.fixtures,
    payload?.teams,
    payload?.players,
    payload?.leagues,
    payload?.response,
    payload?.results
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  if (payload?.data && typeof payload.data === "object") {
    const nested = Object.values(payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(nested)) return nested;
  }
  return [];
}
function cleanLeagueName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Campeonato";
  const generic = ["campeonato", "league", "liga", "competition", "torneio"];
  const normalized = normalizeText(raw);
  if (generic.includes(normalized)) return "Campeonato";
  return raw;
}

function extractLeagueName(raw, league = null) {
  const candidates = [
    raw.competition_name,
    raw.league_name,
    raw.season_name,
    raw.competition?.name,
    raw.league?.name,
    raw.season?.name,
    raw.competition?.cleanName,
    raw.league?.cleanName,
    raw.country_name && raw.competition_name ? `${raw.country_name} · ${raw.competition_name}` : null,
    raw.country && raw.competition_name ? `${raw.country} · ${raw.competition_name}` : null,
    league?.name
  ];

  for (const candidate of candidates) {
    const name = cleanLeagueName(candidate);
    if (name !== "Campeonato") return name;
  }

  if (league?.name) return league.name;
  return "Campeonato";
}

function findLeagueForRawMatch(raw) {
  const competitionId = Number(raw.competition_id || raw.season_id || raw.league_id || raw.competition?.id || raw.league?.id || 0);
  const allLeagues = [...state.leagues, ...(state.leagueIndex || [])];
  const byId = allLeagues.find((league) => league.seasonId === competitionId || league.id === competitionId);
  if (byId) return byId;

  const rawName = normalizeText(extractLeagueName(raw, null));
  if (!rawName) return null;

  return allLeagues.find((league) => {
    const leagueName = normalizeText(league.name || league.apiName || "");
    const aliases = league.aliases || [];
    return leagueName === rawName || leagueName.includes(rawName) || rawName.includes(leagueName) ||
      aliases.some((alias) => rawName.includes(normalizeText(alias)));
  }) || null;
}

function findMatchTeam(teamId, name = "") {
  const id = Number(teamId || 0);
  const normalizedName = normalizeText(name);
  const pools = [state.matchTeams, state.teamStats];

  if (id) {
    for (const pool of pools) {
      const byId = pool.find((team) => team.id === id || Number(team.team_id) === id);
      if (byId) return byId;
    }
  }

  if (normalizedName) {
    for (const pool of pools) {
      const byName = pool.find((team) => {
        const names = [team.name, team.fullName, team.english_name, team.cleanName, team.shortHand].filter(Boolean).map(normalizeText);
        return names.some((teamName) => teamName === normalizedName || teamName.includes(normalizedName) || normalizedName.includes(teamName));
      });
      if (byName) return byName;
    }
  }

  return null;
}

function getTeamLogo(raw, side) {
  const prefix = side === "home" ? "home" : "away";
  const teamPrefix = side === "home" ? "team_a" : "team_b";
  const nested = side === "home" ? raw.homeTeam : raw.awayTeam;
  return sanitizeImageUrl(
    raw[`${prefix}_image`] ||
    raw[`${prefix}_logo`] ||
    raw[`${prefix}_badge`] ||
    raw[`${prefix}_crest`] ||
    raw[`${prefix}_team_image`] ||
    raw[`${prefix}_team_logo`] ||
    raw[`${prefix}_team_badge`] ||
    raw[`${teamPrefix}_image`] ||
    raw[`${teamPrefix}_logo`] ||
    raw[`${teamPrefix}_badge`] ||
    raw[`${teamPrefix}_crest`] ||
    raw[`${teamPrefix}_team_logo`] ||
    raw[`${teamPrefix}_team_image`] ||
    nested?.image ||
    nested?.logo ||
    nested?.badge ||
    nested?.crest ||
    nested?.image_url ||
    nested?.team_logo ||
    nested?.team_badge
  );
}

function sanitizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url || url === "0" || url.toLowerCase() === "null" || url.toLowerCase() === "undefined") return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;

  const clean = url.replace(/^\/+/, "");
  if (clean.startsWith("img/")) return `https://cdn.footystats.org/${clean}`;
  if (/^(teams|competitions|players)\//i.test(clean)) return `https://cdn.footystats.org/img/${clean}`;
  return null;
}

function getNationalTeamFlagUrl(name) {
  const countryCodes = {
    afghanistan: "af",
    algeria: "dz",
    argentina: "ar",
    bolivia: "bo",
    brazil: "br",
    brasil: "br",
    chile: "cl",
    colombia: "co",
    "costa rica": "cr",
    croatia: "hr",
    england: "gb-eng",
    espanha: "es",
    france: "fr",
    germany: "de",
    italia: "it",
    italy: "it",
    nigeria: "ng",
    pakistan: "pk",
    portugal: "pt",
    uruguay: "uy"
  };
  const code = countryCodes[normalizeText(name)];
  return code ? `https://flagcdn.com/${code}.svg` : null;
}

function getMatchTimestamp(raw) {
  const unix = Number(raw.date_unix || raw.timestamp || raw.match_timestamp || raw.time);
  if (Number.isFinite(unix) && unix > 100000000) return unix > 100000000000 ? unix : unix * 1000;
  const parsed = new Date(raw.date || raw.match_date || raw.kickoff || Date.now()).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function normalizeMinute(value) {
  const raw = String(value ?? "").trim();
  if (!raw || normalizeText(raw) === "ft") return 0;
  const match = raw.match(/\d{1,3}/);
  return match ? Number(match[0]) : 0;
}

function normalizeStatus(status, timestamp, raw = {}) {
  const value = normalizeText(status || "");
  const minuteValue = String(raw.minute ?? raw.match_minute ?? raw.elapsed ?? raw.game_minute ?? "").trim();
  const normalizedMinute = normalizeText(minuteValue);

  const exact = (...items) => items.includes(value);
  const containsAny = (...items) => items.some((item) => value.includes(item));

  const minuteSaysFinished = exactMinuteFinished(normalizedMinute);
  const minuteSaysLive = /^\d{1,3}(\+\d{1,2})?$/.test(normalizedMinute) || ["ht", "half time", "1h", "2h"].includes(normalizedMinute);

  if (containsAny("cancelled", "canceled")) return "cancelled";
  if (containsAny("postponed")) return "postponed";
  if (containsAny("suspended", "abandoned")) return "suspended";

  // Importante: FootyStats usa "incomplete" para jogos ainda não finalizados.
  // "incomplete" contém a palavra "complete", então nunca pode ser testado com includes("complete").
  if (exact("incomplete", "scheduled", "pre match", "pre-match", "not started", "pending", "tba")) return "scheduled";

  if (minuteSaysLive || exact("live", "in play", "inplay", "playing", "half time", "1h", "2h", "ht")) return "live";

  // Só marcar encerrado quando a API confirmar claramente finalizado.
  if (minuteSaysFinished || exact("complete", "finished", "ft", "full time", "full-time", "ended", "finalizado")) return "complete";

  return "scheduled";
}

function exactMinuteFinished(value) {
  return ["ft", "full time", "full-time", "fulltime", "ended"].includes(value);
}

function statusPill(match) {
  const dot = match.status === "live" ? "<i></i>" : "";
  return `<span class="status-pill ${match.status}">${dot}${escapeHtml(statusLabel(match))}</span>`;
}

function statusLabel(match) {
  if (match.status === "live") return match.minute ? `${match.minute}' · Ao vivo` : "Ao vivo";
  if (match.status === "complete") return "Encerrado";
  if (match.status === "cancelled") return "Cancelado";
  if (match.status === "postponed") return "Adiado";
  if (match.status === "suspended") return "Suspenso";
  return "Pré-jogo";
}

function shouldShowMatchScore(match) {
  return match.status === "complete" &&
    match.homeGoals !== null &&
    match.awayGoals !== null;
}

function scoreText(match) {
  if (!shouldShowMatchScore(match)) return formatTime(match.date);
  return `${match.homeGoals} – ${match.awayGoals}`;
}

function formatMatchTime(match) {
  if (match.status === "live") return match.minute ? `${match.minute}' · Ao vivo` : "Ao vivo";
  if (match.status === "complete") return "Encerrado";
  return formatTime(match.date);
}

function bestMarketForMatch(match) {
  const bets = state.valueBets.filter((bet) => String(bet.match.id) === String(match.id));
  if (bets.length) {
    const bet = bets[0];
    return { label: bet.market, odd: bet.odd, probability: bet.probability, value: bet.value };
  }
  return {
    label: "Dados não disponíveis",
    odd: null,
    probability: null,
    value: null
  };
}

function modalAnalysis(match, market) {
  if (match.status === "live") {
    return `O ritmo atual mantém ${market.label.toLowerCase()} como principal leitura. Considere a variação da odd ao vivo antes de qualquer decisão.`;
  }
  return `A combinação de probabilidade estimada, preço de mercado e indicadores recentes destaca ${market.label.toLowerCase()} como a opção de maior interesse estatístico.`;
}

function leagueIcon() {
  return "";
}

function teamCrest(name, color = "#00c853", image = null) {
  const safeImage = sanitizeImageUrl(image);
  const flagImage = safeImage ? null : getNationalTeamFlagUrl(name);
  const imageUrl = safeImage || flagImage;
  const content = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : escapeHtml(initials(name));
  return `<span class="team-crest" style="--league-color:${color}">${content}</span>`;
}

function compactTeamRow(name, goals, color, image = null, showScore = true) {
  const score = showScore && goals !== null && goals !== undefined ? goals : "";
  return `<div class="match-team">${teamCrest(name, color, image)}<span>${escapeHtml(name)}</span><strong>${score}</strong></div>`;
}

function tableTeam(name, goals, color, image = null, showScore = true) {
  const score = showScore && goals !== null && goals !== undefined ? goals : "";
  return `<div class="table-match__team">${teamCrest(name, color, image)}<span>${escapeHtml(name)}</span><b>${score}</b></div>`;
}

function tipTeam(name, color, image = null) {
  return `<div class="tip-team">${teamCrest(name, color, image)}<strong>${escapeHtml(name)}</strong></div>`;
}

function stars(value) {
  return `<span class="stars" aria-label="${value} de 5 estrelas">${Array.from({ length: 5 }, (_, index) => `<i class="${index < value ? "fa-solid" : "fa-regular"} fa-star"></i>`).join("")}</span>`;
}

function statusWeight(status) {
  return { live: 0, scheduled: 1, complete: 2 }[status] ?? 3;
}

function average(values) {
  const valid = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function formatAverage(value, decimals, suffix = "") {
  return value === null ? "—" : `${round(value, decimals)}${suffix}`;
}

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = nullablePositiveNumber(value);
    if (number !== null && number > 0) return number;
  }
  return null;
}

function addNullable(a, b) {
  const na = nullablePositiveNumber(a);
  const nb = nullablePositiveNumber(b);
  if (na === null && nb === null) return null;
  return (na || 0) + (nb || 0);
}

function nullablePositiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || Number(value) < 0) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstProbability(...values) {
  for (const value of values) {
    const probability = clampProbability(value);
    if (Number.isFinite(probability)) return probability;
  }
  return null;
}

function clampProbability(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return clamp(number > 1 ? number / 100 : number, 0.01, 0.99);
}

function isApiConfigured() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dayDifference(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
}

function isSameDay(a, b) {
  return formatApiDate(a) === formatApiDate(b);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatApiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(date));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function formatOdd(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2).replace(".", ",") : "—";
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function slugify(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function initials(name) {
  const parts = String(name).replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").trim().split(/\s+/);
  if (!parts.length) return "FC";
  return `${parts[0]?.[0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || ""}`.toUpperCase();
}

function colorFromString(value) {
  const palette = ["#00c853", "#59a8ff", "#9d8cff", "#ffb547", "#ff5d6c", "#35b8a0", "#e06ce0", "#7bc95b"];
  return palette[hashString(value) % palette.length];
}

function secondaryColor(color) {
  const palette = {
    "#00c853": "#59a8ff",
    "#f4b400": "#9d8cff",
    "#5ee68c": "#ffb547",
    "#ff8f3d": "#59a8ff",
    "#9d8cff": "#00c853",
    "#ff5d6c": "#59a8ff",
    "#e84747": "#ffb547",
    "#59a8ff": "#ff5d6c",
    "#35b8a0": "#9d8cff"
  };
  return palette[color] || "#59a8ff";
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const number = Number.parseInt(normalized, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < String(value).length; index += 1) {
    hash = ((hash << 5) - hash) + String(value).charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emptyInline(message) {
  return `<div class="empty-state" style="padding:35px 15px"><i class="fa-regular fa-face-meh"></i><p>${escapeHtml(message)}</p></div>`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
