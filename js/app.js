const API_BASE_URL = "/api/footystats";
const APP_TIMEZONE = "America/Sao_Paulo";
const API_TIMEOUT = 15000;

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
  estatisticas: { title: "Estatísticas", eyebrow: "Performance em números" },
  odds: { title: "Odds e valor", eyebrow: "Mercados e probabilidades" },
  h2h: { title: "Confrontos H2H", eyebrow: "Histórico comparativo" },
  tips: { title: "Tips do dia", eyebrow: "Análises editoriais" }
};

const state = {
  mode: "api",
  selectedDate: startOfDay(new Date()),
  leagues: [],
  leagueIndex: [],
  matchTeams: [],
  matches: [],
  teams: [],
  players: [],
  tips: [],
  valueBets: [],
  matchStatus: "all",
  matchLeague: "all",
  matchSearch: "",
  oddsLeague: "all",
  oddsMarket: "all",
  minValue: 3,
  tipFilter: "all",
  statsTab: "teams",
  statsLeagueKey: "brasileirao-a",
  activeSection: "dashboard",
  loading: false,
  charts: {
    radar: null
  }
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
    "matchesEmpty", "statsLeagueFilter", "statsOverview", "teamRanking",
    "teamsStatsView", "playersStatsView", "playerLeaders", "playersTableBody",
    "oddsSummary", "oddsLeagueFilter", "oddsMarketFilter", "valueRange",
    "valueRangeLabel", "valueBetsGrid", "homeTeamSelect", "awayTeamSelect",
    "compareTeamsButton", "h2hContent", "tipsFilter", "tipsGrid", "matchModal",
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
  const leaguePayload = await apiFetch("/league-list", { chosen_leagues_only: "true" });
  const availableLeagues = getDataArray(leaguePayload);
  state.leagueIndex = buildLeagueIndex(availableLeagues);
  state.leagues = resolveTargetLeagues(availableLeagues);

  if (!state.leagues.length) {
    throw new Error("Nenhum dos campeonatos configurados está disponível no plano da API.");
  }

  if (!state.leagues.some((league) => league.key === state.statsLeagueKey)) {
    state.statsLeagueKey = state.leagues[0].key;
  }

  await loadMatchTeams();

  const date = formatApiDate(state.selectedDate);
  const matchesPayload = await apiFetch("/todays-matches", {
    date,
    timezone: APP_TIMEZONE
  });
  const rawMatches = getDataArray(matchesPayload);
  state.matches = rawMatches.map((match) => normalizeMatch(match));

  await loadLeagueStats(state.statsLeagueKey, { silent: true });
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

    const payload = await apiFetch("/todays-matches", {
      date: formatApiDate(state.selectedDate),
      timezone: APP_TIMEZONE
    });
    state.matches = getDataArray(payload).map((match) => normalizeMatch(match));
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


async function loadMatchTeams() {
  const teamRequests = state.leagues.map(async (league) => {
    try {
      const payload = await apiFetch("/league-teams", {
        season_id: league.seasonId
      });
      return getDataArray(payload).map((team) => normalizeTeamIdentity(team, league));
    } catch (error) {
      console.warn(`Times indisponíveis para ${league.name}:`, error);
      return [];
    }
  });

  const groups = await Promise.all(teamRequests);
  state.matchTeams = groups.flat();
}

async function loadLeagueStats(leagueKey, { silent = false } = {}) {
  const league = state.leagues.find((item) => item.key === leagueKey) || state.leagues[0];
  if (!league) return;

  state.statsLeagueKey = league.key;
  if (!silent) {
    renderStatsSkeleton();
  }

  try {
    const [teamsPayload, playersPayload] = await Promise.all([
      apiFetch("/league-teams", {
        season_id: league.seasonId,
        include: "stats"
      }),
      apiFetch("/league-players", {
        season_id: league.seasonId,
        page: 1
      })
    ]);

    state.teams = getDataArray(teamsPayload).map((team) => normalizeTeam(team, league));
    state.players = getDataArray(playersPayload).map((player) => normalizePlayer(player, state.teams));
  } catch (error) {
    console.error(error);
    state.teams = [];
    state.players = [];
    showToast("Estatísticas indisponíveis", "A FootyStats não retornou dados para esta liga.", "error");
  }
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

function normalizeMatch(raw) {
  const league = findLeagueForRawMatch(raw);
  const timestamp = getMatchTimestamp(raw);
  const status = normalizeStatus(raw.status, timestamp, raw);
  const homeId = Number(raw.homeID || raw.home_id || raw.homeTeam?.id || raw.team_a_id || raw.team_a?.id || 0);
  const awayId = Number(raw.awayID || raw.away_id || raw.awayTeam?.id || raw.team_b_id || raw.team_b?.id || 0);
  const rawHomeName = raw.home_name || raw.homeTeam?.name || raw.home_team_name || raw.team_a_name || raw.team_a?.name || "Mandante";
  const rawAwayName = raw.away_name || raw.awayTeam?.name || raw.away_team_name || raw.team_b_name || raw.team_b?.name || "Visitante";
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
      home: nullablePositiveNumber(raw.odds_ft_1 || raw.odds_1 || raw.odds?.home),
      draw: nullablePositiveNumber(raw.odds_ft_X || raw.odds_x || raw.odds?.draw),
      away: nullablePositiveNumber(raw.odds_ft_2 || raw.odds_2 || raw.odds?.away),
      over25: nullablePositiveNumber(raw.odds_ft_over25 || raw.odds_over_25 || raw.odds?.over25),
      btts: nullablePositiveNumber(raw.odds_btts_yes || raw.odds_btts || raw.odds?.btts)
    },
    probabilities: {
      home: clampProbability(raw.home_win_percentage || raw.homeWinProbability),
      draw: clampProbability(raw.draw_percentage || raw.drawProbability),
      away: clampProbability(raw.away_win_percentage || raw.awayWinProbability),
      over15: firstProbability(raw.over15, raw.over_15_percentage, raw.o15_potential, raw.over15Probability),
      over25: firstProbability(raw.over25, raw.over_25_percentage, raw.o25_potential, raw.over25Probability),
      over35: firstProbability(raw.over35, raw.over_35_percentage, raw.o35_potential, raw.over35Probability),
      btts: firstProbability(raw.btts_percentage, raw.btts_potential, raw.bttsProbability),
      cornersOver85: firstProbability(raw.corners_o85_potential, raw.corners_over_85_percentage, raw.cornersOver85Probability),
      cornersOver95: firstProbability(raw.corners_o95_potential, raw.corners_over_95_percentage, raw.cornersOver95Probability),
      cornersOver105: firstProbability(raw.corners_o105_potential, raw.corners_over_105_percentage, raw.cornersOver105Probability),
      cardsOver35: firstProbability(raw.cards_o35_potential, raw.cards_over_35_percentage, raw.cardsOver35Probability, raw.cards_potential),
      cardsOver45: firstProbability(raw.cards_o45_potential, raw.cards_over_45_percentage, raw.cardsOver45Probability),
      cardsOver55: firstProbability(raw.cards_o55_potential, raw.cards_over_55_percentage, raw.cardsOver55Probability)
    },
    stats: {
      possessionHome: nullablePositiveNumber(raw.team_a_possession),
      possessionAway: nullablePositiveNumber(raw.team_b_possession),
      shotsHome: nullablePositiveNumber(raw.team_a_shots),
      shotsAway: nullablePositiveNumber(raw.team_b_shots),
      cornersHome: nullablePositiveNumber(raw.team_a_corners),
      cornersAway: nullablePositiveNumber(raw.team_b_corners),
      cardsHome: nullablePositiveNumber(raw.team_a_cards_num),
      cardsAway: nullablePositiveNumber(raw.team_b_cards_num)
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
    corners: nullablePositiveNumber(stats.cornersAVG_overall ?? stats.corners_per_match ?? stats.average_corners),
    shots: nullablePositiveNumber(stats.shotsAVG_overall ?? stats.shots_per_match ?? stats.average_shots ?? stats.shotsAVG),
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
  state.teams = [];
  state.players = [];
  state.tips = [];
  state.valueBets = [];
}

function renderAll() {
  populateLeagueFilters();
  renderDashboard();
  renderDateStrip();
  renderMatches();
  renderStats();
  renderOdds();
  populateTeamSelectors();
  renderH2H();
  renderTips();
}

function populateLeagueFilters() {
  const allOption = `<option value="all">Todos os campeonatos</option>`;
  const options = state.leagues.map((league) => `<option value="${league.key}">${escapeHtml(league.name)}</option>`).join("");
  if (els.matchLeagueFilter) els.matchLeagueFilter.innerHTML = allOption + options;
  els.oddsLeagueFilter.innerHTML = allOption + options;
  els.statsLeagueFilter.innerHTML = state.leagues.map((league) => `
    <option value="${league.key}" ${league.key === state.statsLeagueKey ? "selected" : ""}>${escapeHtml(league.name)}</option>
  `).join("");
  if (els.matchLeagueFilter) els.matchLeagueFilter.value = state.matchLeague;
  els.oddsLeagueFilter.value = state.oddsLeague;
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

function renderStats() {
  if (!state.teams.length && !state.players.length) {
    els.statsOverview.innerHTML = `
      <div class="panel empty-state" style="grid-column:1/-1">
        <i class="fa-solid fa-chart-column"></i>
        <h3>Estatísticas não retornadas</h3>
        <p>A FootyStats não forneceu dados de times ou jogadores para esta seleção.</p>
      </div>
    `;
    els.teamRanking.innerHTML = emptyInline("Nenhum time disponível.");
    els.playerLeaders.innerHTML = "";
    els.playersTableBody.innerHTML = `<tr><td colspan="8">${emptyInline("Nenhum jogador disponível.")}</td></tr>`;
    return;
  }

  const sortedTeams = [...state.teams].sort((a, b) => b.ppg - a.ppg);
  const avgGoals = average(sortedTeams.map((team) => team.goalsPerMatch));
  const avgPossession = average(sortedTeams.map((team) => team.possession));
  const avgCards = average(sortedTeams.map((team) => team.cards));
  const avgCorners = average(sortedTeams.map((team) => team.corners));

  els.statsOverview.innerHTML = [
    miniStat("fa-regular fa-futbol", "Gols por jogo", formatAverage(avgGoals, 2), "#00c853"),
    miniStat("fa-solid fa-chart-pie", "Posse média", formatAverage(avgPossession, 1, "%"), "#59a8ff"),
    miniStat("fa-regular fa-clone", "Cartões por jogo", formatAverage(avgCards, 1), "#ffb547"),
    miniStat("fa-solid fa-flag", "Escanteios por jogo", formatAverage(avgCorners, 1), "#9d8cff")
  ].join("");

  els.teamRanking.innerHTML = sortedTeams.slice(0, 8).map((team, index) => `
    <div class="ranking-row">
      <span class="ranking-position ${index < 3 ? "top" : ""}">${String(index + 1).padStart(2, "0")}</span>
      <div class="ranking-team">${teamCrest(team.name, team.color)}<strong>${escapeHtml(team.name)}</strong></div>
      ${rankingData("Aprov.", `${Math.round(team.winRate)}%`)}
      ${rankingData("Gols", round(team.goalsPerMatch, 2))}
      ${rankingData("Posse", `${round(team.possession, 0)}%`)}
      ${rankingData("PPG", round(team.ppg, 2))}
    </div>
  `).join("");

  const sortedPlayers = [...state.players].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));
  const topScorer = [...state.players].sort((a, b) => b.goals - a.goals)[0];
  const topAssist = [...state.players].sort((a, b) => b.assists - a.assists)[0];
  const topRating = [...state.players].sort((a, b) => b.rating - a.rating)[0];

  els.playerLeaders.innerHTML = [
    playerLeader("Artilheiro", topScorer, topScorer?.goals != null ? `${topScorer.goals} gols` : "—"),
    playerLeader("Garçom", topAssist, topAssist?.assists != null ? `${topAssist.assists} assist.` : "—"),
    playerLeader("Maior nota", topRating, topRating?.rating?.toFixed(1) || "—")
  ].join("");

  els.playersTableBody.innerHTML = sortedPlayers.slice(0, 20).map((player, index) => `
    <tr>
      <td>${String(index + 1).padStart(2, "0")}</td>
      <td><div class="player-name"><span class="player-avatar">${initials(player.name)}</span>${escapeHtml(player.name)}</div></td>
      <td>${escapeHtml(player.team)}</td>
      <td>${displayApiValue(player.appearances)}</td>
      <td>${displayApiValue(player.goals)}</td>
      <td>${displayApiValue(player.assists)}</td>
      <td>${displayApiValue(player.minutesPerGoal)}</td>
      <td>${player.rating === null ? "—" : `<span class="rating-badge">${Number(player.rating).toFixed(1)}</span>`}</td>
    </tr>
  `).join("");

  renderTeamRadarChart(sortedTeams.slice(0, 3));
}

function renderStatsSkeleton() {
  els.statsOverview.innerHTML = Array.from({ length: 4 }, () => `<div class="mini-stat skeleton-card" style="height:75px"></div>`).join("");
  els.teamRanking.innerHTML = `<div class="skeleton-card" style="height:360px;border-radius:12px;margin:15px 0"></div>`;
  els.playersTableBody.innerHTML = `<tr><td colspan="8"><div class="skeleton-card" style="height:280px;border-radius:12px"></div></td></tr>`;
}

function miniStat(icon, label, value, color) {
  return `
    <div class="mini-stat">
      <span class="mini-stat__icon" style="--stat-color:${color}"><i class="${icon}"></i></span>
      <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong></div>
    </div>
  `;
}

function rankingData(label, value) {
  return `<div class="ranking-data"><small>${label}</small><strong>${value}</strong></div>`;
}

function playerLeader(type, player, value) {
  if (!player) return "";
  return `
    <article class="player-leader">
      <span class="player-leader__type">${escapeHtml(type)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <h3>${escapeHtml(player.name)}</h3>
      <p>${escapeHtml(player.team)}</p>
    </article>
  `;
}

function renderOdds() {
  const filtered = state.valueBets.filter((bet) => {
    const leagueMatch = state.oddsLeague === "all" || bet.leagueKey === state.oddsLeague;
    const marketMatch = state.oddsMarket === "all" || bet.marketType === state.oddsMarket;
    return leagueMatch && marketMatch && bet.value >= state.minValue;
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
  return `A FootyStats informa ${round(bet.probability * 100, 1)}% de probabilidade para este mercado. Com odd ${formatOdd(bet.odd)}, a diferença matemática calculada é de +${round(bet.value, 1)}%.`;
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

function populateTeamSelectors() {
  const options = state.teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("");
  els.homeTeamSelect.innerHTML = options;
  els.awayTeamSelect.innerHTML = options;
  if (state.teams.length > 1) {
    els.awayTeamSelect.selectedIndex = 1;
  }
}

async function renderH2H({ fetchReal = false } = {}) {
  const home = state.teams.find((team) => String(team.id) === els.homeTeamSelect.value) || state.teams[0];
  let away = state.teams.find((team) => String(team.id) === els.awayTeamSelect.value) || state.teams[1];

  if (!home || !away) {
    els.h2hContent.innerHTML = `<div class="panel empty-state"><i class="fa-solid fa-code-compare"></i><h3>Selecione um campeonato com times disponíveis</h3></div>`;
    return;
  }

  if (home.id === away.id) {
    away = state.teams.find((team) => team.id !== home.id);
    els.awayTeamSelect.value = String(away.id);
  }

  if (!fetchReal) {
    els.h2hContent.innerHTML = `
      <div class="panel empty-state">
        <i class="fa-solid fa-code-compare"></i>
        <h3>Escolha os times para consultar</h3>
        <p>O histórico será carregado diretamente da FootyStats.</p>
      </div>
    `;
    return;
  }

  let history = [];
  els.h2hContent.innerHTML = `<div class="panel skeleton-card" style="height:420px"></div>`;
  try {
    history = await fetchH2HHistory(home, away);
  } catch (error) {
    console.error(error);
    els.h2hContent.innerHTML = `
      <div class="panel error-state">
        <i class="fa-solid fa-cloud-arrow-down"></i>
        <h3>Histórico indisponível</h3>
        <p>${escapeHtml(error.message || "A FootyStats não retornou confrontos para estes times.")}</p>
      </div>
    `;
    showToast("H2H indisponível", "A FootyStats não retornou dados para este confronto.", "error");
    return;
  }

  const homeWins = history.filter((match) => winnerName(match) === home.name).length;
  const awayWins = history.filter((match) => winnerName(match) === away.name).length;
  const draws = history.length - homeWins - awayWins;
  const totalGoals = history.reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0);
  const btts = history.filter((match) => match.homeGoals > 0 && match.awayGoals > 0).length;
  const over25 = history.filter((match) => match.homeGoals + match.awayGoals > 2).length;

  els.h2hContent.innerHTML = `
    <div class="h2h-grid">
      <article class="panel h2h-summary">
        ${h2hTeamScore(home, homeWins)}
        ${h2hTeamScore(away, awayWins)}
        <div class="draw-summary"><span>Empates no período</span><strong>${draws}</strong></div>
        <div class="h2h-insights">
          ${h2hInsight("Média de gols", history.length ? round(totalGoals / history.length, 2) : 0)}
          ${h2hInsight("Ambas marcam", `${history.length ? Math.round((btts / history.length) * 100) : 0}%`)}
          ${h2hInsight("Over 2.5", `${history.length ? Math.round((over25 / history.length) * 100) : 0}%`)}
          ${h2hInsight("Amostra", `${history.length} jogos`)}
        </div>
      </article>
      <article class="panel">
        <div class="panel__header"><div><h3>Últimos confrontos</h3><p>Recorte de até 10 partidas</p></div></div>
        <div class="h2h-history">
          ${history.map(h2hMatchRow).join("")}
        </div>
      </article>
    </div>
  `;
}

async function fetchH2HHistory(home, away) {
  const league = getLeague(state.statsLeagueKey);
  const schedulePayload = await apiFetch("/league-matches", {
    season_id: league.seasonId,
    max_per_page: 1000
  });
  const schedule = getDataArray(schedulePayload).map((match) => normalizeMatch(match));
  const meeting = schedule.find((match) =>
    (match.homeId === home.id && match.awayId === away.id) ||
    (match.homeId === away.id && match.awayId === home.id)
  );

  if (!meeting) {
    throw new Error("Não há confronto localizado para estes times.");
  }

  const details = await apiFetch("/match", { match_id: meeting.id });
  const matchLikeObjects = collectMatchObjects(details);
  const history = matchLikeObjects
    .map((match) => normalizeMatch(match))
    .filter((match) => {
      const names = [normalizeText(match.homeName), normalizeText(match.awayName)];
      return names.includes(normalizeText(home.name)) && names.includes(normalizeText(away.name));
    })
    .filter((match) => match.homeGoals !== null && match.awayGoals !== null)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  if (!history.length) {
    throw new Error("A API não retornou o histórico detalhado.");
  }
  return history;
}

function collectMatchObjects(value, depth = 0, found = []) {
  if (depth > 7 || value === null || value === undefined) return found;
  if (Array.isArray(value)) {
    value.forEach((item) => collectMatchObjects(item, depth + 1, found));
    return found;
  }
  if (typeof value !== "object") return found;

  const hasTeams = (value.home_name || value.homeTeam || value.team_a_name) &&
    (value.away_name || value.awayTeam || value.team_b_name);
  if (hasTeams) found.push(value);

  Object.values(value).forEach((item) => collectMatchObjects(item, depth + 1, found));
  return found;
}

function h2hTeamScore(team, wins) {
  return `
    <div class="h2h-team-score">
      <div>${teamCrest(team.name, team.color)}<strong>${escapeHtml(team.name)}</strong></div>
      <div class="h2h-wins"><b>${wins}</b><small>vitórias</small></div>
    </div>
  `;
}

function h2hInsight(label, value) {
  return `<div class="h2h-insight"><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong></div>`;
}

function h2hMatchRow(match) {
  return `
    <div class="h2h-match-row">
      <div class="h2h-match-date"><strong>${formatDate(match.date, { day: "2-digit", month: "short", year: "2-digit" })}</strong>${escapeHtml(match.league || "")}</div>
      <div class="h2h-match-teams"><span>${escapeHtml(match.homeName)}</span><span>${escapeHtml(match.awayName)}</span></div>
      <span class="h2h-score">${match.homeGoals}–${match.awayGoals}</span>
    </div>
  `;
}

function renderTeamRadarChart(teams) {
  if (!window.Chart) return;
  const ctx = document.getElementById("teamRadarChart");
  if (!ctx || !teams.length) return;
  const colors = ["#00c853", "#59a8ff", "#9d8cff"];
  if (state.charts.radar) state.charts.radar.destroy();

  state.charts.radar = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Ataque", "Defesa", "Posse", "Aproveitamento", "Escanteios"],
      datasets: teams.map((team, index) => ({
        label: team.name,
        data: [
          scale(team.goalsPerMatch, 0.5, 3),
          scale(3 - (team.conceded / Math.max(team.played, 1)), 0, 3),
          scale(team.possession, 35, 70),
          team.winRate,
          scale(team.corners, 2, 9)
        ],
        borderColor: colors[index],
        backgroundColor: hexToRgba(colors[index], 0.09),
        pointBackgroundColor: colors[index],
        borderWidth: 2,
        pointRadius: 2
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: cssVar("--text-2"), boxWidth: 9, boxHeight: 9, padding: 16, font: { size: 9 } }
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false, stepSize: 20 },
          angleLines: { color: cssVar("--border-soft") },
          grid: { color: cssVar("--border-soft") },
          pointLabels: { color: cssVar("--text-3"), font: { size: 9 } }
        }
      }
    }
  });
}

