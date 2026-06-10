const BASE_URL = process.env.FOOTYSTATS_BASE_URL || "https://api.football-data-api.com";
const TIMEZONE = process.env.JTIPS_TIMEZONE || "America/Sao_Paulo";
const MAX_PER_PAGE = 500;
const MAX_AUTO_LEAGUES = Number(process.env.JTIPS_MAX_AUTO_LEAGUES || 30);

function send(response, status, payload) {
  response.status(status).json(payload);
}

function requestUrl(request) {
  return new URL(request.url, `https://${request.headers.host || "localhost"}`);
}

function cleanArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.leagues)) return payload.leagues;
  if (Array.isArray(payload?.competitions)) return payload.competitions;
  if (Array.isArray(payload?.seasons)) return payload.seasons;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.teams)) return payload.teams;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

async function footy(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint.replace(/^\/+/, "")}`);
  url.searchParams.set("key", process.env.FOOTYSTATS_API_KEY || "");

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json,text/plain,*/*" },
      signal: controller.signal,
    });

    const body = await response.text();
    let payload = null;

    try {
      payload = body ? JSON.parse(body) : null;
    } catch {
      payload = body;
    }

    if (!response.ok) {
      const error = new Error(`${endpoint} retornou ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function walk(value, output = []) {
  if (!value || output.length > 8000) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, output));
    return output;
  }
  if (typeof value === "object") {
    output.push(value);
    Object.values(value).forEach((item) => walk(item, output));
  }
  return output;
}

function leagueIdOf(item) {
  return item?.season_id || item?.seasonID || item?.league_id || item?.leagueID || item?.competition_id || item?.competitionID || item?.id || null;
}

function leagueNameOf(item, id) {
  return item?.name || item?.league_name || item?.competition_name || item?.full_name || item?.season || `Liga ${id}`;
}

function normalizeLeague(item) {
  const id = leagueIdOf(item);
  if (!id) return null;
  return {
    league_id: String(id),
    name: leagueNameOf(item, id),
    country: item?.country || item?.country_name || item?.nation || "",
    season: item?.season || item?.year || item?.season_name || "",
  };
}

