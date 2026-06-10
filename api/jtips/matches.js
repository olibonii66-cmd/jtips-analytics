const BASE_URL = process.env.FOOTYSTATS_BASE_URL || "https://api.football-data-api.com";
const TIMEZONE = process.env.JTIPS_TIMEZONE || "America/Sao_Paulo";
const DEFAULT_LEAGUES = process.env.JTIPS_LEAGUE_IDS || "1625";
const MAX_PER_PAGE = 500;

function json(response, status, payload) {
  response.status(status).json(payload);
}

function getRequestUrl(request) {
  return new URL(request.url, `https://${request.headers.host || "localhost"}`);
}

function getLeagueIds(url) {
  const fromQuery = url.searchParams.get("league_id") || url.searchParams.get("league_ids");
  return String(fromQuery || DEFAULT_LEAGUES)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchFooty(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("key", process.env.FOOTYSTATS_API_KEY || "");

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      throw new Error(`${endpoint} retornou ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.teams)) return payload.teams;
  if (Array.isArray(payload?.players)) return payload.players;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

async function fetchLeagueMatches(leagueId) {
  const first = await fetchFooty("league-matches", {
    league_id: leagueId,
    page: 1,
    max_per_page: MAX_PER_PAGE,
  });

  const rows = extractArray(first);
  const maxPage = Number(first?.pager?.max_page || first?.pager?.maxPage || 1);

  if (maxPage <= 1) return rows;

  const pages = [];
  for (let page = 2; page <= maxPage; page += 1) {
    pages.push(fetchFooty("league-matches", {
      league_id: leagueId,
      page,
      max_per_page: MAX_PER_PAGE,
    }));
  }

  const rest = await Promise.all(pages);
  return rows.concat(rest.flatMap(extractArray));
}

async function fetchLeagueTeams(leagueId) {
  const payload = await fetchFooty("league-teams", { league_id: leagueId });
  return extractArray(payload);
}

function teamName(team) {
  return team?.cleanName || team?.name || team?.english_name || team?.full_name || "";
}

function buildTeamMap(teams) {
  return new Map(teams.map((team) => [String(team.id), team]));
}

function formatDateParts(dateUnix) {
  if (!dateUnix) return { date_brazil: "", time_brazil: "--:--" };

  const date = new Date(Number(dateUnix) * 1000);
  if (Number.isNaN(date.getTime())) return { date_brazil: "", time_brazil: "--:--" };

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value || "";

  return {
    date_brazil: `${value("year")}-${value("month")}-${value("day")}`,
    time_brazil: `${value("hour")}:${value("minute")}`,
  };
}

function normalizeStatus(status, dateUnix) {
  const value = String(status || "").toLowerCase();

  if (["complete", "finished", "ft", "full-time"].includes(value)) return "finalizado";
  if (["live", "in-play", "playing", "1h", "2h", "ht"].includes(value)) return "em_andamento";
  if (["cancelled", "canceled"].includes(value)) return "cancelado";
  if (value === "postponed") return "adiado";
  if (["suspended", "abandoned"].includes(value)) return "suspenso";

  if (dateUnix && Number(dateUnix) > Date.now() / 1000) return "pre_jogo";
  return "desconhecido";
}

function validOdd(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 1 ? Number(number.toFixed(2)) : null;
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 0 && number <= 1) return Math.round(number * 100);
  if (number >= 0 && number <= 100) return Math.round(number);
  return null;
}

function impliedProbability(odd) {
  const value = validOdd(odd);
  if (!value) return null;
  return Math.round((1 / value) * 100);
}

function pushMarket(markets, group, selection, probability, odd, source) {
  const confidence = percent(probability);
  if (confidence === null) return;

  markets.push({
    market: selection,
    selection,
    group,
    probability: confidence,
    confidence,
    odd: validOdd(odd),
    source,
  });
}

function buildMarkets(match, homeName, awayName) {
  const markets = [];

  pushMarket(markets, "winner", `${homeName} vence`, impliedProbability(match.odds_ft_1), match.odds_ft_1, "odds_ft_1");
  pushMarket(markets, "winner", "Empate", impliedProbability(match.odds_ft_x), match.odds_ft_x, "odds_ft_x");
  pushMarket(markets, "winner", `${awayName} vence`, impliedProbability(match.odds_ft_2), match.odds_ft_2, "odds_ft_2");

  pushMarket(markets, "double_chance", `${homeName} ou empate`, impliedProbability(match.odds_doublechance_1x), match.odds_doublechance_1x, "odds_doublechance_1x");
  pushMarket(markets, "double_chance", `${homeName} ou ${awayName}`, impliedProbability(match.odds_doublechance_12), match.odds_doublechance_12, "odds_doublechance_12");
  pushMarket(markets, "double_chance", `${awayName} ou empate`, impliedProbability(match.odds_doublechance_x2), match.odds_doublechance_x2, "odds_doublechance_x2");

  pushMarket(markets, "goals", "Mais de 0.5 gols", match.over05, match.odds_ft_over05, "over05");
  pushMarket(markets, "goals", "Mais de 1.5 gols", match.over15, match.odds_ft_over15, "over15");
  pushMarket(markets, "goals", "Mais de 2.5 gols", match.over25, match.odds_ft_over25, "over25");
  pushMarket(markets, "goals", "Mais de 3.5 gols", match.over35, match.odds_ft_over35, "over35");
  pushMarket(markets, "goals", "Menos de 2.5 gols", impliedProbability(match.odds_ft_under25), match.odds_ft_under25, "odds_ft_under25");

  pushMarket(markets, "btts", "Ambas marcam", match.btts || match.btts_potential, match.odds_btts_yes, "btts_potential");
  pushMarket(markets, "btts", "Ambas não marcam", impliedProbability(match.odds_btts_no), match.odds_btts_no, "odds_btts_no");

  pushMarket(markets, "corners", "Mais de 8.5 escanteios", match.corners_o85_potential, match.odds_corners_over_85, "corners_o85_potential");
  pushMarket(markets, "corners", "Mais de 9.5 escanteios", match.corners_o95_potential, match.odds_corners_over_95, "corners_o95_potential");
  pushMarket(markets, "corners", "Mais de 10.5 escanteios", match.corners_o105_potential, match.odds_corners_over_105, "corners_o105_potential");
  pushMarket(markets, "corners", "Menos de 10.5 escanteios", impliedProbability(match.odds_corners_under_105), match.odds_corners_under_105, "odds_corners_under_105");

  pushMarket(markets, "cards", "Cartões Mais/Menos", match.cards_potential, null, "cards_potential");

  return markets
    .filter((market) => market.confidence >= 0)
    .sort((a, b) => b.confidence - a.confidence);
}

function normalizeMatch(match, teamMap, leagueId) {
  const home = teamMap.get(String(match.homeID));
  const away = teamMap.get(String(match.awayID));
  const homeName = teamName(home) || `Time ${match.homeID}`;
  const awayName = teamName(away) || `Time ${match.awayID}`;
  const dateParts = formatDateParts(match.date_unix);

  const markets = buildMarkets(match, homeName, awayName);

  return {
    id: String(match.id),
    match_id: match.id,
    league_id: leagueId,
    season: match.season,
    home: homeName,
    away: awayName,
    homeID: match.homeID,
    awayID: match.awayID,
    home_logo: home?.image || null,
    away_logo: away?.image || null,
    league: match.league_name || match.competition || match.season || `Liga ${leagueId}`,
    country: home?.country || away?.country || "",
    status: normalizeStatus(match.status, match.date_unix),
    date: dateParts.date_brazil,
    time: dateParts.time_brazil,
    date_unix: match.date_unix,
    score_home: match.homeGoalCount ?? null,
    score_away: match.awayGoalCount ?? null,
    goals_total: match.totalGoalCount ?? null,
    corners_total: match.totalCornerCount ?? null,
    cards_total: Number(match.team_a_yellow_cards || 0) + Number(match.team_b_yellow_cards || 0) + Number(match.team_a_red_cards || 0) + Number(match.team_b_red_cards || 0),
    xg_total_prematch: match.total_xg_prematch ?? null,
    markets,
    raw: match,
  };
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "GET") return json(response, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });

  if (!process.env.FOOTYSTATS_API_KEY) {
    return json(response, 500, {
      ok: false,
      error: "FOOTYSTATS_API_KEY_MISSING",
      message: "Configure FOOTYSTATS_API_KEY no Vercel.",
    });
  }

  try {
    const url = getRequestUrl(request);
    const leagueIds = getLeagueIds(url);
    const allMatches = [];

    for (const leagueId of leagueIds) {
      const [matches, teams] = await Promise.all([
        fetchLeagueMatches(leagueId),
        fetchLeagueTeams(leagueId),
      ]);
      const teamMap = buildTeamMap(teams);
      allMatches.push(...matches.map((match) => normalizeMatch(match, teamMap, leagueId)));
    }

    const date = url.searchParams.get("date");
    const status = url.searchParams.get("status");
    const filtered = allMatches.filter((match) => {
      if (date && match.date !== date) return false;
      if (status && match.status !== status) return false;
      return true;
    });

    return json(response, 200, {
      ok: true,
      timezone: TIMEZONE,
      total: filtered.length,
      matches: filtered,
    });
  } catch (error) {
    return json(response, 500, {
      ok: false,
      error: "JTIPS_MATCHES_FETCH_FAILED",
      message: "Não foi possível buscar dados da FootyStats.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