function chartOptions({ max, suffix }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cssVar("--surface-3"),
        titleColor: cssVar("--text"),
        bodyColor: cssVar("--text-2"),
        borderColor: cssVar("--border"),
        borderWidth: 1,
        callbacks: { label: (context) => ` ${context.raw}${suffix}` }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: cssVar("--text-3"), font: { size: 9 } }
      },
      y: {
        beginAtZero: true,
        max,
        grid: { color: cssVar("--border-soft") },
        border: { display: false },
        ticks: { color: cssVar("--text-3"), font: { size: 8 }, callback: (value) => `${value}${suffix}` }
      }
    }
  };
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

  document.querySelectorAll("[data-stats-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.statsTab = button.dataset.statsTab;
      document.querySelectorAll("[data-stats-tab]").forEach((item) => item.classList.toggle("active", item === button));
      els.teamsStatsView.classList.toggle("active", state.statsTab === "teams");
      els.playersStatsView.classList.toggle("active", state.statsTab === "players");
    });
  });

  els.statsLeagueFilter.addEventListener("change", async (event) => {
    await loadLeagueStats(event.target.value);
    populateTeamSelectors();
    renderStats();
    renderH2H();
  });

  if (els.oddsLeagueFilter) {
    els.oddsLeagueFilter.addEventListener("change", (event) => {
      state.oddsLeague = event.target.value;
      renderOdds();
    });
  }
  if (els.oddsMarketFilter) {
    els.oddsMarketFilter.addEventListener("change", (event) => {
      state.oddsMarket = event.target.value;
      renderOdds();
    });
  }
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

  els.compareTeamsButton.addEventListener("click", () => renderH2H({ fetchReal: true }));
  els.refreshButton.addEventListener("click", () => loadApplicationData({ refresh: true }));
}