async function discoverLeagues() {
  const endpoints = [
    "league-list",
    "leagues",
    "league",
    "competitions",
    "competition-list",
    "country-leagues",
  ];

  const errors = [];

  for (const endpoint of endpoints) {
    try {
      const payload = await footy(endpoint);
      const direct = cleanArray(payload);
      const source = direct.length ? direct : walk(payload);
      const seen = new Set();
      const leagues = source
        .map(normalizeLeague)
        .filter(Boolean)
        .filter((league) => {
          if (seen.has(league.league_id)) return false;
          seen.add(league.league_id);
          return true;
        });

      if (leagues.length) {
        return { endpoint, leagues };
      }

      errors.push({ endpoint, error: "sem ligas na resposta" });
    } catch (error) {
      errors.push({ endpoint, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { endpoint: null, leagues: [], errors };
}

async function fetchMatches(leagueId) {
  const first = await footy("league-matches", {
    league_id: leagueId,
    page: 1,
    max_per_page: MAX_PER_PAGE,
  });

  const rows = cleanArray(first);
  const maxPage = Number(first?.pager?.max_page || first?.pager?.maxPage || 1);

  if (maxPage <= 1) return rows;

  const rest = [];
  for (let page = 2; page <= maxPage; page += 1) {
    rest.push(footy("league-matches", {
      league_id: leagueId,
      page,
      max_per_page: MAX_PER_PAGE,
    }));
  }

  const pages = await Promise.all(rest);
  return rows.concat(pages.flatMap(cleanArray));
}

async function fetchTeams(leagueId) {
  const payload = await footy("league-teams", { league_id: leagueId });
  return cleanArray(payload);
}

function teamName(team) {
  return team?.cleanName || team?.name || team?.english_name || team?.full_name || "";
}

function teamMap(teams) {
  return new Map(teams.map((team) => [String(team.id), team]));
}

function brDate(dateUnix) {
  if (!dateUnix) return { date: "", time: "--:--" };
  const date = new Date(Number(dateUnix) * 1000);
  if (Number.isNaN(date.getTime())) return { date: "", time: "--:--" };
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function statusOf(status, dateUnix) {
  const value = String(status || "").toLowerCase();
  if (["complete", "finished", "ft", "full-time"].includes(value)) return "finalizado";
  if (["live", "in-play", "playing", "1h", "2h", "ht"].includes(value)) return "em_andamento";
  if (["cancelled", "canceled"].includes(value)) return "cancelado";
  if (value === "postponed") return "adiado";
  if (["suspended", "abandoned"].includes(value)) return "suspenso";
  if (dateUnix && Number(dateUnix) > Date.now() / 1000) return "pre_jogo";
  return "desconhecido";
}

function odd(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 1 ? Number(number.toFixed(2)) : null;
}

function pct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 0 && number <= 1) return Math.round(number * 100);
  if (number >= 0 && number <= 100) return Math.round(number);
  return null;
}

function implied(value) {
  const valid = odd(value);
  return valid ? Math.round((1 / valid) * 100) : null;
}

function market(list, group, selection, probability, oddsValue, source) {
  const confidence = pct(probability);
  if (confidence === null) return;
  list.push({ group, selection, market: selection, confidence, probability: confidence, odd: odd(oddsValue), source });
}

function marketsOf(match, home, away) {
  const list = [];
  market(list, "winner", `${home} vence`, implied(match.odds_ft_1), match.odds_ft_1, "odds_ft_1");
  market(list, "winner", "Empate", implied(match.odds_ft_x), match.odds_ft_x, "odds_ft_x");
  market(list, "winner", `${away} vence`, implied(match.odds_ft_2), match.odds_ft_2, "odds_ft_2");
  market(list, "double_chance", `${home} ou empate`, implied(match.odds_doublechance_1x), match.odds_doublechance_1x, "odds_doublechance_1x");
  market(list, "double_chance", `${home} ou ${away}`, implied(match.odds_doublechance_12), match.odds_doublechance_12, "odds_doublechance_12");
  market(list, "double_chance", `${away} ou empate`, implied(match.odds_doublechance_x2), match.odds_doublechance_x2, "odds_doublechance_x2");
  market(list, "goals", "Mais de 0.5 gols", match.over05, match.odds_ft_over05, "over05");
  market(list, "goals", "Mais de 1.5 gols", match.over15, match.odds_ft_over15, "over15");
  market(list, "goals", "Mais de 2.5 gols", match.over25, match.odds_ft_over25, "over25");
  market(list, "goals", "Mais de 3.5 gols", match.over35, match.odds_ft_over35, "over35");
  market(list, "goals", "Menos de 2.5 gols", implied(match.odds_ft_under25), match.odds_ft_under25, "odds_ft_under25");
  market(list, "btts", "Ambas marcam", match.btts || match.btts_potential, match.odds_btts_yes, "btts_potential");
  market(list, "btts", "Ambas não marcam", implied(match.odds_btts_no), match.odds_btts_no, "odds_btts_no");
  market(list, "corners", "Mais de 8.5 escanteios", match.corners_o85_potential, match.odds_corners_over_85, "corners_o85_potential");
  market(list, "corners", "Mais de 9.5 escanteios", match.corners_o95_potential, match.odds_corners_over_95, "corners_o95_potential");
  market(list, "corners", "Mais de 10.5 escanteios", match.corners_o105_potential, match.odds_corners_over_105, "corners_o105_potential");
  market(list, "corners", "Menos de 10.5 escanteios", implied(match.odds_corners_under_105), match.odds_corners_under_105, "odds_corners_under_105");
  market(list, "cards", "Cartões Mais/Menos", match.cards_potential, null, "cards_potential");
  return list.sort((a, b) => b.confidence - a.confidence);
}

function normalizeMatch(match, teams, league) {
  const homeTeam = teams.get(String(match.homeID));
  const awayTeam = teams.get(String(match.awayID));
  const home = teamName(homeTeam) || `Time ${match.homeID}`;
  const away = teamName(awayTeam) || `Time ${match.awayID}`;
  const date = brDate(match.date_unix);

  return {
    id: String(match.id),
    match_id: match.id,
    league_id: league.league_id,
    league: match.league_name || match.competition || league.name,
    country: homeTeam?.country || awayTeam?.country || league.country || "",
    season: match.season || league.season || "",
    home,
    away,
    homeID: match.homeID,
    awayID: match.awayID,
    home_logo: homeTeam?.image || null,
    away_logo: awayTeam?.image || null,
    status: statusOf(match.status, match.date_unix),
    date: date.date,
    time: date.time,
    date_unix: match.date_unix,
    score_home: match.homeGoalCount ?? null,
    score_away: match.awayGoalCount ?? null,
    goals_total: match.totalGoalCount ?? null,
    corners_total: match.totalCornerCount ?? null,
    cards_total: Number(match.team_a_yellow_cards || 0) + Number(match.team_b_yellow_cards || 0) + Number(match.team_a_red_cards || 0) + Number(match.team_b_red_cards || 0),
    xg_total_prematch: match.total_xg_prematch ?? null,
    markets: marketsOf(match, home, away),
    raw: match,
  };
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "GET") return send(response, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  if (!process.env.FOOTYSTATS_API_KEY) return send(response, 500, { ok: false, error: "FOOTYSTATS_API_KEY_MISSING", message: "Configure FOOTYSTATS_API_KEY no Vercel." });

  try {
    const url = requestUrl(request);
    const discovered = await discoverLeagues();

    if (!discovered.leagues.length) {
      return send(response, 500, {
        ok: false,
        error: "NO_LEAGUES_DISCOVERED",
        message: "Não foi possível descobrir automaticamente as ligas disponíveis na FootyStats.",
        discovery_errors: discovered.errors || [],
      });
    }

    const limit = Number(url.searchParams.get("max_leagues") || MAX_AUTO_LEAGUES || discovered.leagues.length);
    const leagues = discovered.leagues.slice(0, Number.isFinite(limit) && limit > 0 ? limit : discovered.leagues.length);
    const matches = [];
    const failed_leagues = [];

    for (const league of leagues) {
      try {
        const [leagueMatches, leagueTeams] = await Promise.all([fetchMatches(league.league_id), fetchTeams(league.league_id)]);
        const map = teamMap(leagueTeams);
        matches.push(...leagueMatches.map((match) => normalizeMatch(match, map, league)));
      } catch (error) {
        failed_leagues.push({ league_id: league.league_id, league: league.name, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const date = url.searchParams.get("date");
    const status = url.searchParams.get("status");
    const filtered = matches.filter((match) => {
      if (date && match.date !== date) return false;
      if (status && match.status !== status) return false;
      return true;
    });

    return send(response, 200, {
      ok: true,
      timezone: TIMEZONE,
      discovery_endpoint: discovered.endpoint,
      total_leagues_available: discovered.leagues.length,
      loaded_leagues: leagues,
      failed_leagues,
      total: filtered.length,
      matches: filtered,
    });
  } catch (error) {
    return send(response, 500, { ok: false, error: "AUTO_MATCHES_FAILED", message: "Erro ao carregar ligas automaticamente.", detail: error instanceof Error ? error.message : String(error) });
  }
}