function setupTheme() {
  const stored = localStorage.getItem("scoutbet-theme");
  const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = stored || preferred;
  els.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("scoutbet-theme", next);
    window.setTimeout(() => {
      renderTeamRadarChart([...state.teams].sort((a, b) => b.ppg - a.ppg).slice(0, 3));
    }, 30);
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
  const match = state.matches.find((item) => String(item.id) === String(matchId));
  if (!match) return;

  els.matchModal.classList.add("open");
  els.matchModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  els.modalTitle.textContent = `${match.homeName} x ${match.awayName}`;

  try {
    // Não depende de endpoint ao vivo. O modal usa dados oficiais já carregados
    // de partidas, times e jogadores para abrir imediatamente.
    els.matchModalBody.innerHTML = matchModalTemplate(match);
  } catch (error) {
    console.error(error);
    els.matchModalBody.innerHTML = `
      <div class="numbers-section">
        <div class="numbers-section__head"><i class="fa-solid fa-triangle-exclamation"></i><strong>Dados indisponíveis</strong></div>
        <p class="numbers-empty-note">Não foi possível montar os números desta partida com os dados oficiais disponíveis.</p>
      </div>
    `;
  }
}

function matchModalTemplate(match) {
  const market = bestMarketForMatch(match);
  const homePlayers = matchPlayers(match, "home");
  const awayPlayers = matchPlayers(match, "away");

  return `
    <div class="numbers-modal">
      <div class="numbers-hero">
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

      ${numbersSection("Resumo", "fa-solid fa-chart-simple", `
        <div class="numbers-grid numbers-grid--summary">
          ${modalMarket("Mercado", market.label)}
          ${modalMarket("Odd", formatOdd(market.odd))}
          ${modalMarket("Probabilidade", formatProbability(market.probability))}
          ${modalMarket("Status", statusLabel(match))}
        </div>
        <div class="numbers-note"><small>Leitura do modelo</small><strong>${escapeHtml(modalAnalysis(match, market))}</strong></div>
      `)}

      ${numbersSection("Gols", "fa-solid fa-futbol", `
        ${probabilityLine("Mais de 1.5 gols", match.probabilities.over15)}
        ${probabilityLine("Mais de 2.5 gols", match.probabilities.over25)}
        ${probabilityLine("Mais de 3.5 gols", match.probabilities.over35)}
        ${probabilityLine("Ambas marcam", match.probabilities.btts)}
      `)}

      ${numbersSection("Escanteios", "fa-solid fa-flag", `
        ${probabilityLine("Mais de 8.5 escanteios", match.probabilities.cornersOver85)}
        ${probabilityLine("Mais de 9.5 escanteios", match.probabilities.cornersOver95)}
        ${probabilityLine("Mais de 10.5 escanteios", match.probabilities.cornersOver105)}
        ${numbersStatRow("Escanteios no jogo", match.stats.cornersHome, match.stats.cornersAway)}
      `)}

      ${numbersSection("Cartões", "fa-solid fa-square", `
        ${probabilityLine("Mais de 3.5 cartões", match.probabilities.cardsOver35)}
        ${probabilityLine("Mais de 4.5 cartões", match.probabilities.cardsOver45)}
        ${probabilityLine("Mais de 5.5 cartões", match.probabilities.cardsOver55)}
        ${numbersStatRow("Cartões no jogo", match.stats.cardsHome, match.stats.cardsAway)}
      `)}

      ${numbersSection("Finalizações", "fa-solid fa-bullseye", `
        ${numbersStatRow("Finalizações", match.stats.shotsHome, match.stats.shotsAway)}
        ${numbersStatRow("Posse de bola", match.stats.possessionHome, match.stats.possessionAway, "%")}
        ${statAvailabilityNote(match.stats.shotsHome, match.stats.shotsAway, "Finalizações aparecem quando a FootyStats retornar estatísticas oficiais para esta partida.")}
      `)}

      ${numbersSection("Jogadores", "fa-solid fa-user-group", `
        <div class="numbers-players">
          <div>${playersList("Mandante", homePlayers)}</div>
          <div>${playersList("Visitante", awayPlayers)}</div>
        </div>
      `)}
    </div>
  `;
}


function modalMarket(label, value) {
  const safeValue = value === null || value === undefined || value === "" ? "—" : value;
  return `
    <div class="modal-market">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(String(safeValue))}</strong>
    </div>
  `;
}

function numbersSection(title, icon, content) {
  return `
    <section class="numbers-section">
      <div class="numbers-section__head"><i class="${icon}"></i><strong>${escapeHtml(title)}</strong></div>
      ${content}
    </section>
  `;
}

function formatProbability(probability) {
  return Number.isFinite(probability) ? `${round(probability * 100, 0)}%` : "—";
}

function probabilityLine(label, probability) {
  const percent = Number.isFinite(probability) ? Math.round(probability * 100) : 0;
  const value = Number.isFinite(probability) ? `${round(probability * 100, 1)}%` : "Dados indisponíveis";
  return `
    <div class="numbers-line">
      <div class="numbers-line__meta"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
      <div class="numbers-line__track"><span style="width:${percent}%"></span></div>
    </div>
  `;
}

function numbersStatRow(label, home, away, suffix = "") {
  const hasData = home !== null && away !== null && home !== undefined && away !== undefined;
  const homeValue = hasData ? `${round(home, 0)}${suffix}` : "—";
  const awayValue = hasData ? `${round(away, 0)}${suffix}` : "—";
  const homeWidth = hasData ? Math.round((Number(home) / Math.max(Number(home) + Number(away), 1)) * 100) : 0;
  return `
    <div class="numbers-stat-row">
      <strong>${escapeHtml(homeValue)}</strong>
      <div>
        <span>${escapeHtml(label)}</span>
        <div class="numbers-stat-bar">${hasData ? `<i style="width:${homeWidth}%"></i><b style="width:${100 - homeWidth}%"></b>` : ""}</div>
      </div>
      <strong>${escapeHtml(awayValue)}</strong>
    </div>
  `;
}

function statAvailabilityNote(home, away, message) {
  if (home !== null && away !== null && home !== undefined && away !== undefined) return "";
  return `<p class="numbers-empty-note">${escapeHtml(message)}</p>`;
}

function matchPlayers(match, side) {
  const teamId = side === "home" ? match.homeId : match.awayId;
  const teamName = side === "home" ? match.homeName : match.awayName;
  const normalizedName = normalizeText(teamName);
  return state.players
    .filter((player) => (teamId && player.teamId === teamId) || normalizeText(player.team) === normalizedName)
    .sort((a, b) => ((b.goals || 0) + (b.assists || 0)) - ((a.goals || 0) + (a.assists || 0)))
    .slice(0, 5);
}

function playersList(title, players) {
  if (!players.length) {
    return `<div class="numbers-player-list"><h4>${escapeHtml(title)}</h4><p class="numbers-empty-note">Jogadores indisponíveis para este time na API atual.</p></div>`;
  }
  return `
    <div class="numbers-player-list">
      <h4>${escapeHtml(title)}</h4>
      ${players.map((player) => `
        <div class="numbers-player-row">
          <span>${escapeHtml(initials(player.name))}</span>
          <div><strong>${escapeHtml(player.name)}</strong><small>${displayApiValue(player.appearances)} jogos</small></div>
          <em>${displayApiValue(player.goals)}G · ${displayApiValue(player.assists)}A</em>
        </div>
      `).join("")}
    </div>
  `;
}



function percentForDisplay(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const number = Number(value);
  return number <= 1 ? Math.round(number * 100) : Math.round(number);
}

function metricTone(value) {
  const percent = percentForDisplay(value);
  if (percent === null) return { className: "is-empty", label: "—" };
  return {
    className: percent >= 70 ? "is-good" : percent >= 40 ? "is-mid" : "is-low",
    label: `${percent}%`
  };
}

function rawMetricValue(label, value, suffix = "") {
  const isEmpty = value === null || value === undefined || value === "" || !Number.isFinite(Number(value));
  const className = isEmpty ? "is-empty" : "is-good";
  const formatted = isEmpty ? "—" : `${round(Number(value), 2)}${suffix}`;
  return `
    <div class="numbers-goal-metric ${className}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(formatted)}</strong>
    </div>
  `;
}

function percentMetricValue(label, value) {
  const tone = metricTone(value);
  return `
    <div class="numbers-goal-metric ${tone.className}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(tone.label)}</strong>
    </div>
  `;
}

function metricCard(row, match) {
  return `
    <article class="numbers-goal-card" data-stat-key="${escapeHtml(row.key || row.label)}">
      <div class="numbers-goal-card__label">
        <span>${escapeHtml(row.label)}</span>
      </div>
      <div class="numbers-goal-card__metrics">
        ${percentMetricValue(match.homeName, row.home ?? null)}
        ${percentMetricValue(match.awayName, row.away ?? null)}
        ${percentMetricValue("Média", row.average ?? null)}
      </div>
    </article>
  `;
}

function metricGroup(title, rows, match, eyebrow = "Categoria") {
  return `
    <section class="numbers-goals-group">
      <div class="numbers-goals-group__head">
        <div>
          <small>${escapeHtml(eyebrow)}</small>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <span>${rows.length} linhas</span>
      </div>
      <div class="numbers-goals-cards">
        ${rows.map((row) => metricCard(row, match)).join("")}
      </div>
    </section>
  `;
}

function numbersDataNote(text) {
  return `<div class="numbers-goals-note">${escapeHtml(text)}</div>`;
}


function numbersSubtabs(groups, match) {
  const safeGroups = groups.filter((group) => group && group.id && group.title);
  if (!safeGroups.length) return "";
  return `
    <div class="numbers-subtabs-wrap" data-numbers-subtabs-root>
      <div class="numbers-subtabs" role="tablist" aria-label="Subcategorias da estatística">
        ${safeGroups.map((group, index) => `
          <button type="button" class="numbers-subtab ${index === 0 ? "is-active" : ""}" data-numbers-subtab="${escapeHtml(group.id)}" role="tab" aria-selected="${index === 0 ? "true" : "false"}">${escapeHtml(group.title)}</button>
        `).join("")}
      </div>
      <div class="numbers-subpanels">
        ${safeGroups.map((group, index) => `
          <div class="numbers-subpanel ${index === 0 ? "is-active" : ""}" data-numbers-subpanel="${escapeHtml(group.id)}" role="tabpanel">
            ${metricGroup(group.title, group.rows || [], match, group.eyebrow || "Categoria")}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function switchNumbersSubtab(subtabId, root) {
  if (!subtabId || !root) return;
  root.querySelectorAll("[data-numbers-subtab]").forEach((button) => {
    const isActive = button.dataset.numbersSubtab === subtabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  root.querySelectorAll("[data-numbers-subpanel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.numbersSubpanel === subtabId);
  });
}

function renderGoalsNumbersTab(match) {
  const blank = { home: null, away: null, average: null };
  const groups = [
    {
      id: "gols-partida",
      title: "Gols da partida",
      rows: [
        { key: "over05", label: "Mais de 0,5", ...blank },
        { key: "over15", label: "Mais de 1,5", ...blank },
        { key: "over25", label: "Mais de 2,5", ...blank },
        { key: "over35", label: "Mais de 3,5", ...blank },
        { key: "over45", label: "Mais de 4,5", ...blank },
        { key: "btts", label: "BTTS", ...blank },
        { key: "bttsWin", label: "Ambas as equipes marcam e ganhem.", ...blank },
        { key: "bttsDraw", label: "Ambas as equipes marcam e empate", ...blank },
        { key: "bttsOver25", label: "Ambas as equipes marcam e mais de 2,5 gols", ...blank },
        { key: "bttsNoOver25", label: "Ambas as equipes marcam Não e Mais de 2,5", ...blank }
      ]
    },
    {
      id: "gols-primeiro-tempo",
      title: "Gols do primeiro tempo",
      rows: [
        { key: "bttsFirstHalf", label: "Ambas as equipes marcam no primeiro tempo.", ...blank },
        { key: "over05FH", label: "Mais de 0,5 FH", ...blank },
        { key: "over15FH", label: "Mais de 1,5 FH", ...blank },
        { key: "over25FH", label: "Mais de 2,5 FH", ...blank }
      ]
    },
    {
      id: "gols-segundo-tempo",
      title: "Gols do segundo tempo",
      rows: [
        { key: "bttsSecondHalf", label: "Ambas as equipes marcam no segundo tempo.", ...blank },
        { key: "bttsBothHalves", label: "Ambas as equipes marcam nos dois tempos.", ...blank },
        { key: "over05SH", label: "Mais de 0,5 2H", ...blank },
        { key: "over15SH", label: "Mais de 1,5 2H", ...blank },
        { key: "over25SH", label: "Mais de 2,5 2H", ...blank }
      ]
    },
    {
      id: "menos-de-x-gols",
      title: "Menos de X gols",
      rows: [
        { key: "under05", label: "Menos de 0,5", ...blank },
        { key: "under15", label: "Menos de 1,5", ...blank },
        { key: "under25", label: "Menos de 2,5", ...blank },
        { key: "under35", label: "Menos de 3,5", ...blank },
        { key: "under45", label: "Menos de 4,5", ...blank }
      ]
    },
    {
      id: "primeiro-segundo-tempo",
      title: "Primeiro/Segundo Tempo",
      rows: [
        { key: "under05FH", label: "Menos de 0,5 FH", ...blank },
        { key: "under15FH", label: "Menos de 1,5 FH", ...blank },
        { key: "under25FH", label: "Menos de 2,5 FH", ...blank },
        { key: "under05SH", label: "Menos de 0,5 2H", ...blank },
        { key: "under15SH", label: "Menos de 1,5 2H", ...blank },
        { key: "under25SH", label: "Menos de 2,5 2H", ...blank }
      ]
    }
  ];
  return `
    ${numbersDataNote("Linhas de gols organizadas por subaba. Onde ainda não houver endpoint oficial mapeado, mostramos — sem inventar número.")}
    ${numbersSubtabs(groups, match)}
  `;
}

function renderCornersNumbersTab(match) {
  const blank = { home: null, away: null, average: null };
  const groups = [
    {
      id: "escanteios-partida",
      title: "Escanteios da partida",
      rows: [
        { key: "totalCorners", label: "Total de escanteios", ...blank },
        { key: "cornersPerMatch", label: "Escanteios / jogo", ...blank },
        { key: "homeCorners", label: "Escanteios do mandante", ...blank },
        { key: "awayCorners", label: "Escanteios do visitante", ...blank }
      ]
    },
    {
      id: "total-escanteios",
      title: "Total de escanteios",
      rows: [
        { key: "cornersOver6", label: "Mais de 6", ...blank },
        { key: "cornersOver7", label: "Mais de 7", ...blank },
        { key: "cornersOver8", label: "Mais de 8", ...blank },
        { key: "cornersOver9", label: "Mais de 9", ...blank },
        { key: "cornersOver10", label: "Mais de 10", ...blank },
        { key: "cornersOver11", label: "Mais de 11", ...blank },
        { key: "cornersOver12", label: "Mais de 12", ...blank },
        { key: "cornersOver13", label: "Mais de 13", ...blank }
      ]
    },
    {
      id: "escanteios-time",
      title: "Escanteios do time",
      rows: [
        { key: "cornersForMatch", label: "Escanteios a favor / jogo", ...blank },
        { key: "cornersAgainstMatch", label: "Escanteios contra / jogo", ...blank },
        { key: "cornersForOver25", label: "Mais de 2.5 escanteios a favor", ...blank },
        { key: "cornersForOver35", label: "Mais de 3.5 escanteios a favor", ...blank },
        { key: "cornersForOver45", label: "Mais de 4.5 escanteios a favor", ...blank },
        { key: "cornersAgainstOver25", label: "Mais de 2.5 escanteios contra", ...blank },
        { key: "cornersAgainstOver35", label: "Mais de 3.5 escanteios contra", ...blank },
        { key: "cornersAgainstOver45", label: "Mais de 4.5 escanteios contra", ...blank }
      ]
    },
    {
      id: "primeiro-tempo-escanteios",
      title: "Primeiro tempo",
      rows: [
        { key: "fhCornersAverage", label: "Média FH", ...blank },
        { key: "fhCornersOver4", label: "Mais de 4 FH", ...blank },
        { key: "fhCornersOver5", label: "Mais de 5 FH", ...blank },
        { key: "fhCornersOver6", label: "Mais de 6 FH", ...blank }
      ]
    },
    {
      id: "segundo-tempo-escanteios",
      title: "Segundo tempo",
      rows: [
        { key: "shCornersAverage", label: "Média 2H", ...blank },
        { key: "shCornersOver4", label: "Mais de 4 2H", ...blank },
        { key: "shCornersOver5", label: "Mais de 5 2H", ...blank },
        { key: "shCornersOver6", label: "Mais de 6 2H", ...blank }
      ]
    }
  ];
  return `
    ${numbersDataNote("Linhas de escanteios organizadas por subaba para receber o mapeamento dos endpoints oficiais.")}
    ${numbersSubtabs(groups, match)}
  `;
}

function renderCardsNumbersTab(match) {
  const blank = { home: null, away: null, average: null };
  const groups = [
    {
      id: "cartoes-partida",
      title: "Cartões da partida",
      rows: [
        { key: "totalCardsPerMatch", label: "Total de cartões / jogo", ...blank },
        { key: "homeCardsPerMatch", label: "Cartões do mandante / jogo", ...blank },
        { key: "awayCardsPerMatch", label: "Cartões do visitante / jogo", ...blank }
      ]
    },
    {
      id: "total-cartoes",
      title: "Total de cartões",
      rows: [
        { key: "cardsOver25", label: "Mais de 2.5", ...blank },
        { key: "cardsOver35", label: "Mais de 3.5", ...blank },
        { key: "cardsOver45", label: "Mais de 4.5", ...blank },
        { key: "cardsOver55", label: "Mais de 5.5", ...blank },
        { key: "cardsOver65", label: "Mais de 6.5", ...blank }
      ]
    },
    {
      id: "cartoes-time",
      title: "Cartões do time",
      rows: [
        { key: "cardsForAverage", label: "Cartões a favor média", ...blank },
        { key: "cardsOver05For", label: "Mais de 0.5 a favor", ...blank },
        { key: "cardsOver15For", label: "Mais de 1.5 a favor", ...blank },
        { key: "cardsOver25For", label: "Mais de 2.5 a favor", ...blank },
        { key: "cardsOver35For", label: "Mais de 3.5 a favor", ...blank }
      ]
    },
    {
      id: "cartoes-contra",
      title: "Cartões contra",
      rows: [
        { key: "cardsOver05Against", label: "Mais de 0.5 contra", ...blank },
        { key: "cardsOver15Against", label: "Mais de 1.5 contra", ...blank },
        { key: "cardsOver25Against", label: "Mais de 2.5 contra", ...blank },
        { key: "cardsOver35Against", label: "Mais de 3.5 contra", ...blank }
      ]
    },
    {
      id: "cartoes-tempos",
      title: "1º / 2º tempo cartões",
      rows: [
        { key: "fhOver05CardsFor", label: "1H Mais de 0.5 cartões a favor", ...blank },
        { key: "shOver05CardsFor", label: "2H Mais de 0.5 cartões a favor", ...blank },
        { key: "fhTotalUnder2", label: "1H Total abaixo de 2", ...blank },
        { key: "shTotalUnder2", label: "2H Total abaixo de 2", ...blank },
        { key: "fhTotal2to3", label: "1H entre 2–3 cartões totais", ...blank },
        { key: "shTotal2to3", label: "2H entre 2–3 cartões totais", ...blank },
        { key: "fhTotalOver3", label: "1H Total acima de 3", ...blank },
        { key: "shTotalOver3", label: "2H Total acima de 3", ...blank }
      ]
    }
  ];
  return `
    ${numbersDataNote("Linhas de cartões organizadas por subaba para o mapeamento dos endpoints oficiais.")}
    ${numbersSubtabs(groups, match)}
  `;
}

function renderShotsNumbersTab(match) {
  const blank = { home: null, away: null, average: null };
  const groups = [
    {
      id: "finalizacoes-time",
      title: "Finalizações do time",
      rows: [
        { key: "shotsPerMatch", label: "Finalizações / jogo", ...blank },
        { key: "shotsConversionRate", label: "Taxa de conversão de finalizações", ...blank },
        { key: "shotsOnTargetPerMatch", label: "Finalizações no alvo / jogo", ...blank },
        { key: "shotsOffTargetPerMatch", label: "Finalizações fora do alvo / jogo", ...blank },
        { key: "shotsPerGoal", label: "Finalizações por gol marcado", ...blank },
        { key: "teamShotsOver105", label: "Time com mais de 10.5 finalizações", ...blank },
        { key: "teamShotsOver115", label: "Time com mais de 11.5 finalizações", ...blank },
        { key: "teamShotsOver125", label: "Time com mais de 12.5 finalizações", ...blank },
        { key: "teamShotsOver135", label: "Time com mais de 13.5 finalizações", ...blank },
        { key: "teamShotsOver145", label: "Time com mais de 14.5 finalizações", ...blank },
        { key: "teamShotsOver155", label: "Time com mais de 15.5 finalizações", ...blank },
        { key: "teamSotOver35", label: "Time com mais de 3.5 finalizações no alvo", ...blank },
        { key: "teamSotOver45", label: "Time com mais de 4.5 finalizações no alvo", ...blank },
        { key: "teamSotOver55", label: "Time com mais de 5.5 finalizações no alvo", ...blank },
        { key: "teamSotOver65", label: "Time com mais de 6.5 finalizações no alvo", ...blank }
      ]
    },
    {
      id: "finalizacoes-partida",
      title: "Finalizações da partida",
      rows: [
        { key: "matchShotsOver235", label: "Jogo com mais de 23.5 finalizações", ...blank },
        { key: "matchShotsOver245", label: "Jogo com mais de 24.5 finalizações", ...blank },
        { key: "matchShotsOver255", label: "Jogo com mais de 25.5 finalizações", ...blank },
        { key: "matchShotsOver265", label: "Jogo com mais de 26.5 finalizações", ...blank },
        { key: "matchSotOver75", label: "Jogo com mais de 7.5 finalizações no alvo", ...blank },
        { key: "matchSotOver85", label: "Jogo com mais de 8.5 finalizações no alvo", ...blank },
        { key: "matchSotOver95", label: "Jogo com mais de 9.5 finalizações no alvo", ...blank }
      ]
    },
    {
      id: "impedimentos",
      title: "Impedimentos",
      rows: [
        { key: "offsidesPerMatch", label: "Impedimentos / jogo", ...blank },
        { key: "offsidesOver25", label: "Mais de 2.5 impedimentos", ...blank },
        { key: "offsidesOver35", label: "Mais de 3.5 impedimentos", ...blank }
      ]
    },
    {
      id: "outras-estatisticas",
      title: "Outras estatísticas",
      rows: [
        { key: "foulsCommitted", label: "Faltas cometidas / jogo", ...blank },
        { key: "foulsAgainst", label: "Faltas sofridas / jogo", ...blank },
        { key: "averagePossession", label: "Posse média", ...blank },
        { key: "drawAtHalfTime", label: "Empate no intervalo", ...blank }
      ]
    }
  ];
  return `
    ${numbersDataNote("Finalizações, impedimentos e faltas organizadas por subaba. Sem campo oficial mapeado, exibimos —.")}
    ${numbersSubtabs(groups, match)}
  `;
}

function playerMetricValue(player, metric) {
  if (!player) return "—";
  if (metric === "goals") return displayApiValue(player.goals);
  if (metric === "cards") return displayApiValue(player.cards ?? player.yellowCards);
  if (metric === "cardsPer90") return displayApiValue(player.cardsPer90);
  return "—";
}

function playerRankingBlock(title, players, metric) {
  const sorted = [...players]
    .filter((player) => playerMetricValue(player, metric) !== "—")
    .sort((a, b) => Number(playerMetricValue(b, metric)) - Number(playerMetricValue(a, metric)))
    .slice(0, 6);
  if (!sorted.length) {
    return `<div class="numbers-player-list"><h4>${escapeHtml(title)}</h4><p class="numbers-empty-note">Dados indisponíveis para este mercado na API atual.</p></div>`;
  }
  const max = Math.max(...sorted.map((player) => Number(playerMetricValue(player, metric)) || 0), 1);
  return `
    <div class="numbers-player-list numbers-player-list--ranking">
      <h4>${escapeHtml(title)}</h4>
      ${sorted.map((player) => {
        const value = Number(playerMetricValue(player, metric)) || 0;
        return `
          <div class="numbers-player-rank">
            <div><strong>${escapeHtml(player.name)}</strong><em>${escapeHtml(player.team)}</em></div>
            <span>${escapeHtml(playerMetricValue(player, metric))}</span>
            <b style="width:${Math.max(8, Math.round((value / max) * 100))}%"></b>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderPlayersNumbersTab(match) {
  const homePlayers = matchPlayers(match, "home");
  const awayPlayers = matchPlayers(match, "away");
  return `
    ${numbersDataNote("Jogadores aparecem quando o endpoint de atletas retornar dados oficiais para a liga/time. Sem dados oficiais, mostramos indisponível.")}
    <div class="numbers-players">
      ${playerRankingBlock(`Artilheiros - ${match.homeName}`, homePlayers, "goals")}
      ${playerRankingBlock(`Artilheiros - ${match.awayName}`, awayPlayers, "goals")}
      ${playerRankingBlock(`Cartões recebidos - ${match.homeName}`, homePlayers, "cards")}
      ${playerRankingBlock(`Cartões recebidos - ${match.awayName}`, awayPlayers, "cards")}
      ${playerRankingBlock(`Cartões / 90 - ${match.homeName}`, homePlayers, "cardsPer90")}
      ${playerRankingBlock(`Cartões / 90 - ${match.awayName}`, awayPlayers, "cardsPer90")}
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
    cards: firstNumber(team?.cards, team?.cardsAVG_overall, team?.cards_per_match, team?.average_cards),
    shots: firstNumber(team?.shots, team?.shotsAVG_overall, team?.shots_per_match, team?.average_shots),
    possession: firstNumber(team?.possession, team?.possessionAVG_overall, team?.average_possession)
  };
}

function findTeamStatsRecord(teamId, teamName, leagueKey) {
  const normalized = normalizeText(teamName || "");
  return state.teams.find((team) => teamId && Number(team.id) === Number(teamId)) ||
    state.teams.find((team) => leagueKey && team.leagueKey === leagueKey && normalizeText(team.name || team.fullName || "") === normalized) ||
    state.teams.find((team) => normalizeText(team.name || team.fullName || "") === normalized) ||
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
  els.todayLabel.textContent = formatDate(new Date(), { day: "numeric", month: "long" });
}

function setActiveButton(container, activeButton) {
  container.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === activeButton));
}

function getDataArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.response)) return payload.response;
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

function getLeague(key) {
  return state.leagues.find((league) => league.key === key) || TARGET_LEAGUES.find((league) => league.key === key) || TARGET_LEAGUES[0];
}

function findMatchTeam(teamId, name = "") {
  const id = Number(teamId || 0);
  const normalizedName = normalizeText(name);
  const pools = [state.matchTeams, state.teams];

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
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
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
  const kickoff = Number(timestamp) || 0;
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  const liveWindow = 3.25 * 60 * 60 * 1000;

  const isCancelled = ["cancelled", "canceled"].some((item) => value.includes(item));
  const isPostponed = ["postponed"].some((item) => value.includes(item));
  const isSuspended = ["suspended", "abandoned"].some((item) => value.includes(item));
  const minuteSaysFinished = ["ft", "full time", "full-time"].some((item) => normalizedMinute === item || normalizedMinute.includes(item));
  const minuteSaysLive = /^\d{1,3}(\+\d{1,2})?$/.test(normalizedMinute) || ["ht", "half time", "1h", "2h"].includes(normalizedMinute);
  const isLive = minuteSaysLive || ["live", "in play", "inplay", "playing", "half time", "1h", "2h", "ht"].some((item) => value.includes(item));
  const isFinished = minuteSaysFinished || ["complete", "finished", "full time", "full-time", "ft", "ended"].some((item) => value.includes(item));
  const isScheduled = ["scheduled", "incomplete", "pre match", "pre-match", "not started", "pending"].some((item) => value.includes(item));

  if (isCancelled) return "cancelled";
  if (isPostponed) return "postponed";
  if (isSuspended) return "suspended";

  // O live score da FootyStats usa minuto para atualizar partidas ao vivo.
  // Quando existir minuto numérico, ele tem prioridade sobre status inconsistente.
  if (isLive && !minuteSaysFinished) return "live";

  if (kickoff) {
    if (kickoff > now + fiveMinutes) return "scheduled";

    // Durante a janela natural da partida, tratar como ao vivo mesmo se a lista
    // vier com status antigo como complete/finished.
    if (now >= kickoff - fiveMinutes && now <= kickoff + liveWindow && !minuteSaysFinished) {
      return "live";
    }
  }

  if (isFinished) return "complete";
  if (isScheduled) return "scheduled";

  if (kickoff && now > kickoff + liveWindow) return "complete";
  return "scheduled";
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

function winnerName(match) {
  if (match.homeGoals === match.awayGoals) return null;
  return match.homeGoals > match.awayGoals ? match.homeName : match.awayName;
}

function statusWeight(status) {
  return { live: 0, scheduled: 1, complete: 2 }[status] ?? 3;
}

function percentOf(items, predicate) {
  if (!items.length) return 0;
  return Math.round((items.filter(predicate).length / items.length) * 100);
}

function scale(value, min, max) {
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
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

function displayApiValue(value) {
  return value === null || value === undefined || value === "" ? "—" : escapeHtml(String(value));
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
