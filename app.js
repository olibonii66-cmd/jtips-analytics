const API_CONFIG = {
  provider: "FootyStats",
  enabled: true,
  mode: "api",
  baseUrl: "",
  matchesPath: "/api/matches",
  timeoutMs: 9000,
};

function brazilDateIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const today = brazilDateIso();
const dayMs = 24 * 60 * 60 * 1000;

function shiftedDate(days) {
  const base = new Date(`${today}T12:00:00`);
  return new Date(base.getTime() + days * dayMs).toISOString().slice(0, 10);
}

const mockMatches = [
  {
    id: 1,
    date: today,
    time: "14:30",
    country: "Inglaterra",
    league: "Premier League",
    home: "Manchester City",
    away: "Everton",
    marketType: "gols",
    market: "Over 2.5 gols",
    odd: 1.72,
    confidence: 82,
    risk: "Baixo",
    reason:
      "Mandante com média alta de gols em casa e visitante cedendo muitas finalizações fora.",
    stats: {
      homeForm: 86,
      awayForm: 54,
      goals: 3.1,
      corners: 10.8,
      cards: 4.2,
      homeAway: "Casa forte",
    },
  },
  {
    id: 2,
    date: today,
    time: "15:00",
    country: "Espanha",
    league: "La Liga",
    home: "Real Sociedad",
    away: "Valencia",
    marketType: "escanteios",
    market: "Mais de 8.5 escanteios",
    odd: 1.88,
    confidence: 76,
    risk: "Médio",
    reason:
      "Equipes usam bastante amplitude e chegam com volume consistente de cruzamentos.",
    stats: {
      homeForm: 68,
      awayForm: 61,
      goals: 2.2,
      corners: 9.7,
      cards: 5.1,
      homeAway: "Equilibrado",
    },
  },
  {
    id: 3,
    date: today,
    time: "16:00",
    country: "Brasil",
    league: "Brasileirão Série A",
    home: "Flamengo",
    away: "Bahia",
    marketType: "casa-fora",
    market: "Flamengo vence",
    odd: 1.63,
    confidence: 79,
    risk: "Baixo",
    reason:
      "Mandante mantém ótimo aproveitamento em casa e visitante perde eficiência fora.",
    stats: {
      homeForm: 81,
      awayForm: 47,
      goals: 2.7,
      corners: 10.1,
      cards: 4.6,
      homeAway: "Vantagem casa",
    },
  },
  {
    id: 4,
    date: today,
    time: "17:15",
    country: "Itália",
    league: "Serie A",
    home: "Atalanta",
    away: "Lazio",
    marketType: "cartoes",
    market: "Mais de 4.5 cartões",
    odd: 1.95,
    confidence: 73,
    risk: "Médio",
    reason:
      "Confronto direto por posição, histórico físico e árbitro com média elevada de cartões.",
    stats: {
      homeForm: 70,
      awayForm: 65,
      goals: 2.4,
      corners: 8.9,
      cards: 5.8,
      homeAway: "Pressão alta",
    },
  },
  {
    id: 5,
    date: today,
    time: "18:30",
    country: "Alemanha",
    league: "Bundesliga",
    home: "Leverkusen",
    away: "Freiburg",
    marketType: "mais-menos",
    market: "Under 3.5 gols",
    odd: 1.58,
    confidence: 69,
    risk: "Médio",
    reason:
      "Linha protegida para jogo de ritmo alto, mas com boa margem sobre o total esperado.",
    stats: {
      homeForm: 77,
      awayForm: 58,
      goals: 2.9,
      corners: 9.5,
      cards: 3.9,
      homeAway: "Casa superior",
    },
  },
  {
    id: 6,
    date: today,
    time: "21:00",
    country: "Argentina",
    league: "Liga Profesional",
    home: "River Plate",
    away: "Lanús",
    marketType: "cartoes",
    market: "Mandante mais cartões",
    odd: 2.05,
    confidence: 64,
    risk: "Alto",
    reason:
      "Boa odd, mas o mercado depende de leitura disciplinar e perfil do árbitro no jogo.",
    stats: {
      homeForm: 71,
      awayForm: 52,
      goals: 2.1,
      corners: 8.2,
      cards: 6.2,
      homeAway: "Mandante intenso",
    },
  },
  {
    id: 7,
    date: today,
    time: "16:45",
    country: "Inglaterra",
    league: "Premier League",
    home: "Chelsea",
    away: "Newcastle",
    marketType: "escanteios",
    market: "Mais de 9.5 escanteios",
    odd: 1.83,
    confidence: 74,
    risk: "Médio",
    reason:
      "Duas equipes com boa presença pelos lados e média alta de escanteios em jogos recentes.",
    stats: {
      homeForm: 66,
      awayForm: 64,
      goals: 2.6,
      corners: 10.4,
      cards: 4.4,
      homeAway: "Volume lateral",
    },
  },
  {
    id: 8,
    date: today,
    time: "19:00",
    country: "Brasil",
    league: "Brasileirão Série A",
    home: "Palmeiras",
    away: "Fortaleza",
    marketType: "gols",
    market: "Over 1.5 gols",
    odd: 1.46,
    confidence: 84,
    risk: "Baixo",
    reason:
      "Linha conservadora com mandante forte em casa e visitante competitivo mesmo fora.",
    stats: {
      homeForm: 83,
      awayForm: 59,
      goals: 2.5,
      corners: 9.8,
      cards: 4.1,
      homeAway: "Casa forte",
    },
  },
  {
    id: 9,
    date: shiftedDate(1),
    time: "15:30",
    country: "França",
    league: "Ligue 1",
    home: "Lyon",
    away: "Rennes",
    marketType: "mais-menos",
    market: "Under 2.5 gols",
    odd: 1.91,
    confidence: 67,
    risk: "Médio",
    reason:
      "Confronto com projeção mais travada e bom valor na linha de menos gols.",
    stats: {
      homeForm: 62,
      awayForm: 57,
      goals: 2.1,
      corners: 8.6,
      cards: 4.7,
      homeAway: "Ritmo controlado",
    },
  },
  {
    id: 10,
    date: shiftedDate(-1),
    time: "20:00",
    country: "Portugal",
    league: "Liga Portugal",
    home: "Porto",
    away: "Braga",
    marketType: "cartoes",
    market: "Mais de 3.5 cartões",
    odd: 1.70,
    confidence: 78,
    risk: "Baixo",
    reason:
      "Jogo de rivalidade competitiva com histórico disciplinar acima da média.",
    stats: {
      homeForm: 75,
      awayForm: 63,
      goals: 2.3,
      corners: 9.1,
      cards: 5.4,
      homeAway: "Duelo físico",
    },
  },
];

let matches = [...mockMatches];

const DAILY_ANALYSIS_MATCHES = {
  "best-am-ago": {
    id: "best-am-ago",
    date: today,
    time: "20:00",
    country: "Brasil",
    league: "Serie B",
    home: "América Mineiro",
    away: "Atlético GO",
    marketType: "escanteios",
    market: "Cantos +8.5",
    odd: 1.80,
    confidence: 80,
    risk: "Baixo",
    reason: "Bilhete sem conflito com cantos fortes e Atlético GO com boa chance de marcar.",
    stats: {
      homeForm: 20,
      awayForm: 100,
      goals: 2.1,
      corners: 11.0,
      cards: 5.2,
      homeAway: "Visitante superior",
    },
  },
  "best-pal-for": {
    id: "best-pal-for",
    date: today,
    time: "19:00",
    country: "Brasil",
    league: "Serie A",
    home: "Palmeiras",
    away: "Fortaleza",
    marketType: "gols",
    market: "Over 1.5 gols",
    odd: 1.46,
    confidence: 84,
    risk: "Baixo",
    reason: "Bilhete com mercados compatíveis: gols, cantos e Palmeiras para marcar.",
    stats: {
      homeForm: 83,
      awayForm: 59,
      goals: 2.5,
      corners: 9.8,
      cards: 4.1,
      homeAway: "Casa forte",
    },
  },
  "daily-us-1": {
    id: "daily-us-1",
    date: today,
    time: "16:00",
    country: "Estados Unidos",
    league: "MLS Next Pro",
    home: "Columbus Crew 2",
    away: "Connecticut United",
    marketType: "gols",
    market: "Over 1.5 gols",
    odd: 1.62,
    confidence: 74,
    risk: "Médio",
    reason: "Jogo com boa projeção de gols e mandante mantendo volume ofensivo em casa.",
    stats: {
      homeForm: 72,
      awayForm: 58,
      goals: 2.8,
      corners: 9.2,
      cards: 3.6,
      homeAway: "Casa superior",
    },
  },
  "daily-us-2": {
    id: "daily-us-2",
    date: today,
    time: "21:00",
    country: "Estados Unidos",
    league: "MLS Next Pro",
    home: "Minnesota United 2",
    away: "Sporting Kansas City II",
    marketType: "escanteios",
    market: "Mais de 8.5 escanteios",
    odd: 1.78,
    confidence: 77,
    risk: "Médio",
    reason: "Equipes com boa frequência de cantos e transições pelos lados.",
    stats: {
      homeForm: 64,
      awayForm: 61,
      goals: 2.4,
      corners: 9.9,
      cards: 4.0,
      homeAway: "Equilíbrio",
    },
  },
  "daily-se-1": {
    id: "daily-se-1",
    date: today,
    time: "14:00",
    country: "Suécia",
    league: "Ettan Norra",
    home: "FC Stockholm",
    away: "Vasalunds IF",
    marketType: "gols",
    market: "Over 2.5 gols",
    odd: 1.86,
    confidence: 72,
    risk: "Médio",
    reason: "Linha de gols interessante pelo histórico recente das duas equipes.",
    stats: {
      homeForm: 69,
      awayForm: 63,
      goals: 3.0,
      corners: 8.7,
      cards: 3.8,
      homeAway: "Mandante ativo",
    },
  },
  "daily-se-2": {
    id: "daily-se-2",
    date: today,
    time: "14:30",
    country: "Suécia",
    league: "Ettan Norra",
    home: "FC Järfälla",
    away: "IFK Stocksund",
    marketType: "mais-menos",
    market: "Over 1.5 gols",
    odd: 1.44,
    confidence: 81,
    risk: "Baixo",
    reason: "Linha conservadora com bom encaixe para jogo de ritmo ofensivo.",
    stats: {
      homeForm: 66,
      awayForm: 68,
      goals: 2.7,
      corners: 9.4,
      cards: 3.5,
      homeAway: "Aberto",
    },
  },
  "daily-se-3": {
    id: "daily-se-3",
    date: today,
    time: "14:00",
    country: "Suécia",
    league: "Ettan Norra",
    home: "Ängelholms FF",
    away: "BK Olympic",
    marketType: "cartoes",
    market: "Mais de 3.5 cartões",
    odd: 1.74,
    confidence: 73,
    risk: "Médio",
    reason: "Partida com tendência de disputa física e bom volume de faltas.",
    stats: {
      homeForm: 57,
      awayForm: 62,
      goals: 2.2,
      corners: 8.1,
      cards: 4.9,
      homeAway: "Duelo físico",
    },
  },
  "daily-se-4": {
    id: "daily-se-4",
    date: today,
    time: "14:30",
    country: "Suécia",
    league: "Ettan Norra",
    home: "Utsiktens BK",
    away: "FC Rosengård",
    marketType: "escanteios",
    market: "Mais de 9.5 escanteios",
    odd: 1.92,
    confidence: 75,
    risk: "Médio",
    reason: "Times com boa produção lateral e alta média de cantos combinada.",
    stats: {
      homeForm: 70,
      awayForm: 55,
      goals: 2.6,
      corners: 10.2,
      cards: 4.3,
      homeAway: "Volume lateral",
    },
  },
  "daily-int-1": {
    id: "daily-int-1",
    date: today,
    time: "15:00",
    country: "Internacional",
    league: "Friendlies",
    home: "Uganda",
    away: "Gâmbia",
    marketType: "mais-menos",
    market: "Under 3.5 gols",
    odd: 1.52,
    confidence: 76,
    risk: "Baixo",
    reason: "Amistoso com tendência de controle e linha protegida para menos gols.",
    stats: {
      homeForm: 59,
      awayForm: 60,
      goals: 2.0,
      corners: 7.4,
      cards: 2.8,
      homeAway: "Ritmo controlado",
    },
  },
};

const state = {
  selectedId: matches[0].id,
  filtered: [...matches],
  currentAnalysisMatch: null,
  analysisSourceView: "jogos",
  bestMatches: [],
  dataSource: "mock",
  apiLoading: false,
  apiError: null,
  dailyStatus: "todos",
  activeTab: "resumo",
  activeSubtabs: {
    resumo: "fixture",
    gols: "over",
    finalizacoes: "equipe",
    escanteios: "total",
    cartoes: "total",
    jogadores: "gols",
    "casa-fora": "resultado",
  },
};

const DETAIL_TABS = [
  {
    id: "resumo",
    subtabs: [
      { id: "fixture", label: "Fixture Analysis" },
      { id: "trends", label: "Team Trends" },
      { id: "ai", label: "GPT-5 AI Summary" },
    ],
  },
  {
    id: "casa-fora",
    subtabs: [
      { id: "resultado", label: "Resultado" },
      { id: "mandante", label: "Mandante" },
      { id: "visitante", label: "Visitante" },
    ],
  },
  {
    id: "gols",
    subtabs: [
      { id: "over", label: "Mais de X gols" },
      { id: "tempos", label: "1º/2º Tempo" },
      { id: "under", label: "Menos de X gols" },
    ],
  },
  {
    id: "cartoes",
    subtabs: [
      { id: "total", label: "Total de cartões" },
      { id: "equipe", label: "Cartões de Equipe" },
    ],
  },
  {
    id: "escanteios",
    subtabs: [
      { id: "total", label: "Total de escanteios" },
      { id: "equipe", label: "Escanteios da equipe" },
      { id: "tempos", label: "Primeiro tempo / Segundo tempo" },
    ],
  },
  {
    id: "finalizacoes",
    subtabs: [
      { id: "equipe", label: "Finalizações da equipe" },
      { id: "match", label: "Match Shots" },
    ],
  },
  {
    id: "jogadores",
    subtabs: [
      { id: "gols", label: "Artilheiros" },
      { id: "cartoes", label: "Cartões" },
      { id: "cartoes90", label: "Cartões / 90" },
    ],
  },
];

const refs = {
  loginView: document.querySelector("#loginView"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  logoutButton: document.querySelector("#logoutButton"),
  refreshButton: document.querySelector("#refreshButton"),
  bestBoard: document.querySelector("#melhores-do-dia"),
  apiStatus: document.querySelector(".api-status"),
  apiStatusTitle: document.querySelector(".api-status strong"),
  apiStatusText: document.querySelector(".api-status div span"),
  dailyDateStrip: document.querySelector("#dailyDateStrip"),
  dailyLeagueList: document.querySelector("#dailyLeagueList"),
  dailyStatusButtons: [...document.querySelectorAll("[data-daily-status]")],
  navLinks: [...document.querySelectorAll(".nav-list a[data-view]")],
  appViews: [...document.querySelectorAll(".app-view")],
  analysisTriggers: [...document.querySelectorAll("[data-analysis-id]")],
  topbarEyebrow: document.querySelector(".topbar .eyebrow"),
  topbarTitle: document.querySelector(".topbar h1"),
  dateFilter: document.querySelector("#dateFilter"),
  countryFilter: document.querySelector("#countryFilter"),
  leagueFilter: document.querySelector("#leagueFilter"),
  teamFilter: document.querySelector("#teamFilter"),
  marketFilter: document.querySelector("#marketFilter"),
  oddFilter: document.querySelector("#oddFilter"),
  confidenceFilter: document.querySelector("#confidenceFilter"),
  confidenceValue: document.querySelector("#confidenceValue"),
  clearFilters: document.querySelector("#clearFilters"),
  totalMatches: document.querySelector("#totalMatches"),
  strongTips: document.querySelector("#strongTips"),
  avgConfidence: document.querySelector("#avgConfidence"),
  avgOdd: document.querySelector("#avgOdd"),
  fixtureCount: document.querySelector("#fixtureCount"),
  fixturesList: document.querySelector("#fixturesList"),
  dateChips: [...document.querySelectorAll(".date-chip")],
  matchTabButtons: [...document.querySelectorAll("#matchTabs button")],
  matchSubtabs: document.querySelector("#matchSubtabs"),
  matchCover: document.querySelector(".match-cover"),
  detailLeague: document.querySelector("#detailLeague"),
  detailTitle: document.querySelector("#detailTitle"),
  detailTime: document.querySelector("#detailTime"),
  detailBody: document.querySelector("#detailBody"),
};

const VIEW_META = {
  melhores: {
    eyebrow: "Futebol • Pré-jogo",
    title: "Melhores do Dia",
  },
  jogos: {
    eyebrow: "Agenda • Futebol",
    title: "Jogos do Dia",
  },
  configuracoes: {
    eyebrow: "Sistema • Preferências",
    title: "Configurações",
  },
  analise: {
    eyebrow: "Pré-jogo • Análise",
    title: "Análise da Partida",
  },
};

function optionalStorageValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return "";
  }
}

function apiOverride(name, storageKey) {
  return window[name] || optionalStorageValue(storageKey) || "";
}

function joinApiUrl(baseUrl, path) {
  if (!path && !baseUrl) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}

function buildApiUrl(date) {
  const directUrl = apiOverride("JTIPS_API_URL", "jtipsApiUrl");
  const endpoint =
    directUrl ||
    joinApiUrl(
      apiOverride("JTIPS_API_BASE_URL", "jtipsApiBaseUrl") || API_CONFIG.baseUrl,
      apiOverride("JTIPS_MATCHES_PATH", "jtipsMatchesPath") || API_CONFIG.matchesPath,
    );

  if (!endpoint) return "";

  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("date", date || today);
  return url.toString();
}

function setApiStatus(status, detail = "") {
  if (!refs.apiStatus) return;

  const copy = {
    mock: ["Modo mock", detail || "Pronto para API"],
    loading: ["Conectando API", detail || "Buscando jogos"],
    api: ["API conectada", detail || "Dados reais ativos"],
    error: ["Mock ativo", detail || "API sem resposta"],
  };
  const [title, text] = copy[status] ?? copy.mock;

  refs.apiStatus.dataset.status = status;
  refs.apiStatusTitle.textContent = title;
  refs.apiStatusText.textContent = text;
}

function readPath(source, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), source);
}

function firstValue(source, paths) {
  for (const path of paths) {
    const value = typeof path === "function" ? path(source) : readPath(source, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .trim()
    .replace("%", "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value, fallback) {
  const text = String(value ?? fallback ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function percentFromApi(value, fallback = 65) {
  const number = toNumber(value);
  if (number === null) return clamp(fallback, 1, 100);
  if (number <= 1) return clamp(number * 100, 1, 100);
  if (number <= 3.2) return clamp((number / 3) * 100, 1, 100);
  return clamp(number, 1, 100);
}

function averageFromApi(value, fallback, max = 30) {
  const number = toNumber(value);
  if (number === null || number < 0 || number > max) return fallback;
  return Number(number.toFixed(2));
}

function dateFromApi(value, fallback = today) {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
    const numeric = Number(value);
    const ms = numeric > 9999999999 ? numeric : numeric * 1000;
    const parsed = new Date(ms);
    if (Number.isNaN(parsed.getTime())) return fallback;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(parsed);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
}

function timeFromApi(item, fallback = "00:00") {
  const explicit = firstValue(item, [
    "time",
    "match_time",
    "starting_time",
    "kickoff_time",
    "hour",
  ]);
  if (explicit && /^\d{1,2}:\d{2}/.test(String(explicit))) {
    return String(explicit).slice(0, 5).padStart(5, "0");
  }

  const dateLike = firstValue(item, [
    "starting_at",
    "start_at",
    "kickoff",
    "kickoff_at",
    "event_date",
    "fixture.date",
    "date_unix",
    "timestamp",
  ]);
  if (!dateLike) return fallback;

  const numeric = toNumber(dateLike);
  const parsed = numeric && String(dateLike).length >= 10
    ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
    : new Date(dateLike);

  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function normalizeMarketType(market) {
  const normalized = String(market ?? "").toLowerCase();
  if (normalized.includes("canto") || normalized.includes("corner")) return "escanteios";
  if (normalized.includes("cart")) return "cartoes";
  if (normalized.includes("vence") || normalized.includes("win") || normalized.includes("casa")) {
    return "casa-fora";
  }
  if (normalized.includes("under") || normalized.includes("menos")) return "mais-menos";
  return "gols";
}

function riskFromConfidence(confidence, risk) {
  const text = cleanText(risk, "");
  if (text) return text;
  if (confidence >= 78) return "Baixo";
  if (confidence >= 65) return "Médio";
  return "Alto";
}

function extractApiList(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    "data",
    "matches",
    "fixtures",
    "games",
    "events",
    "response",
    "results",
    "data.matches",
    "data.fixtures",
    "data.games",
    "payload.matches",
  ];

  for (const path of candidates) {
    const value = readPath(payload, path);
    if (Array.isArray(value)) return value;
  }

  return [];
}

function deriveApiMarket(item, goals) {
  const candidates = [
    {
      market: "Mais de 1.5 gols",
      confidence: firstValue(item, ["o15_potential", "over15"]),
      odd: firstValue(item, ["odds_ft_over15"]),
      type: "gols",
    },
    {
      market: "Mais de 2.5 gols",
      confidence: firstValue(item, ["o25_potential", "over25"]),
      odd: firstValue(item, ["odds_ft_over25"]),
      type: "gols",
    },
    {
      market: "Ambas marcam",
      confidence: firstValue(item, ["btts_potential"]),
      odd: firstValue(item, ["odds_btts_yes"]),
      type: "gols",
    },
    {
      market: "Mais de 8.5 escanteios",
      confidence: firstValue(item, ["corners_o85_potential", "corners_potential"]),
      odd: firstValue(item, ["odds_corners_over_85"]),
      type: "escanteios",
    },
    {
      market: "Mais de 9.5 escanteios",
      confidence: firstValue(item, ["corners_o95_potential"]),
      odd: firstValue(item, ["odds_corners_over_95"]),
      type: "escanteios",
    },
    {
      market: "Mais cartões no jogo",
      confidence: firstValue(item, ["cards_potential"]),
      odd: null,
      type: "cartoes",
    },
  ]
    .map((candidate) => ({
      ...candidate,
      confidence: validMetric(candidate.confidence),
      odd: validMetric(candidate.odd),
    }))
    .filter((candidate) => candidate.confidence !== null && candidate.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  if (candidates.length) return candidates[0];

  const fallbackConfidence = clamp(50 + (goals - 2) * 12, 40, 78);
  return {
    market: goals >= 2.4 ? "Mais de 1.5 gols" : "Menos de 3.5 gols",
    confidence: fallbackConfidence,
    odd: null,
    type: goals >= 2.4 ? "gols" : "mais-menos",
  };
}

function normalizeApiMatch(item, index, selectedDate) {
  const home = cleanText(
    firstValue(item, [
      "home",
      "home_name",
      "home_team",
      "home_team_name",
      "homeTeam.name",
      "team_a",
      "team_a_name",
      "teams.home.name",
      "localteam.name",
    ]),
    `Mandante ${index + 1}`,
  );
  const away = cleanText(
    firstValue(item, [
      "away",
      "away_name",
      "away_team",
      "away_team_name",
      "awayTeam.name",
      "team_b",
      "team_b_name",
      "teams.away.name",
      "visitorteam.name",
    ]),
    `Visitante ${index + 1}`,
  );

  const goals = averageFromApi(
    firstValue(item, [
      "stats.goals",
      "avg_goals",
      "goals_avg",
      "average_goals",
      "total_goals_avg",
      "match_total_goals_avg",
      "total_xg_prematch",
      "avg_potential",
      "prediction.avg_goals",
    ]),
    2.4,
    8,
  );
  const corners = averageFromApi(
    firstValue(item, [
      "stats.corners",
      "avg_corners",
      "corners_avg",
      "average_corners",
      "total_corners_avg",
      "prediction.avg_corners",
    ]),
    8.8,
    20,
  );
  const cards = averageFromApi(
    firstValue(item, [
      "stats.cards",
      "avg_cards",
      "cards_avg",
      "average_cards",
      "total_cards_avg",
      "prediction.avg_cards",
    ]),
    4.2,
    14,
  );
  const homeForm = percentFromApi(
    firstValue(item, [
      "stats.homeForm",
      "home_form",
      "home_form_percent",
      "home_ppg",
      "team_a_ppg",
      "home_team_ppg",
      "pre_match_teamA_overall_ppg",
    ]),
    68,
  );
  const awayForm = percentFromApi(
    firstValue(item, [
      "stats.awayForm",
      "away_form",
      "away_form_percent",
      "away_ppg",
      "team_b_ppg",
      "away_team_ppg",
      "pre_match_teamB_overall_ppg",
    ]),
    60,
  );

  const derivedMarket = deriveApiMarket(item, goals);
  const explicitMarket = firstValue(item, [
      "market",
      "best_market",
      "recommended_market",
      "prediction.market",
      "prediction.name",
      "tip.market",
      "tip.name",
      "bet.market",
    ]);
  const market = cleanText(explicitMarket, derivedMarket.market);
  const confidence = percentFromApi(
    firstValue(item, [
      "confidence",
      "confidence_percent",
      "probability",
      "probability_percent",
      "prediction.confidence",
      "tip.confidence",
      "bet.confidence",
    ]),
    derivedMarket.confidence,
  );
  const rawOdd = averageFromApi(
    firstValue(item, [
      "odd",
      "odds",
      "market_odd",
      "best_odd",
      "prediction.odd",
      "tip.odd",
      "bet.odd",
      "odds.home",
      "odds_ft_over25",
      "odds_ft_1",
    ]),
    derivedMarket.odd || 0,
    100,
  );
  const odd = rawOdd && rawOdd > 1 ? rawOdd : 0;

  return {
    id: cleanText(
      firstValue(item, ["id", "match_id", "fixture_id", "game_id", "event_id"]),
      `api-${selectedDate}-${index}`,
    ),
    date: dateFromApi(
      firstValue(item, [
        "date",
        "match_date",
        "formatted_date",
        "starting_at",
        "start_at",
        "kickoff",
        "kickoff_at",
        "event_date",
        "fixture.date",
        "date_unix",
        "timestamp",
      ]),
      selectedDate,
    ),
    time: timeFromApi(item, "00:00"),
    country: cleanText(
      firstValue(item, [
        "country",
        "country_name",
        "league_country",
        "competition.country",
        "league.country",
      ]),
      "Internacional",
    ),
    league: cleanText(
      firstValue(item, [
        "league",
        "league_name",
        "competition",
        "competition_name",
        "competition.name",
        "league.name",
      ]),
      firstValue(item, ["competition_id"])
        ? `Competição ${firstValue(item, ["competition_id"])}`
        : "Liga",
    ),
    home,
    away,
    status: cleanText(firstValue(item, ["status", "match_status", "state"]), "incomplete").toLowerCase(),
    competitionId: firstValue(item, ["competition_id", "league_id", "season_id"]),
    homeLogo: cleanText(firstValue(item, ["home_image", "home_logo", "homeTeam.logo"]), ""),
    awayLogo: cleanText(firstValue(item, ["away_image", "away_logo", "awayTeam.logo"]), ""),
    homeTeamId: firstValue(item, ["homeID", "home_id", "home_team_id"]),
    awayTeamId: firstValue(item, ["awayID", "away_id", "away_team_id"]),
    homeScore: toNumber(firstValue(item, ["homeGoalCount", "home_score", "scores.home"])),
    awayScore: toNumber(firstValue(item, ["awayGoalCount", "away_score", "scores.away"])),
    marketType: cleanText(
      firstValue(item, ["marketType", "market_type", "type"]),
      explicitMarket ? normalizeMarketType(market) : derivedMarket.type,
    ),
    market,
    odd,
    hasRealOdd: odd > 1,
    confidence,
    risk: riskFromConfidence(confidence, firstValue(item, ["risk", "risk_level", "prediction.risk"])),
    reason: cleanText(
      firstValue(item, ["reason", "justificativa", "analysis", "prediction.reason", "tip.reason"]),
      "Leitura criada a partir dos dados recebidos da API.",
    ),
    stats: {
      homeForm,
      awayForm,
      goals,
      corners,
      cards,
      homeAway: cleanText(firstValue(item, ["stats.homeAway", "home_away", "trend"]), "Modelo API"),
    },
    raw: item,
    detail: null,
    detailLoading: false,
    detailError: null,
  };
}

async function fetchApiPayload(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API respondeu ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function refreshFilterOptions({ preserve = true } = {}) {
  const current = {
    country: preserve ? refs.countryFilter.value : "todos",
    league: preserve ? refs.leagueFilter.value : "todos",
  };
  const countries = uniqueBy("country");
  const leagues = uniqueBy("league");

  fillSelect(refs.countryFilter, countries, "Todos");
  fillSelect(refs.leagueFilter, leagues, "Todas");

  refs.countryFilter.value = countries.includes(current.country) ? current.country : "todos";
  refs.leagueFilter.value = leagues.includes(current.league) ? current.league : "todos";
}

function applyMatches(nextMatches, source) {
  matches = nextMatches.length ? nextMatches : [...mockMatches];
  state.dataSource = source;
  state.filtered = [...matches];

  if (!matches.some((match) => match.id === state.selectedId)) {
    state.selectedId = matches[0]?.id ?? null;
  }

  refreshFilterOptions();
}

async function loadMatchesFromApi(date = today) {
  if (!API_CONFIG.enabled) {
    applyMatches([...mockMatches], "mock");
    setApiStatus("mock");
    return false;
  }

  const url = buildApiUrl(date);
  if (!url) {
    applyMatches([...mockMatches], "mock");
    setApiStatus("mock", "Configure o endpoint");
    return false;
  }

  state.apiLoading = true;
  setApiStatus("loading", "FootyStats via Vercel");

  try {
    const payload = await fetchApiPayload(url);
    const list = extractApiList(payload);
    const normalized = list
      .map((item, index) => normalizeApiMatch(item, index, date))
      .filter((match) => match.home && match.away);

    if (!normalized.length) {
      throw new Error("API retornou 0 jogos");
    }

    state.apiError = null;
    applyMatches(normalized, "api");
    setApiStatus("api", `${normalized.length} jogos carregados`);
    return true;
  } catch (error) {
    state.apiError = error;
    applyMatches([...mockMatches], "mock");
    setApiStatus("error", "Usando mock reserva");
    console.warn("Jtips API fallback:", error);
    return false;
  } finally {
    state.apiLoading = false;
  }
}

async function refreshMatchesForDate() {
  await loadMatchesFromApi(refs.dateFilter.value || today);
  render();
}

function validMetric(value) {
  const number = toNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function detailField(match, paths, fallback = null) {
  const sources = [match.detail?.match, match.raw, match];

  for (const source of sources) {
    if (!source) continue;
    const value = firstValue(source, paths);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
}

function averageValues(values) {
  const valid = values.filter((value) => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function historyMetrics(list, teamId) {
  const rows = (Array.isArray(list) ? list : [])
    .map((game) => {
      const isHome = String(game.homeID) === String(teamId);
      const homeGoals = validMetric(game.homeGoalCount);
      const awayGoals = validMetric(game.awayGoalCount);
      const goalsFor = isHome ? homeGoals : awayGoals;
      const goalsAgainst = isHome ? awayGoals : homeGoals;
      const totalGoals =
        validMetric(game.totalGoalCount) ??
        (goalsFor !== null && goalsAgainst !== null ? goalsFor + goalsAgainst : null);
      const cornersFor = validMetric(isHome ? game.team_a_corners : game.team_b_corners);
      const cornersAgainst = validMetric(isHome ? game.team_b_corners : game.team_a_corners);
      const totalCorners =
        validMetric(game.totalCornerCount) ??
        (cornersFor !== null && cornersAgainst !== null ? cornersFor + cornersAgainst : null);
      const cardsFor =
        validMetric(isHome ? game.team_a_cards_num : game.team_b_cards_num) ??
        ((validMetric(isHome ? game.team_a_yellow_cards : game.team_b_yellow_cards) || 0) +
          (validMetric(isHome ? game.team_a_red_cards : game.team_b_red_cards) || 0));
      const cardsAgainst =
        validMetric(isHome ? game.team_b_cards_num : game.team_a_cards_num) ??
        ((validMetric(isHome ? game.team_b_yellow_cards : game.team_a_yellow_cards) || 0) +
          (validMetric(isHome ? game.team_b_red_cards : game.team_a_red_cards) || 0));
      const shotsFor = validMetric(isHome ? game.team_a_shots : game.team_b_shots);
      const shotsAgainst = validMetric(isHome ? game.team_b_shots : game.team_a_shots);
      const onTargetFor = validMetric(
        isHome ? game.team_a_shotsOnTarget : game.team_b_shotsOnTarget,
      );
      const onTargetAgainst = validMetric(
        isHome ? game.team_b_shotsOnTarget : game.team_a_shotsOnTarget,
      );
      const htGoals = validMetric(game.HTGoalCount);
      const secondHalfGoals = validMetric(game.GoalCount_2hg);
      const firstHalfCorners = validMetric(game.corner_fh_count);
      const secondHalfCorners = validMetric(game.corner_2h_count);

      return {
        goalsFor,
        goalsAgainst,
        totalGoals,
        btts: goalsFor !== null && goalsAgainst !== null ? goalsFor > 0 && goalsAgainst > 0 : null,
        cornersFor,
        cornersAgainst,
        totalCorners,
        cardsFor,
        cardsAgainst,
        totalCards:
          cardsFor !== null && cardsAgainst !== null ? cardsFor + cardsAgainst : null,
        shotsFor,
        shotsAgainst,
        totalShots:
          shotsFor !== null && shotsAgainst !== null ? shotsFor + shotsAgainst : null,
        onTargetFor,
        onTargetAgainst,
        totalOnTarget:
          onTargetFor !== null && onTargetAgainst !== null
            ? onTargetFor + onTargetAgainst
            : null,
        htGoals,
        secondHalfGoals,
        firstHalfCorners,
        secondHalfCorners,
        result:
          goalsFor === null || goalsAgainst === null
            ? null
            : goalsFor > goalsAgainst
              ? "V"
              : goalsFor === goalsAgainst
                ? "E"
                : "D",
      };
    })
    .filter(Boolean);

  const avg = (key) => averageValues(rows.map((row) => row[key]));
  const percentage = (predicate) => {
    const valid = rows.filter((row) => predicate(row) !== null);
    if (!valid.length) return null;
    return Math.round(
      (valid.filter((row) => predicate(row) === true).length / valid.length) * 100,
    );
  };

  return {
    count: rows.length,
    rows,
    avg,
    over: (key, line) =>
      percentage((row) => (row[key] === null ? null : row[key] > line)),
    under: (key, line) =>
      percentage((row) => (row[key] === null ? null : row[key] < line)),
    btts: percentage((row) => row.btts),
    form: rows.map((row) => row.result).filter(Boolean),
    points: rows.reduce(
      (total, row) => total + (row.result === "V" ? 3 : row.result === "E" ? 1 : 0),
      0,
    ),
  };
}

function matchHistories(match) {
  return {
    home: historyMetrics(match.detail?.lastx?.home, match.homeTeamId),
    away: historyMetrics(match.detail?.lastx?.away, match.awayTeamId),
  };
}

function ppgToForm(value, fallback) {
  const ppg = validMetric(value);
  return ppg === null ? fallback : clamp((ppg / 3) * 100, 1, 100);
}

function applyDetailToMatch(match, payload) {
  const raw = payload.match || {};
  const homeTeam = payload.teams?.home || {};
  const awayTeam = payload.teams?.away || {};
  match.detail = payload;
  match.raw = { ...match.raw, ...raw };
  match.homeTeamId = raw.homeID ?? match.homeTeamId;
  match.awayTeamId = raw.awayID ?? match.awayTeamId;
  match.home = cleanText(homeTeam.name || raw.home_name, match.home);
  match.away = cleanText(awayTeam.name || raw.away_name, match.away);
  match.homeLogo = cleanText(homeTeam.logo || raw.home_image, match.homeLogo);
  match.awayLogo = cleanText(awayTeam.logo || raw.away_image, match.awayLogo);
  match.stadium = cleanText(raw.stadium_name, match.stadium || "");
  match.status = cleanText(raw.status, match.status).toLowerCase();

  const histories = matchHistories(match);
  const totalXg = validMetric(raw.total_xg_prematch);
  const goalsHistory = averageValues([
    histories.home.avg("totalGoals"),
    histories.away.avg("totalGoals"),
  ]);
  const cornersHistory = averageValues([
    histories.home.avg("totalCorners"),
    histories.away.avg("totalCorners"),
  ]);
  const cardsHistory = averageValues([
    histories.home.avg("totalCards"),
    histories.away.avg("totalCards"),
  ]);

  match.stats.goals = Number((totalXg ?? goalsHistory ?? match.stats.goals).toFixed(2));
  match.stats.corners = Number((cornersHistory ?? match.stats.corners).toFixed(2));
  match.stats.cards = Number((cardsHistory ?? match.stats.cards).toFixed(2));
  match.stats.homeForm = ppgToForm(
    raw.pre_match_home_ppg ?? raw.pre_match_teamA_overall_ppg ?? raw.home_ppg,
    histories.home.count ? clamp((histories.home.points / (histories.home.count * 3)) * 100) : match.stats.homeForm,
  );
  match.stats.awayForm = ppgToForm(
    raw.pre_match_away_ppg ?? raw.pre_match_teamB_overall_ppg ?? raw.away_ppg,
    histories.away.count ? clamp((histories.away.points / (histories.away.count * 3)) * 100) : match.stats.awayForm,
  );
  match.detailLoading = false;
  match.detailError = null;
}

async function loadMatchDetails(match) {
  if (!match || match.detail || match.detailLoading || state.dataSource !== "api") return;

  match.detailLoading = true;
  match.detailError = null;
  renderDetail(match);

  try {
    const url = new URL("/api/match", window.location.origin);
    url.searchParams.set("match_id", match.id);
    if (match.competitionId) url.searchParams.set("league_id", match.competitionId);
    const payload = await fetchApiPayload(url.toString());

    if (!payload?.ok) {
      throw new Error(payload?.message || "Detalhes indisponíveis");
    }

    applyDetailToMatch(match, payload);
  } catch (error) {
    match.detailLoading = false;
    match.detailError = error;
  }

  if (getCurrentAnalysisMatch() === match) renderDetail(match);
}

function openMatchAnalysis(match, sourceView = "jogos") {
  if (!match) return;
  state.currentAnalysisMatch = match;
  state.analysisSourceView = sourceView;
  state.activeTab = "resumo";
  showDashboardView("analise");
  renderDetail(match);
  void loadMatchDetails(match);
}

function uniqueBy(key) {
  return [...new Set(matches.map((match) => match[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function fillSelect(select, values, defaultLabel) {
  select.innerHTML = `<option value="todos">${defaultLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function confidenceClass(value) {
  if (value >= 75) return "bar-green";
  if (value >= 60) return "bar-amber";
  return "bar-red";
}

function riskClass(risk) {
  return `risk-${risk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
}

function confidenceBar(value) {
  return `
    <div class="confidence">
      <div class="confidence-top">
        <span>Confiança</span>
        <strong>${value}%</strong>
      </div>
      <div class="bar"><span class="${confidenceClass(value)}" style="width: ${value}%"></span></div>
    </div>
  `;
}

function clamp(value, min = 35, max = 94) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function projectedConfidence(average, line, direction = "over") {
  const delta = direction === "over" ? average - line : line - average;
  return clamp(58 + delta * 13, 42, 91);
}

function impliedProbability(odd) {
  return odd > 1 ? Math.round((1 / odd) * 100) : 0;
}

function valueEdge(match) {
  return match.confidence - impliedProbability(match.odd);
}

function formatEdge(match) {
  const edge = valueEdge(match);
  return `${edge >= 0 ? "+" : ""}${edge} p.p.`;
}

function suggestedOdd(confidence, boost = 0.08) {
  return Number(Math.max(1.18, 100 / confidence + boost).toFixed(2));
}

function analysisCard(label, value, helper = "") {
  return `
    <div class="analysis-card">
      <span>${label}</span>
      <strong>${value}</strong>
      ${helper ? `<span>${helper}</span>` : ""}
    </div>
  `;
}

function marketLine(label, odd, confidence, helper = "") {
  const validOdd = validMetric(odd);
  return `
    <div class="market-line">
      <div>
        <strong>${label}</strong>
        ${helper ? `<span>${helper}</span>` : ""}
      </div>
      <span>${validOdd && validOdd > 1 ? `Odd ${validOdd.toFixed(2)}` : "Odd indisponível"}</span>
      <div class="fixture-signal line-score">
        <strong>${confidence}%</strong>
        <div class="bar"><span class="${confidenceClass(confidence)}" style="width: ${confidence}%"></span></div>
      </div>
    </div>
  `;
}

function analysisHeading(title, helper = "") {
  return `
    <div class="analysis-heading">
      <h3>${title}</h3>
      ${helper ? `<span>${helper}</span>` : ""}
    </div>
  `;
}

function teamCode(team) {
  const known = {
    "AmÃ©rica Mineiro": "AM",
    "América Mineiro": "AM",
    "AtlÃ©tico GO": "AGO",
    "Atlético GO": "AGO",
    Palmeiras: "PAL",
    Fortaleza: "FOR",
    "Columbus Crew 2": "CLB",
    "Connecticut United": "CON",
    "Minnesota United 2": "MIN",
    "Sporting Kansas City II": "SKC",
  };

  if (known[team]) return known[team];

  const words = team
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);

  return (words.length > 1 ? words.map((word) => word[0]).join("") : team.slice(0, 3))
    .slice(0, 3)
    .toUpperCase();
}

function formPattern(value, side) {
  if (value >= 82) return ["V", "V", "E", "V", "V"];
  if (value >= 72) return side === "home" ? ["V", "E", "V", "D", "V"] : ["E", "V", "V", "E", "V"];
  if (value >= 62) return ["E", "V", "D", "V", "E"];
  if (value >= 52) return side === "home" ? ["D", "E", "V", "D", "E"] : ["E", "D", "V", "E", "D"];
  return ["D", "D", "E", "D", "D"];
}

function formBadge(result) {
  const className = result === "V" ? "win" : result === "E" ? "draw" : "loss";
  return `<span class="form-dot ${className}">${result}</span>`;
}

function winOdd(match, side) {
  const realOdd = validMetric(
    detailField(match, side === "home" ? ["odds_ft_1"] : ["odds_ft_2"]),
  );
  if (realOdd && realOdd > 1) return realOdd;
  if (state.dataSource === "api" || match.raw) return 0;

  const fixed = {
    "best-am-ago": { home: 3.2, away: 2.1 },
    "best-pal-for": { home: 1.63, away: 5.2 },
  };

  if (fixed[match.id]) return fixed[match.id][side];

  const form = side === "home" ? match.stats.homeForm : match.stats.awayForm;
  const opposite = side === "home" ? match.stats.awayForm : match.stats.homeForm;
  const base = side === "home" ? 3.95 : 4.35;
  return Number(Math.max(1.28, base - form * 0.026 + opposite * 0.01).toFixed(2));
}

function matchDateLabel(match) {
  const date = new Date(`${match.date}T${match.time}:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function stadiumName(match) {
  const known = {
    "AmÃ©rica Mineiro": "EstÃ¡dio Raimundo Sampaio",
    "América Mineiro": "Estádio Raimundo Sampaio",
    Palmeiras: "Allianz Parque",
    Flamengo: "MaracanÃ£",
    "Manchester City": "Etihad Stadium",
    "Real Sociedad": "Reale Arena",
  };

  return known[match.home] ?? `EstÃ¡dio ${match.home}`;
}

function renderTeamIdentity(match, side) {
  const team = side === "home" ? match.home : match.away;
  const form = side === "home" ? match.stats.homeForm : match.stats.awayForm;
  const label = side === "home" ? "Casa" : "Fora";
  const odd = winOdd(match, side);

  return `
    <div class="analysis-team-card ${side}">
      <span class="analysis-crest">${teamCode(team)}</span>
      <div class="analysis-team-meta">
        <span>${label}</span>
        <strong>${team}</strong>
        <em>Odd ${odd.toFixed(2)}</em>
      </div>
      <div class="form-strip" aria-label="Forma recente ${team}">
        ${formPattern(form, side).map(formBadge).join("")}
      </div>
    </div>
  `;
}

function renderMatchHeader(match) {
  return `
    <div class="analysis-match-header">
      ${renderTeamIdentity(match, "home")}

      <div class="analysis-match-center">
        <span class="league-line">${match.country} / ${match.league}</span>
        <h2>${match.home} x ${match.away}</h2>
        <p>${matchDateLabel(match)} - ${match.time}</p>
        <small>EstÃ¡dio - ${stadiumName(match)}</small>
      </div>

      ${renderTeamIdentity(match, "away")}
    </div>
  `;
}

function lastFivePoints(form) {
  return Math.round((form / 100) * 10);
}

function h2hMock(match) {
  const total = 14;
  const homeWins = Math.max(3, Math.round(match.stats.homeForm / 20));
  const awayWins = Math.max(3, Math.round(match.stats.awayForm / 20));
  const draws = Math.max(2, total - homeWins - awayWins);

  return {
    total,
    homeWins,
    awayWins,
    draws,
    lastScore: `${match.home} 1 - 1 ${match.away}`,
  };
}

function renderFixtureAnalysis(match) {
  const h2h = h2hMock(match);
  const homeOdd = winOdd(match, "home");
  const awayOdd = winOdd(match, "away");
  const totalProb = match.stats.goals >= 2.6 ? "acima de 2.5 gols" : "abaixo de 3.5 gols";
  const btts = match.stats.goals >= 2.4 ? "BTTS aparece como cenÃ¡rio vivo" : "BTTS pede cautela";

  return `
    <section class="fixture-analysis-card">
      ${analysisHeading("Fixture Analysis", `${match.country} / ${match.league}`)}
      <div class="fixture-copy">
        <p>Em ${matchDateLabel(match)}, <strong>${match.home}</strong> e <strong>${match.away}</strong> se enfrentam pela <strong>${match.league}</strong>. A leitura inicial aponta <strong>${match.market}</strong> como mercado principal, com odd <strong>${match.odd.toFixed(2)}</strong> e confianÃ§a de <strong>${match.confidence}%</strong>.</p>
        <p>Nos dados simulados para este modelo, estes times se encontraram <strong>${h2h.total} vezes</strong>. <strong>${match.home}</strong> venceu ${h2h.homeWins}, <strong>${match.away}</strong> venceu ${h2h.awayWins} e ${h2h.draws} jogos terminaram empatados. O Ãºltimo encontro terminou em <strong>${h2h.lastScore}</strong>.</p>
        <p>A projeÃ§Ã£o do confronto indica mÃ©dia de <strong>${match.stats.goals.toFixed(1)} gols</strong>, <strong>${match.stats.corners.toFixed(1)} escanteios</strong> e <strong>${match.stats.cards.toFixed(1)} cartÃµes</strong>. Pelo encaixe casa/fora, o jogo tende a ficar mais prÃ³ximo de <strong>${totalProb}</strong>, enquanto <strong>${btts}</strong>.</p>
        <p>As odds de vitÃ³ria estÃ£o em <strong>${homeOdd.toFixed(2)}</strong> para ${match.home} e <strong>${awayOdd.toFixed(2)}</strong> para ${match.away}. A recomendaÃ§Ã£o Ã© comparar essas odds com o mercado escolhido antes de confirmar o bilhete.</p>
      </div>
    </section>
  `;
}

function trendRows(match, side) {
  const team = side === "home" ? match.home : match.away;
  const opponent = side === "home" ? match.away : match.home;
  const form = side === "home" ? match.stats.homeForm : match.stats.awayForm;
  const points = lastFivePoints(form);
  const homeAwayLabel = side === "home" ? "em casa" : "fora de casa";
  const rows = [
    {
      type: "neutral",
      text: `${team} somou ${points} pontos nos Ãºltimos 5 jogos e chega com Ã­ndice de forma ${form}/100. O contexto contra ${opponent} exige leitura de mercado antes da entrada.`,
    },
    {
      type: form >= 70 ? "up" : "down",
      text:
        form >= 70
          ? `${team} vem sustentando boa sequÃªncia ${homeAwayLabel}, com desempenho acima da mÃ©dia recente.`
          : `${team} ainda nÃ£o mostra estabilidade ${homeAwayLabel}, com oscilaÃ§Ã£o nos Ãºltimos jogos.`,
    },
    {
      type: match.stats.goals >= 2.5 ? "up" : "down",
      text:
        match.stats.goals >= 2.5
          ? `O cenÃ¡rio de gols Ã© favorÃ¡vel: a partida projeta ${match.stats.goals.toFixed(1)} gols e sustenta linhas de over com melhor leitura.`
          : `O cenÃ¡rio de gols Ã© mais travado: a projeÃ§Ã£o fica em ${match.stats.goals.toFixed(1)} gols e protege mercados under.`,
    },
    {
      type: match.stats.corners >= 9 ? "up" : "neutral",
      text: `A mÃ©dia combinada de escanteios estÃ¡ em ${match.stats.corners.toFixed(1)}, suficiente para monitorar linhas de cantos antes do jogo.`,
    },
    {
      type: match.risk === "Baixo" ? "up" : match.risk === "Alto" ? "down" : "neutral",
      text: `O risco geral do pick principal estÃ¡ marcado como ${match.risk}. Para stake maior, o ideal Ã© confirmar odd, escalaÃ§Ã£o e mercado prÃ©-jogo.`,
    },
  ];

  return rows;
}

function trendIcon(type) {
  if (type === "up") return "â†‘";
  if (type === "down") return "â†“";
  return "â‹¯";
}

function renderTrendColumn(match, side) {
  const team = side === "home" ? match.home : match.away;
  return `
    <article class="trend-column">
      <header>
        <span class="analysis-crest small">${teamCode(team)}</span>
        <strong>${team}</strong>
      </header>
      <div class="trend-list">
        ${trendRows(match, side)
          .map(
            (row) => `
              <div class="trend-item ${row.type}">
                <span>${trendIcon(row.type)}</span>
                <p>${row.text}</p>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderTeamTrends(match) {
  return `
    <section class="team-trends-card">
      ${analysisHeading("Team Trends", "Forma, gols, cantos e risco")}
      <div class="team-trends-grid">
        ${renderTrendColumn(match, "home")}
        ${renderTrendColumn(match, "away")}
      </div>
    </section>
  `;
}

function renderAiStatsSummary(match) {
  const under35 = projectedConfidence(match.stats.goals, 3.5, "under");
  const overCorners = projectedConfidence(match.stats.corners, 8.5, "over");
  const bttsYes = clamp(46 + match.stats.goals * 7 + Math.min(match.stats.homeForm, match.stats.awayForm) * 0.08, 38, 86);
  const safer = match.stats.goals >= 2.6 ? "Over 1.5 gols" : "Under 3.5 gols";

  return `
    <section class="ai-summary-card">
      ${analysisHeading("GPT-5 AI Stats Summary", `${match.home} vs ${match.away}`)}
      <div class="ai-summary-copy">
        <p>As odds sugerem um confronto com leitura equilibrada: ${match.home} aparece a <strong>${winOdd(match, "home").toFixed(2)}</strong>, enquanto ${match.away} aparece a <strong>${winOdd(match, "away").toFixed(2)}</strong>. O mercado principal do modelo Ã© <strong>${match.market}</strong>, com confianÃ§a de <strong>${match.confidence}%</strong> e risco <strong>${match.risk}</strong>.</p>
        <p>O modelo de gols trabalha com mÃ©dia aproximada de <strong>${match.stats.goals.toFixed(1)}</strong>. A linha <strong>Under 3.5</strong> fica em ${under35}% de confianÃ§a, enquanto o BTTS sim aparece em ${bttsYes}%. Em escanteios, a projeÃ§Ã£o de <strong>${match.stats.corners.toFixed(1)}</strong> por jogo deixa a linha <strong>Over 8.5 cantos</strong> em ${overCorners}%.</p>
        <p>O caminho mais conservador Ã© combinar <strong>${safer}</strong> com leitura de cantos, evitando conflito entre mercados de baixa correlaÃ§Ã£o. Para aposta direta, o pick principal segue sendo <strong>${match.market}</strong>, desde que a odd permaneÃ§a acima de <strong>${match.odd.toFixed(2)}</strong>.</p>
      </div>

      <div class="ai-pick-grid">
        ${analysisCard("Main pick", match.market, `Odd ${match.odd.toFixed(2)} / ${match.confidence}%`)}
        ${analysisCard("Safer option", safer, "ProteÃ§Ã£o prÃ©-jogo")}
        ${analysisCard("Corner play", `Over 8.5 cantos`, `${overCorners}% de leitura`)}
        ${analysisCard("Takeaway", match.risk === "Baixo" ? "Entrada viÃ¡vel" : "Stake reduzida", `Risco ${match.risk}`)}
      </div>

      <p class="ai-disclaimer">Resumo gerado com base nos dados mockados do modelo Jtips. Quando a API entrar, este bloco passa a usar os dados reais da FootyStats.</p>
    </section>
  `;
}

function teamCode(team) {
  const known = {
    "América Mineiro": "AM",
    "Atlético GO": "AGO",
    Palmeiras: "PAL",
    Fortaleza: "FOR",
    "Columbus Crew 2": "CLB",
    "Connecticut United": "CON",
    "Minnesota United 2": "MIN",
    "Sporting Kansas City II": "SKC",
  };

  if (known[team]) return known[team];

  const words = team
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);

  return (words.length > 1 ? words.map((word) => word[0]).join("") : team.slice(0, 3))
    .slice(0, 3)
    .toUpperCase();
}

function stadiumName(match) {
  const known = {
    "América Mineiro": "Estádio Raimundo Sampaio",
    Palmeiras: "Allianz Parque",
    Flamengo: "Maracanã",
    "Manchester City": "Etihad Stadium",
    "Real Sociedad": "Reale Arena",
  };

  return known[match.home] ?? `Estádio ${match.home}`;
}

function renderMatchHeader(match) {
  return `
    <div class="analysis-match-header">
      ${renderTeamIdentity(match, "home")}

      <div class="analysis-match-center">
        <span class="league-line">${match.country} / ${match.league}</span>
        <h2>${match.home} x ${match.away}</h2>
        <p>${matchDateLabel(match)} - ${match.time}</p>
        <small>Estádio - ${stadiumName(match)}</small>
      </div>

      ${renderTeamIdentity(match, "away")}
    </div>
  `;
}

function renderFixtureAnalysis(match) {
  const h2h = h2hMock(match);
  const homeOdd = winOdd(match, "home");
  const awayOdd = winOdd(match, "away");
  const totalProb = match.stats.goals >= 2.6 ? "acima de 2.5 gols" : "abaixo de 3.5 gols";
  const btts = match.stats.goals >= 2.4 ? "BTTS aparece como cenário vivo" : "BTTS pede cautela";

  return `
    <section class="fixture-analysis-card">
      ${analysisHeading("Fixture Analysis", `${match.country} / ${match.league}`)}
      <div class="fixture-copy">
        <p>Em ${matchDateLabel(match)}, <strong>${match.home}</strong> e <strong>${match.away}</strong> se enfrentam pela <strong>${match.league}</strong>. A leitura inicial aponta <strong>${match.market}</strong> como mercado principal, com odd <strong>${match.odd.toFixed(2)}</strong> e confiança de <strong>${match.confidence}%</strong>.</p>
        <p>Nos dados simulados para este modelo, estes times se encontraram <strong>${h2h.total} vezes</strong>. <strong>${match.home}</strong> venceu ${h2h.homeWins}, <strong>${match.away}</strong> venceu ${h2h.awayWins} e ${h2h.draws} jogos terminaram empatados. O último encontro terminou em <strong>${h2h.lastScore}</strong>.</p>
        <p>A projeção do confronto indica média de <strong>${match.stats.goals.toFixed(1)} gols</strong>, <strong>${match.stats.corners.toFixed(1)} escanteios</strong> e <strong>${match.stats.cards.toFixed(1)} cartões</strong>. Pelo encaixe casa/fora, o jogo tende a ficar mais próximo de <strong>${totalProb}</strong>, enquanto <strong>${btts}</strong>.</p>
        <p>As odds de vitória estão em <strong>${homeOdd.toFixed(2)}</strong> para ${match.home} e <strong>${awayOdd.toFixed(2)}</strong> para ${match.away}. A recomendação é comparar essas odds com o mercado escolhido antes de confirmar o bilhete.</p>
      </div>
    </section>
  `;
}

function trendRows(match, side) {
  const team = side === "home" ? match.home : match.away;
  const opponent = side === "home" ? match.away : match.home;
  const form = side === "home" ? match.stats.homeForm : match.stats.awayForm;
  const points = lastFivePoints(form);
  const homeAwayLabel = side === "home" ? "em casa" : "fora de casa";
  return [
    {
      type: "neutral",
      text: `${team} somou ${points} pontos nos últimos 5 jogos e chega com índice de forma ${form}/100. O contexto contra ${opponent} exige leitura de mercado antes da entrada.`,
    },
    {
      type: form >= 70 ? "up" : "down",
      text:
        form >= 70
          ? `${team} vem sustentando boa sequência ${homeAwayLabel}, com desempenho acima da média recente.`
          : `${team} ainda não mostra estabilidade ${homeAwayLabel}, com oscilação nos últimos jogos.`,
    },
    {
      type: match.stats.goals >= 2.5 ? "up" : "down",
      text:
        match.stats.goals >= 2.5
          ? `O cenário de gols é favorável: a partida projeta ${match.stats.goals.toFixed(1)} gols e sustenta linhas de over com melhor leitura.`
          : `O cenário de gols é mais travado: a projeção fica em ${match.stats.goals.toFixed(1)} gols e protege mercados under.`,
    },
    {
      type: match.stats.corners >= 9 ? "up" : "neutral",
      text: `A média combinada de escanteios está em ${match.stats.corners.toFixed(1)}, suficiente para monitorar linhas de cantos antes do jogo.`,
    },
    {
      type: match.risk === "Baixo" ? "up" : match.risk === "Alto" ? "down" : "neutral",
      text: `O risco geral do pick principal está marcado como ${match.risk}. Para stake maior, o ideal é confirmar odd, escalação e mercado pré-jogo.`,
    },
  ];
}

function trendIcon(type) {
  if (type === "up") return "↑";
  if (type === "down") return "↓";
  return "·";
}

function renderAiStatsSummary(match) {
  const under35 = projectedConfidence(match.stats.goals, 3.5, "under");
  const overCorners = projectedConfidence(match.stats.corners, 8.5, "over");
  const bttsYes = clamp(46 + match.stats.goals * 7 + Math.min(match.stats.homeForm, match.stats.awayForm) * 0.08, 38, 86);
  const safer = match.stats.goals >= 2.6 ? "Over 1.5 gols" : "Under 3.5 gols";

  return `
    <section class="ai-summary-card">
      ${analysisHeading("GPT-5 AI Stats Summary", `${match.home} vs ${match.away}`)}
      <div class="ai-summary-copy">
        <p>As odds sugerem um confronto com leitura equilibrada: ${match.home} aparece a <strong>${winOdd(match, "home").toFixed(2)}</strong>, enquanto ${match.away} aparece a <strong>${winOdd(match, "away").toFixed(2)}</strong>. O mercado principal do modelo é <strong>${match.market}</strong>, com confiança de <strong>${match.confidence}%</strong> e risco <strong>${match.risk}</strong>.</p>
        <p>O modelo de gols trabalha com média aproximada de <strong>${match.stats.goals.toFixed(1)}</strong>. A linha <strong>Under 3.5</strong> fica em ${under35}% de confiança, enquanto o BTTS sim aparece em ${bttsYes}%. Em escanteios, a projeção de <strong>${match.stats.corners.toFixed(1)}</strong> por jogo deixa a linha <strong>Over 8.5 cantos</strong> em ${overCorners}%.</p>
        <p>O caminho mais conservador é combinar <strong>${safer}</strong> com leitura de cantos, evitando conflito entre mercados de baixa correlação. Para aposta direta, o pick principal segue sendo <strong>${match.market}</strong>, desde que a odd permaneça acima de <strong>${match.odd.toFixed(2)}</strong>.</p>
      </div>

      <div class="ai-pick-grid">
        ${analysisCard("Main pick", match.market, `Odd ${match.odd.toFixed(2)} / ${match.confidence}%`)}
        ${analysisCard("Safer option", safer, "Proteção pré-jogo")}
        ${analysisCard("Corner play", `Over 8.5 cantos`, `${overCorners}% de leitura`)}
        ${analysisCard("Takeaway", match.risk === "Baixo" ? "Entrada viável" : "Stake reduzida", `Risco ${match.risk}`)}
      </div>

      <p class="ai-disclaimer">Resumo gerado com base nos dados mockados do modelo Jtips. Quando a API entrar, este bloco passa a usar os dados reais da FootyStats.</p>
    </section>
  `;
}

function getFilteredMatches() {
  const country = refs.countryFilter.value;
  const league = refs.leagueFilter.value;
  const team = refs.teamFilter.value.trim().toLowerCase();
  const market = refs.marketFilter.value;
  const odd = Number(refs.oddFilter.value || 1);
  const confidence = Number(refs.confidenceFilter.value || 0);
  const date = refs.dateFilter.value;

  return matches.filter((match) => {
    const teamMatch =
      !team ||
      match.home.toLowerCase().includes(team) ||
      match.away.toLowerCase().includes(team);

    return (
      match.date === date &&
      (country === "todos" || match.country === country) &&
      (league === "todos" || match.league === league) &&
      (market === "todos" || match.marketType === market) &&
      (!match.hasRealOdd || match.odd >= odd) &&
      match.confidence >= confidence &&
      teamMatch
    );
  });
}

function renderSummary(list) {
  const total = list.length;
  const strong = list.filter((match) => match.confidence >= 75).length;
  const avgConfidence = total
    ? Math.round(list.reduce((sum, match) => sum + match.confidence, 0) / total)
    : 0;
  const matchesWithOdds = list.filter((match) => match.hasRealOdd && match.odd > 1);
  const avgOdd = matchesWithOdds.length
    ? (
        matchesWithOdds.reduce((sum, match) => sum + match.odd, 0) /
        matchesWithOdds.length
      ).toFixed(2)
    : "—";

  refs.totalMatches.textContent = total;
  refs.strongTips.textContent = strong;
  refs.avgConfidence.textContent = `${avgConfidence}%`;
  refs.avgOdd.textContent = avgOdd;
}

function renderDateChips() {
  refs.dateChips.forEach((button) => {
    const date = shiftedDate(Number(button.dataset.dateShift));
    button.classList.toggle("active", refs.dateFilter.value === date);
  });
}

function teamClassName(team) {
  return teamCode(team)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

function ticketTeamBadges(match, sides = ["home", "away"]) {
  return `
    <span class="ticket-teams">
      ${sides
        .map((side) => {
          const team = side === "home" ? match.home : match.away;
          return `<b class="${teamClassName(team)}">${teamCode(team)}</b>`;
        })
        .join("")}
    </span>
  `;
}

function comfortLines(match) {
  if (state.dataSource === "api" || match.raw) {
    const candidates = [
      {
        label: match.market,
        percent: match.confidence,
        odd: match.hasRealOdd ? match.odd : null,
        teams: ["home", "away"],
      },
      {
        label: "Mais de 1.5 gols",
        percent: apiProbability(match, ["o15_potential", "over15"], ["odds_ft_over15"]),
        odd: validMetric(detailField(match, ["odds_ft_over15"])),
        teams: ["home", "away"],
      },
      {
        label: "Ambas marcam",
        percent: apiProbability(match, ["btts_potential"], ["odds_btts_yes"]),
        odd: validMetric(detailField(match, ["odds_btts_yes"])),
        teams: ["home", "away"],
      },
      {
        label: "Mais de 8.5 escanteios",
        percent: apiProbability(
          match,
          ["corners_o85_potential", "corners_potential"],
          ["odds_corners_over_85"],
        ),
        odd: validMetric(detailField(match, ["odds_corners_over_85"])),
        teams: ["home", "away"],
      },
      {
        label: "Mais cartões no jogo",
        percent: apiProbability(match, ["cards_potential"], []),
        odd: null,
        teams: ["home", "away"],
      },
    ];
    const seen = new Set();

    return candidates
      .filter((line) => validMetric(line.percent) !== null && line.percent >= 70)
      .filter((line) => {
        if (seen.has(line.label)) return false;
        seen.add(line.label);
        return true;
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 4);
  }

  const cornerLine = match.stats.corners >= 9.6 ? 9.5 : 8.5;
  const cardLine = match.stats.cards >= 4.8 ? 4.5 : 3.5;
  const homeScore = clamp(match.stats.homeForm + (match.stats.goals - 2) * 6, 35, 92);
  const awayScore = clamp(match.stats.awayForm + (match.stats.goals - 2) * 5, 35, 92);

  return [
    {
      label: match.market,
      percent: match.confidence,
      odd: match.odd,
      teams: ["home", "away"],
    },
    {
      label: `Cantos +${cornerLine}`,
      percent: projectedConfidence(match.stats.corners, cornerLine, "over"),
      odd: suggestedOdd(projectedConfidence(match.stats.corners, cornerLine, "over"), 0.16),
      teams: ["home", "away"],
    },
    {
      label: `${match.home} marca`,
      percent: homeScore,
      odd: suggestedOdd(homeScore, 0.14),
      teams: ["home"],
    },
    {
      label: `${match.away} marca`,
      percent: awayScore,
      odd: suggestedOdd(awayScore, 0.14),
      teams: ["away"],
    },
    {
      label: `Cartões +${cardLine}`,
      percent: projectedConfidence(match.stats.cards, cardLine, "over"),
      odd: suggestedOdd(projectedConfidence(match.stats.cards, cardLine, "over"), 0.2),
      teams: ["home", "away"],
    },
  ]
    .filter((line) => line.percent >= 70)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 4);
}

function teamMark(team, imageUrl, className, baseClass) {
  const safeUrl = safeImageUrl(imageUrl);
  return `
    <span class="${baseClass} ${className}${safeUrl ? " has-image" : ""}">
      ${
        safeUrl
          ? `<img src="${escapeHtml(safeUrl)}" alt="Escudo ${escapeHtml(team)}" loading="lazy">`
          : teamCode(team)
      }
    </span>
  `;
}

function renderBestCard(match, index) {
  const lines = comfortLines(match);
  const ticket = lines.slice(0, 3);
  const ticketWithOdds = ticket.filter((line) => line.odd && line.odd > 1);
  const oddTotal =
    ticket.length && ticketWithOdds.length === ticket.length
      ? ticket.reduce((total, line) => total * line.odd, 1)
      : null;
  const homeClass = teamClassName(match.home);
  const awayClass = teamClassName(match.away);
  const homeWinOdd = winOdd(match, "home");
  const awayWinOdd = winOdd(match, "away");

  return `
    <article class="market-card${index === 0 ? " featured" : ""}">
      <header class="market-card-header">
        <div class="match-identity">
          ${teamMark(match.home, match.homeLogo, homeClass, "mini-crest")}
          <div>
            <strong>${escapeHtml(match.home)} <span>vs</span> ${escapeHtml(match.away)}</strong>
            <small>${escapeHtml(match.country)} • ${escapeHtml(match.league)}</small>
          </div>
        </div>
        <button class="favorite-button" type="button" aria-label="Favoritar partida">★</button>
        <span class="match-clock">${escapeHtml(match.time)}</span>
      </header>

      <div class="score-panel pregame-panel">
        <div class="team-side">
          ${teamMark(match.home, match.homeLogo, homeClass, "team-logo")}
          <span>Casa</span>
          <strong>${escapeHtml(match.home)}</strong>
          <em>${homeWinOdd > 1 ? `Odd ${homeWinOdd.toFixed(2)}` : "Odd indisponível"}</em>
        </div>
        <div class="team-side right">
          ${teamMark(match.away, match.awayLogo, awayClass, "team-logo")}
          <span>Fora</span>
          <strong>${escapeHtml(match.away)}</strong>
          <em>${awayWinOdd > 1 ? `Odd ${awayWinOdd.toFixed(2)}` : "Odd indisponível"}</em>
        </div>
      </div>

      <div class="line-section">
        <div class="line-heading">
          <span>Linhas de Conforto</span>
          <strong>+70%</strong>
        </div>
        <div class="signal-lines">
          ${lines
            .map(
              (line) => `
                <div class="signal-line">
                  <span>${escapeHtml(line.label)}</span>
                  <div><i style="width: ${line.percent}%"></i></div>
                  <strong>${line.percent}%</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>

      <div class="line-section players">
        <div class="line-heading">
          <span>Bilhete</span>
          <strong>${ticket.length} ${ticket.length === 1 ? "seleção" : "seleções"}</strong>
        </div>
        <div class="ticket-slip">
          <div class="anti-conflict">
            ${ticketTeamBadges(match)}
            <div>
              <strong>Anti-conflito</strong>
              <small>Mercados compatíveis entre si</small>
            </div>
            <em>OK</em>
          </div>
          ${ticket
            .map(
              (line) => `
                <div class="ticket-row">
                  ${ticketTeamBadges(match, line.teams)}
                  <span class="ticket-pick">${escapeHtml(line.label)}</span>
                  <strong>${line.percent}%</strong>
                   <em>${line.odd && line.odd > 1 ? `Odd ${line.odd.toFixed(2)}` : "Sem odd"}</em>
                </div>
              `,
            )
            .join("")}
          <div class="ticket-total">
            <span>Odd total</span>
            <strong>${oddTotal ? oddTotal.toFixed(2) : "—"}</strong>
          </div>
        </div>
      </div>

      <footer class="market-actions">
        <button type="button" data-best-match-id="${escapeHtml(match.id)}">Análise</button>
        <button class="bet365-button" type="button"><span>bet</span>365</button>
      </footer>
    </article>
  `;
}

function renderBestOfDay() {
  if (!refs.bestBoard) return;

  const selectedDate = refs.dateFilter.value || today;
  const source =
    state.dataSource === "api"
      ? matches
      : Object.values(DAILY_ANALYSIS_MATCHES).filter((match) => match.date === selectedDate);
  const best = source
    .filter((match) => match.date === selectedDate && match.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  state.bestMatches = best;

  if (!best.length) {
    refs.bestBoard.innerHTML = `
      <p class="empty-state" style="padding: 18px;">Nenhum jogo acima de 70% para esta data.</p>
    `;
    return;
  }

  refs.bestBoard.innerHTML = best.map(renderBestCard).join("");
  refs.bestBoard.querySelectorAll("[data-best-match-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = state.bestMatches.find((item) => String(item.id) === button.dataset.bestMatchId);
      if (!match) return;
      openMatchAnalysis(match, "melhores");
    });
  });
}

function dailyDateValue(offset) {
  const base = new Date(`${today}T12:00:00`);
  return new Date(base.getTime() + offset * dayMs).toISOString().slice(0, 10);
}

function dailyDateLabel(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(date)
    .replace(".", "")
    .slice(0, 3);
}

function dailyDayMonth(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${day}.${month}`;
}

function renderDailyCalendar() {
  if (!refs.dailyDateStrip) return;

  const selectedDate = refs.dateFilter.value || today;
  refs.dailyDateStrip.innerHTML = Array.from({ length: 13 }, (_, index) => index - 6)
    .map((offset) => {
      const dateValue = dailyDateValue(offset);
      const isToday = dateValue === today;
      const isActive = dateValue === selectedDate;
      return `
        <button
          class="${isActive ? "active" : ""}"
          type="button"
          data-daily-date="${dateValue}"
          aria-pressed="${isActive}"
        >
          <span>${isToday ? "Hoje" : dailyDateLabel(dateValue)}</span>
          <strong>${dailyDayMonth(dateValue)}</strong>
        </button>
      `;
    })
    .join("");

  refs.dailyDateStrip.querySelectorAll("[data-daily-date]").forEach((button) => {
    button.addEventListener("click", () => {
      refs.dateFilter.value = button.dataset.dailyDate;
      void refreshMatchesForDate();
    });
  });
}

function finishedMatch(match) {
  return ["complete", "completed", "finished", "ft", "encerrado"].includes(match.status);
}

function filterDailyByStatus(list) {
  if (state.dailyStatus === "encerrados") {
    return list.filter(finishedMatch);
  }
  if (state.dailyStatus === "proximos") {
    return list.filter((match) => !finishedMatch(match));
  }
  return list;
}

function safeImageUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function dailyClubLogo(team, imageUrl) {
  const safeUrl = safeImageUrl(imageUrl);
  if (safeUrl) {
    return `<b class="club-logo has-image"><img src="${escapeHtml(safeUrl)}" alt="" loading="lazy"></b>`;
  }
  return `<b class="club-logo">${teamCode(team)}</b>`;
}

function dailyStatusLabel(match) {
  if (finishedMatch(match)) {
    if (match.homeScore !== null && match.awayScore !== null) {
      return `${match.homeScore} - ${match.awayScore}`;
    }
    return "Encerrado";
  }

  return match.time || "Pré-jogo";
}

function renderDailyGames() {
  if (!refs.dailyLeagueList) return;

  refs.dailyStatusButtons.forEach((button) => {
    const active = button.dataset.dailyStatus === state.dailyStatus;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (state.apiLoading) {
    refs.dailyLeagueList.innerHTML = `
      <div class="daily-api-message">
        <strong>Carregando jogos reais</strong>
        <span>Consultando a FootyStats...</span>
      </div>
    `;
    return;
  }

  if (state.dataSource !== "api") {
    refs.dailyLeagueList.innerHTML = `
      <div class="daily-api-message error">
        <strong>Não foi possível carregar os jogos</strong>
        <span>A agenda não exibirá dados fictícios. Use o botão atualizar para tentar novamente.</span>
      </div>
    `;
    return;
  }

  const selectedDate = refs.dateFilter.value || today;
  const dailyMatches = filterDailyByStatus(
    matches.filter((match) => match.date === selectedDate),
  );

  if (!dailyMatches.length) {
    refs.dailyLeagueList.innerHTML = `
      <div class="daily-api-message">
        <strong>Nenhum jogo encontrado</strong>
        <span>Não há partidas para esta data e status.</span>
      </div>
    `;
    return;
  }

  refs.dailyLeagueList.innerHTML = [...groupByLeague([...dailyMatches]).values()]
    .map(
      (group, groupIndex) => `
        <article class="daily-league-card" data-daily-league="${groupIndex}">
          <header class="daily-league-header">
            <div>
              <span class="flag-badge">${escapeHtml(countryBadge(group.country))}</span>
              <strong>${escapeHtml(group.country)}</strong>
              <small>${escapeHtml(group.league)}</small>
            </div>
            <button type="button" data-collapse-league="${groupIndex}" aria-label="Recolher liga" aria-expanded="true">⌃</button>
          </header>
          <div class="daily-league-matches">
            ${group.matches
              .map(
                (match) => `
                  <button class="daily-match-row" type="button" data-daily-match-id="${escapeHtml(match.id)}">
                    <div class="daily-teams">
                      <span>${dailyClubLogo(match.home, match.homeLogo)}${escapeHtml(match.home)}</span>
                      <span>${dailyClubLogo(match.away, match.awayLogo)}${escapeHtml(match.away)}</span>
                    </div>
                    <div class="daily-match-meta">
                      <time>${escapeHtml(dailyStatusLabel(match))}</time>
                      <small>${escapeHtml(match.market)} • ${match.confidence}%</small>
                    </div>
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");

  refs.dailyLeagueList.querySelectorAll("[data-daily-match-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = matches.find((item) => String(item.id) === button.dataset.dailyMatchId);
      if (!match) return;
      openMatchAnalysis(match, "jogos");
    });
  });

  refs.dailyLeagueList.querySelectorAll("[data-collapse-league]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".daily-league-card");
      const collapsed = card.classList.toggle("collapsed");
      button.textContent = collapsed ? "⌄" : "⌃";
      button.setAttribute("aria-expanded", String(!collapsed));
    });
  });
}

function renderDailyAgenda() {
  renderDailyCalendar();
  renderDailyGames();
}

function groupByLeague(list) {
  return list
    .sort((a, b) => {
      const country = a.country.localeCompare(b.country, "pt-BR");
      const league = a.league.localeCompare(b.league, "pt-BR");
      return country || league || a.time.localeCompare(b.time, "pt-BR");
    })
    .reduce((groups, match) => {
      const key = `${match.country}__${match.league}`;
      if (!groups.has(key)) {
        groups.set(key, {
          country: match.country,
          league: match.league,
          matches: [],
        });
      }
      groups.get(key).matches.push(match);
      return groups;
    }, new Map());
}

function countryBadge(country) {
  return country.slice(0, 3).toUpperCase();
}

function renderFixtures(list) {
  refs.fixturesList.innerHTML = "";
  refs.fixtureCount.textContent = `${list.length} jogo${list.length === 1 ? "" : "s"}`;

  if (!list.length) {
    refs.fixturesList.innerHTML = `<p class="empty-state" style="padding: 18px;">Nenhum jogo encontrado com os filtros atuais.</p>`;
    return;
  }

  groupByLeague([...list]).forEach((group) => {
    const section = document.createElement("section");
    section.className = "league-group";
    section.innerHTML = `
      <header class="league-header">
        <div class="league-title">
          <span class="country-badge">${countryBadge(group.country)}</span>
          <strong>${group.league}</strong>
        </div>
        <span>${group.country} • ${group.matches.length} jogo${group.matches.length === 1 ? "" : "s"}</span>
      </header>
    `;

    group.matches.forEach((match) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `fixture-row${state.selectedId === match.id ? " active" : ""}`;
      row.innerHTML = `
        <span class="fixture-time">${match.time}</span>
        <div class="fixture-teams">
          <span class="team-name">${match.home}</span>
          <span class="team-name">${match.away}</span>
        </div>
        <div class="fixture-market">
          <strong>${match.market}</strong>
          <span>${match.hasRealOdd ? `Odd ${match.odd.toFixed(2)}` : "Odd indisponível"} • <span class="${riskClass(match.risk)}">Risco ${match.risk}</span></span>
        </div>
        <div class="fixture-signal">
          <strong>${match.confidence}%</strong>
          <div class="bar"><span class="${confidenceClass(match.confidence)}" style="width: ${match.confidence}%"></span></div>
        </div>
      `;
      row.addEventListener("click", () => selectMatch(match.id));
      section.appendChild(row);
    });
    refs.fixturesList.appendChild(section);
  });
}

function getDetailTab(tabId = state.activeTab) {
  return DETAIL_TABS.find((tab) => tab.id === tabId) ?? DETAIL_TABS[0];
}

function getActiveSubtab(tabId = state.activeTab) {
  const tab = getDetailTab(tabId);
  const active = state.activeSubtabs[tab.id];

  if (!tab.subtabs.some((subtab) => subtab.id === active)) {
    state.activeSubtabs[tab.id] = tab.subtabs[0].id;
  }

  return state.activeSubtabs[tab.id];
}

function renderTabNavigation(match) {
  refs.matchTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  const tab = getDetailTab();
  const activeSubtab = getActiveSubtab(tab.id);
  refs.matchSubtabs.innerHTML = "";

  tab.subtabs.forEach((subtab) => {
    const button = document.createElement("button");
    const isActive = subtab.id === activeSubtab;
    button.type = "button";
    button.className = isActive ? "active" : "";
    button.textContent = subtab.label;
    button.setAttribute("aria-pressed", String(isActive));
    button.addEventListener("click", () => {
      state.activeSubtabs[tab.id] = subtab.id;
      renderDetail(match);
    });
    refs.matchSubtabs.appendChild(button);
  });
}

function comparisonBlock(match) {
  return `
    <div class="comparison">
      <div class="team-line">
        <span>${match.home}</span>
        <div class="team-bar"><span style="width: ${match.stats.homeForm}%"></span></div>
        <strong>${match.stats.homeForm}</strong>
      </div>
      <div class="team-line">
        <span>${match.away}</span>
        <div class="team-bar"><span style="width: ${match.stats.awayForm}%"></span></div>
        <strong>${match.stats.awayForm}</strong>
      </div>
    </div>
  `;
}

function renderResumoTab(match, subtab) {
  if (subtab === "trends") return renderTeamTrends(match);
  if (subtab === "ai") return renderAiStatsSummary(match);
  return renderFixtureAnalysis(match);

  if (subtab === "forma") {
    const gap = match.stats.homeForm - match.stats.awayForm;
    return `
      <div class="analysis-block">
        ${analysisHeading("Forma recente", "Índice mockado para pré-jogo")}
        <div class="analysis-grid">
          ${analysisCard(match.home, `${match.stats.homeForm}/100`, "Força como mandante")}
          ${analysisCard(match.away, `${match.stats.awayForm}/100`, "Força como visitante")}
          ${analysisCard("Diferença", `${gap >= 0 ? "+" : ""}${gap}`, "Vantagem de momento")}
          ${analysisCard("Leitura", gap >= 18 ? "Mandante superior" : gap <= -10 ? "Visitante competitivo" : "Jogo equilibrado")}
        </div>
        ${comparisonBlock(match)}
      </div>
    `;
  }

  if (subtab === "valor") {
    return `
      <div class="analysis-block">
        ${analysisHeading("Valor da entrada", "Confiança x probabilidade implícita")}
        <div class="analysis-grid">
          ${analysisCard("Mercado", match.market, "Aposta pronta")}
          ${analysisCard("Odd atual", match.odd.toFixed(2), "Odd mockada")}
          ${analysisCard("Prob. implícita", `${impliedProbability(match.odd)}%`, "Derivada da odd")}
          ${analysisCard("Edge", formatEdge(match), "Confiança menos prob. implícita")}
        </div>
        ${confidenceBar(match.confidence)}
        <p class="analysis-note">${match.reason}</p>
      </div>
    `;
  }

  return `
    <div class="metric-row">
      <span class="metric-chip">Mercado: ${match.market}</span>
      <span class="metric-chip">Odd: ${match.odd.toFixed(2)}</span>
      <span class="metric-chip ${riskClass(match.risk)}">Risco: ${match.risk}</span>
      <span class="metric-chip">API: ${API_CONFIG.provider}</span>
    </div>

    ${confidenceBar(match.confidence)}

    <div class="detail-stats">
      ${analysisCard("Média de gols", match.stats.goals.toFixed(1))}
      ${analysisCard("Escanteios", match.stats.corners.toFixed(1))}
      ${analysisCard("Cartões", match.stats.cards.toFixed(1))}
      ${analysisCard("Casa/Fora", match.stats.homeAway)}
    </div>

    ${comparisonBlock(match)}
    <p class="empty-state">${match.reason}</p>
  `;
}

function renderTipsTab(match, subtab) {
  if (subtab === "alternativas") {
    const over15 = projectedConfidence(match.stats.goals, 1.5, "over");
    const corners85 = projectedConfidence(match.stats.corners, 8.5, "over");
    const cards35 = projectedConfidence(match.stats.cards, 3.5, "over");
    const homeDnb = clamp(58 + (match.stats.homeForm - match.stats.awayForm) * 0.35, 42, 88);

    return `
      <div class="analysis-block">
        ${analysisHeading("Entradas alternativas", "Linhas para monitorar")}
        <div class="market-lines">
          ${marketLine("Over 1.5 gols", suggestedOdd(over15), over15, "Linha conservadora")}
          ${marketLine("Mais de 8.5 escanteios", suggestedOdd(corners85), corners85, "Volume de cantos")}
          ${marketLine("Mais de 3.5 cartões", suggestedOdd(cards35), cards35, "Disciplina do jogo")}
          ${marketLine(`${match.home} empate anula`, suggestedOdd(homeDnb, 0.15), homeDnb, "Proteção casa/fora")}
        </div>
      </div>
    `;
  }

  if (subtab === "risco") {
    const volatility = clamp(100 - match.confidence + (match.odd - 1) * 18, 18, 72);
    return `
      <div class="analysis-block">
        ${analysisHeading("Mapa de risco", "Leitura rápida antes da entrada")}
        <div class="analysis-grid">
          ${analysisCard("Risco indicado", match.risk, "Baseado na confiança")}
          ${analysisCard("Volatilidade", `${volatility}%`, "Quanto maior, mais sensível")}
          ${analysisCard("Odd justa", suggestedOdd(match.confidence, 0).toFixed(2), "Pela confiança atual")}
          ${analysisCard("Edge", formatEdge(match), "Margem estimada")}
        </div>
        <p class="analysis-note">Use esta aba para decidir stake. Entradas com bom edge e risco baixo tendem a ser candidatas melhores para aposta principal.</p>
      </div>
    `;
  }

  return `
    <div class="analysis-block">
      ${analysisHeading("Aposta pronta", `${match.country} • ${match.league}`)}
      <div class="market-lines">
        ${marketLine(match.market, match.odd, match.confidence, `Risco ${match.risk}`)}
      </div>
      <div class="analysis-grid">
        ${analysisCard("Confiança", `${match.confidence}%`, "Barra principal")}
        ${analysisCard("Odd", match.odd.toFixed(2), "Entrada sugerida")}
        ${analysisCard("Risco", match.risk, "Classificação")}
        ${analysisCard("Edge", formatEdge(match), "Valor estimado")}
      </div>
      <p class="analysis-note">${match.reason}</p>
    </div>
  `;
}

function renderGolsTab(match, subtab) {
  const avg = match.stats.goals;

  if (subtab === "under") {
    return `
      <div class="analysis-block">
        ${analysisHeading("Linhas Under", `Média projetada: ${avg.toFixed(1)} gols`)}
        <div class="market-lines">
          ${marketLine("Under 2.5 gols", suggestedOdd(projectedConfidence(avg, 2.5, "under")), projectedConfidence(avg, 2.5, "under"), "Linha principal")}
          ${marketLine("Under 3.5 gols", suggestedOdd(projectedConfidence(avg, 3.5, "under")), projectedConfidence(avg, 3.5, "under"), "Proteção maior")}
          ${marketLine("Under 4.5 gols", suggestedOdd(projectedConfidence(avg, 4.5, "under")), projectedConfidence(avg, 4.5, "under"), "Linha conservadora")}
        </div>
      </div>
    `;
  }

  if (subtab === "ambas") {
    const yes = clamp(46 + avg * 7 + Math.min(match.stats.homeForm, match.stats.awayForm) * 0.08, 38, 86);
    const no = clamp(100 - yes + 15, 32, 80);
    return `
      <div class="analysis-block">
        ${analysisHeading("Ambas marcam", "BTTS sim/não")}
        <div class="market-lines">
          ${marketLine("Ambas marcam - Sim", suggestedOdd(yes, 0.12), yes, "BTTS")}
          ${marketLine("Ambas marcam - Não", suggestedOdd(no, 0.15), no, "BTTS")}
        </div>
        <div class="analysis-grid">
          ${analysisCard("Gols projetados", avg.toFixed(1))}
          ${analysisCard("Força menor", `${Math.min(match.stats.homeForm, match.stats.awayForm)}/100`, "Time menos forte")}
        </div>
      </div>
    `;
  }

  return `
    <div class="analysis-block">
      ${analysisHeading("Linhas Over", `Média projetada: ${avg.toFixed(1)} gols`)}
      <div class="market-lines">
        ${marketLine("Over 0.5 gols", suggestedOdd(projectedConfidence(avg, 0.5, "over")), projectedConfidence(avg, 0.5, "over"), "Linha mínima")}
        ${marketLine("Over 1.5 gols", suggestedOdd(projectedConfidence(avg, 1.5, "over")), projectedConfidence(avg, 1.5, "over"), "Linha forte")}
        ${marketLine("Over 2.5 gols", suggestedOdd(projectedConfidence(avg, 2.5, "over")), projectedConfidence(avg, 2.5, "over"), "Linha agressiva")}
        ${marketLine("Over 3.5 gols", suggestedOdd(projectedConfidence(avg, 3.5, "over")), projectedConfidence(avg, 3.5, "over"), "Alta variância")}
      </div>
    </div>
  `;
}

function renderEscanteiosTab(match, subtab) {
  const avg = match.stats.corners;

  if (subtab === "menos") {
    return `
      <div class="analysis-block">
        ${analysisHeading("Menos escanteios", `Média projetada: ${avg.toFixed(1)}`)}
        <div class="market-lines">
          ${marketLine("Menos de 8.5", suggestedOdd(projectedConfidence(avg, 8.5, "under")), projectedConfidence(avg, 8.5, "under"), "Linha baixa")}
          ${marketLine("Menos de 9.5", suggestedOdd(projectedConfidence(avg, 9.5, "under")), projectedConfidence(avg, 9.5, "under"), "Linha média")}
          ${marketLine("Menos de 10.5", suggestedOdd(projectedConfidence(avg, 10.5, "under")), projectedConfidence(avg, 10.5, "under"), "Linha protegida")}
          ${marketLine("Menos de 11.5", suggestedOdd(projectedConfidence(avg, 11.5, "under")), projectedConfidence(avg, 11.5, "under"), "Linha conservadora")}
        </div>
      </div>
    `;
  }

  if (subtab === "times") {
    const homeCorners = clamp(56 + match.stats.homeForm * 0.25 - match.stats.awayForm * 0.1, 42, 86);
    const awayCorners = clamp(50 + match.stats.awayForm * 0.22 - match.stats.homeForm * 0.1, 38, 82);
    return `
      <div class="analysis-block">
        ${analysisHeading("Escanteios por time", "Distribuição esperada")}
        <div class="market-lines">
          ${marketLine(`${match.home} mais escanteios`, suggestedOdd(homeCorners, 0.16), homeCorners, "Mandante")}
          ${marketLine(`${match.away} mais escanteios`, suggestedOdd(awayCorners, 0.18), awayCorners, "Visitante")}
          ${marketLine(`${match.home} over 4.5`, suggestedOdd(clamp(homeCorners - 4), 0.12), clamp(homeCorners - 4), "Linha individual")}
          ${marketLine(`${match.away} over 3.5`, suggestedOdd(clamp(awayCorners - 2), 0.12), clamp(awayCorners - 2), "Linha individual")}
        </div>
      </div>
    `;
  }

  return `
    <div class="analysis-block">
      ${analysisHeading("Mais escanteios", `Média projetada: ${avg.toFixed(1)}`)}
      <div class="market-lines">
        ${marketLine("Mais de 7.5", suggestedOdd(projectedConfidence(avg, 7.5, "over")), projectedConfidence(avg, 7.5, "over"), "Linha conservadora")}
        ${marketLine("Mais de 8.5", suggestedOdd(projectedConfidence(avg, 8.5, "over")), projectedConfidence(avg, 8.5, "over"), "Linha base")}
        ${marketLine("Mais de 9.5", suggestedOdd(projectedConfidence(avg, 9.5, "over")), projectedConfidence(avg, 9.5, "over"), "Linha forte")}
        ${marketLine("Mais de 10.5", suggestedOdd(projectedConfidence(avg, 10.5, "over")), projectedConfidence(avg, 10.5, "over"), "Linha agressiva")}
      </div>
    </div>
  `;
}

function renderCartoesTab(match, subtab) {
  const avg = match.stats.cards;
  const homeCards = clamp(48 + match.stats.homeForm * 0.16 + avg * 3, 40, 88);
  const awayCards = clamp(46 + match.stats.awayForm * 0.16 + avg * 3, 38, 86);

  if (subtab === "mandante") {
    return `
      <div class="analysis-block">
        ${analysisHeading(`Cartões ${match.home}`, "Mercados do mandante")}
        <div class="market-lines">
          ${marketLine(`${match.home} over 1.5 cartões`, suggestedOdd(homeCards), homeCards, "Linha individual")}
          ${marketLine(`${match.home} over 2.5 cartões`, suggestedOdd(clamp(homeCards - 12), 0.16), clamp(homeCards - 12), "Linha agressiva")}
          ${marketLine(`${match.home} mais cartões`, suggestedOdd(clamp(homeCards - awayCards + 56), 0.18), clamp(homeCards - awayCards + 56), "Comparativo")}
        </div>
      </div>
    `;
  }

  if (subtab === "visitante") {
    return `
      <div class="analysis-block">
        ${analysisHeading(`Cartões ${match.away}`, "Mercados do visitante")}
        <div class="market-lines">
          ${marketLine(`${match.away} over 1.5 cartões`, suggestedOdd(awayCards), awayCards, "Linha individual")}
          ${marketLine(`${match.away} over 2.5 cartões`, suggestedOdd(clamp(awayCards - 12), 0.16), clamp(awayCards - 12), "Linha agressiva")}
          ${marketLine(`${match.away} mais cartões`, suggestedOdd(clamp(awayCards - homeCards + 56), 0.18), clamp(awayCards - homeCards + 56), "Comparativo")}
        </div>
      </div>
    `;
  }

  return `
    <div class="analysis-block">
      ${analysisHeading("Cartões totais", `Média projetada: ${avg.toFixed(1)}`)}
      <div class="market-lines">
        ${marketLine("Mais de 3.5 cartões", suggestedOdd(projectedConfidence(avg, 3.5, "over")), projectedConfidence(avg, 3.5, "over"), "Linha base")}
        ${marketLine("Mais de 4.5 cartões", suggestedOdd(projectedConfidence(avg, 4.5, "over")), projectedConfidence(avg, 4.5, "over"), "Linha forte")}
        ${marketLine("Mais de 5.5 cartões", suggestedOdd(projectedConfidence(avg, 5.5, "over")), projectedConfidence(avg, 5.5, "over"), "Linha agressiva")}
        ${marketLine("Menos de 6.5 cartões", suggestedOdd(projectedConfidence(avg, 6.5, "under")), projectedConfidence(avg, 6.5, "under"), "Proteção")}
      </div>
    </div>
  `;
}

function renderCasaForaTab(match, subtab) {
  const diff = match.stats.homeForm - match.stats.awayForm;
  const homeWin = clamp(48 + diff * 0.45, 32, 88);
  const draw = clamp(36 - Math.abs(diff) * 0.18, 18, 44);
  const awayWin = clamp(46 - diff * 0.45, 26, 84);

  if (subtab === "mandante") {
    return `
      <div class="analysis-block">
        ${analysisHeading(match.home, "Desempenho como casa")}
        <div class="analysis-grid">
          ${analysisCard("Força casa", `${match.stats.homeForm}/100`)}
          ${analysisCard("Gols do jogo", match.stats.goals.toFixed(1))}
          ${analysisCard("Escanteios", match.stats.corners.toFixed(1))}
          ${analysisCard("Perfil", match.stats.homeAway)}
        </div>
        <div class="market-lines">
          ${marketLine(`${match.home} vence`, suggestedOdd(homeWin, 0.18), homeWin, "Resultado")}
          ${marketLine(`${match.home} ou empate`, suggestedOdd(clamp(homeWin + 12), 0.02), clamp(homeWin + 12), "Dupla chance")}
        </div>
      </div>
    `;
  }

  if (subtab === "visitante") {
    return `
      <div class="analysis-block">
        ${analysisHeading(match.away, "Desempenho como visitante")}
        <div class="analysis-grid">
          ${analysisCard("Força fora", `${match.stats.awayForm}/100`)}
          ${analysisCard("Resistência", `${clamp(100 - diff, 30, 85)}/100`)}
          ${analysisCard("Gols do jogo", match.stats.goals.toFixed(1))}
          ${analysisCard("Risco", match.risk)}
        </div>
        <div class="market-lines">
          ${marketLine(`${match.away} vence`, suggestedOdd(awayWin, 0.2), awayWin, "Resultado")}
          ${marketLine(`${match.away} ou empate`, suggestedOdd(clamp(awayWin + 12), 0.04), clamp(awayWin + 12), "Dupla chance")}
        </div>
      </div>
    `;
  }

  return `
    <div class="analysis-block">
      ${analysisHeading("Resultado casa/fora", "Probabilidades mockadas")}
      <div class="market-lines">
        ${marketLine(`${match.home} vence`, suggestedOdd(homeWin, 0.18), homeWin, "Mandante")}
        ${marketLine("Empate", suggestedOdd(draw, 0.35), draw, "Resultado")}
        ${marketLine(`${match.away} vence`, suggestedOdd(awayWin, 0.2), awayWin, "Visitante")}
        ${marketLine(`${match.home} empate anula`, suggestedOdd(clamp(homeWin + 5), 0.12), clamp(homeWin + 5), "Proteção")}
      </div>
      ${comparisonBlock(match)}
    </div>
  `;
}

function tableToneClass(tone) {
  const value = Number(tone);
  if (value >= 75) return "high";
  if (value >= 45) return "mid";
  return "low";
}

function statCell(value, tone = value) {
  const numericTone = Math.max(0, Math.min(100, Number(tone) || 0));
  const toneClass = tableToneClass(numericTone);
  const isPercent = String(value).includes("%");

  if (!isPercent) {
    return `<td class="stat-cell metric-value"><span>${value}</span></td>`;
  }

  return `
    <td class="stat-cell ${toneClass}">
      <div class="percent-cell">
        <strong>${value}</strong>
        <div class="percent-track">
          <span style="width: ${numericTone}%"></span>
        </div>
      </div>
    </td>
  `;
}

function renderStatsTable(title, firstColumn, rows, match) {
  return `
    <div class="jtips-table-card">
      <table class="jtips-table">
        <thead>
          <tr>
            <th>${firstColumn}</th>
            <th>${match.home}</th>
            <th>${match.away}</th>
            <th>Média</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              if (row.section) {
                return `<tr class="table-section-row"><td colspan="4">${row.section}</td></tr>`;
              }
              return `
                <tr>
                  <td>${row.label}</td>
                  ${statCell(row.home, row.homeTone)}
                  ${statCell(row.away, row.awayTone)}
                  ${statCell(row.avg, row.avgTone)}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
      ${title ? `<p class="table-caption">${title}</p>` : ""}
    </div>
  `;
}

function analysisModule(title, helper, intro, content) {
  return `
    <section class="analysis-module">
      <header class="analysis-module-header">
        <div>
          <h3>${title}</h3>
          ${helper ? `<span>${helper}</span>` : ""}
        </div>
      </header>
      ${intro ? `<p class="analysis-module-intro">${intro}</p>` : ""}
      ${content}
    </section>
  `;
}

function summaryStatCards(items) {
  return `
    <div class="market-summary-strip">
      ${items
        .map(
          (item) => `
            <div class="market-summary-item ${item.featured ? "featured" : ""}">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
              ${item.helper ? `<small>${item.helper}</small>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderGolsTab(match, subtab) {
  const intro = `${match.home} e ${match.away} Over 0,5 ~ 4,5 e dados BTTS.`;
  const overRows = [
    { label: "Mais de 0,5", home: "80%", away: "100%", avg: "90%", homeTone: 80, awayTone: 100, avgTone: 90 },
    { label: "Mais de 1,5", home: "80%", away: "60%", avg: "70%", homeTone: 80, awayTone: 60, avgTone: 70 },
    { label: "Mais de 2,5", home: "80%", away: "20%", avg: "50%", homeTone: 80, awayTone: 20, avgTone: 50 },
    { label: "Mais de 3,5", home: "0%", away: "0%", avg: "0%", homeTone: 0, awayTone: 0, avgTone: 0 },
    { label: "Mais de 4,5", home: "0%", away: "0%", avg: "0%", homeTone: 0, awayTone: 0, avgTone: 0 },
    { label: "BTTS", home: "60%", away: "60%", avg: "60%", homeTone: 60, awayTone: 60, avgTone: 60 },
    { label: "Ambas as equipes marcam e ganham.", home: "0%", away: "0%", avg: "0%", homeTone: 0, awayTone: 0, avgTone: 0 },
    { label: "Ambas as equipes marcam e empatam.", home: "0%", away: "40%", avg: "20%", homeTone: 0, awayTone: 40, avgTone: 20 },
    { label: "Ambas as equipes marcam e mais de 2,5 gols.", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "Ambas não marcam e mais de 2,5", home: "20%", away: "0%", avg: "10%", homeTone: 20, awayTone: 0, avgTone: 10 },
  ];
  const tempoRows = [
    { section: "Gols do primeiro tempo" },
    { label: "Ambas as equipes marcam no primeiro tempo.", home: "40%", away: "20%", avg: "30%", homeTone: 40, awayTone: 20, avgTone: 30 },
    { label: "Mais de 0,5 FH", home: "60%", away: "80%", avg: "70%", homeTone: 60, awayTone: 80, avgTone: 70 },
    { label: "Mais de 1,5 FH", home: "40%", away: "20%", avg: "30%", homeTone: 40, awayTone: 20, avgTone: 30 },
    { label: "Mais de 2,5 FH", home: "0%", away: "0%", avg: "0%", homeTone: 0, awayTone: 0, avgTone: 0 },
    { section: "Gols do segundo tempo" },
    { label: "Ambas as equipes marcam no segundo tempo.", home: "0%", away: "20%", avg: "10%", homeTone: 0, awayTone: 20, avgTone: 10 },
    { label: "Ambas as equipes marcam nos dois tempos.", home: "0%", away: "0%", avg: "0%", homeTone: 0, awayTone: 0, avgTone: 0 },
    { label: "Mais de 0,5 2H", home: "80%", away: "40%", avg: "60%", homeTone: 80, awayTone: 40, avgTone: 60 },
    { label: "Mais de 1,5 2H", home: "40%", away: "40%", avg: "40%", homeTone: 40, awayTone: 40, avgTone: 40 },
    { label: "Mais de 2,5 2H", home: "20%", away: "0%", avg: "10%", homeTone: 20, awayTone: 0, avgTone: 10 },
  ];
  const underRows = [
    { section: "Menos de X gols" },
    { label: "Menos de 0,5", home: "20%", away: "0%", avg: "10%", homeTone: 20, awayTone: 0, avgTone: 10 },
    { label: "Menos de 1,5", home: "20%", away: "40%", avg: "30%", homeTone: 20, awayTone: 40, avgTone: 30 },
    { label: "Menos de 2,5", home: "20%", away: "80%", avg: "50%", homeTone: 20, awayTone: 80, avgTone: 50 },
    { label: "Menos de 3,5", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Menos de 4,5", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { section: "Primeiro/Segundo Tempo" },
    { label: "Menos de 0,5 FH", home: "40%", away: "20%", avg: "30%", homeTone: 40, awayTone: 20, avgTone: 30 },
    { label: "Menos de 1,5 FH", home: "60%", away: "80%", avg: "70%", homeTone: 60, awayTone: 80, avgTone: 70 },
    { label: "Menos de 2,5 FH", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Menos de 0,5 2H", home: "20%", away: "60%", avg: "40%", homeTone: 20, awayTone: 60, avgTone: 40 },
    { label: "Menos de 1,5 2H", home: "60%", away: "60%", avg: "60%", homeTone: 60, awayTone: 60, avgTone: 60 },
    { label: "Menos de 2,5 2H", home: "80%", away: "100%", avg: "90%", homeTone: 80, awayTone: 100, avgTone: 90 },
  ];
  const table =
    subtab === "tempos"
      ? renderStatsTable("", "1º/2º Tempo", tempoRows, match)
      : subtab === "under"
        ? renderStatsTable("", "Gols (Menos)", underRows, match)
        : renderStatsTable("", "Gols da partida", overRows, match);

  return analysisModule("Previsões de Mais de 2,5 gols e Ambas as Equipes Marcam.", "Quantos gols haverá nesta partida?", intro, table);
}

function renderCartoesTab(match, subtab) {
  const total = match.stats.cards.toFixed(2);
  const summary = summaryStatCards([
    { label: "Total de cartões por partida", value: total, helper: `Somatório entre ${match.home} e ${match.away}`, featured: true },
    { label: match.home, value: "2,20 cartões", helper: "Reservado / Partida" },
    { label: match.away, value: "3,00 cartões", helper: "Reservado / Partida" },
  ]);
  const totalRows = [
    { label: "Mais de 2,5", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 3,5", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 4,5", home: "80%", away: "80%", avg: "80%", homeTone: 80, awayTone: 80, avgTone: 80 },
    { label: "Mais de 5,5", home: "60%", away: "40%", avg: "50%", homeTone: 60, awayTone: 40, avgTone: 50 },
    { label: "Mais de 6,5", home: "20%", away: "20%", avg: "20%", homeTone: 20, awayTone: 20, avgTone: 20 },
  ];
  const equipeRows = [
    { section: "Cartões de Equipe" },
    { label: "Cartas para média", home: "2.2", away: "3", avg: "2.6", homeTone: 55, awayTone: 80, avgTone: 70 },
    { label: "Mais de 0,5 por", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 1,5 por", home: "60%", away: "100%", avg: "80%", homeTone: 60, awayTone: 100, avgTone: 80 },
    { label: "Mais de 2,5 por", home: "40%", away: "60%", avg: "50%", homeTone: 40, awayTone: 60, avgTone: 50 },
    { label: "Mais de 3,5 por", home: "20%", away: "40%", avg: "30%", homeTone: 20, awayTone: 40, avgTone: 30 },
    { section: "Cartas Contra" },
    { label: "Mais de 0,5 contra", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 1,5 gols contra", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 2,5 contra", home: "100%", away: "40%", avg: "70%", homeTone: 100, awayTone: 40, avgTone: 70 },
    { label: "Mais de 3,5 contra", home: "60%", away: "0%", avg: "30%", homeTone: 60, awayTone: 0, avgTone: 30 },
  ];
  const table = renderStatsTable(
    `Total de cartões por partida entre ${match.home} e ${match.away}. A média da liga é usada como referência do modelo.`,
    subtab === "equipe" ? "Cartões de Equipe" : "Cartões no Jogo",
    subtab === "equipe" ? equipeRows : totalRows,
    match,
  );

  return analysisModule("Número de cartões", "", "", `${summary}${table}`);
}

function renderEscanteiosTab(match, subtab) {
  const summary = summaryStatCards([
    { label: "Escanteios / Partida", value: Math.round(match.stats.corners).toString(), helper: `Média entre ${match.home} e ${match.away}`, featured: true },
    { label: match.home, value: "6 / Partida", helper: "Escanteios" },
    { label: match.away, value: "5 / Partida", helper: "Escanteios" },
  ]);
  const totalRows = [
    { label: "Mais de 6", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 7", home: "80%", away: "100%", avg: "90%", homeTone: 80, awayTone: 100, avgTone: 90 },
    { label: "Mais de 8", home: "60%", away: "100%", avg: "80%", homeTone: 60, awayTone: 100, avgTone: 80 },
    { label: "Mais de 9", home: "40%", away: "100%", avg: "70%", homeTone: 40, awayTone: 100, avgTone: 70 },
    { label: "Mais de 10", home: "40%", away: "100%", avg: "70%", homeTone: 40, awayTone: 100, avgTone: 70 },
    { label: "Mais de 11", home: "20%", away: "80%", avg: "50%", homeTone: 20, awayTone: 80, avgTone: 50 },
    { label: "Mais de 12", home: "20%", away: "40%", avg: "30%", homeTone: 20, awayTone: 40, avgTone: 30 },
    { label: "Mais de 13", home: "20%", away: "40%", avg: "30%", homeTone: 20, awayTone: 40, avgTone: 30 },
  ];
  const equipeRows = [
    { label: "Escanteios conquistados por partida", home: "6", away: "5", avg: "5,5", homeTone: 80, awayTone: 70, avgTone: 75 },
    { label: "Escanteios contra / Partida", home: "4.6", away: "8", avg: "6.3", homeTone: 55, awayTone: 90, avgTone: 75 },
    { label: "Mais de 2,5 cantos para", home: "100%", away: "80%", avg: "90%", homeTone: 100, awayTone: 80, avgTone: 90 },
    { label: "Mais de 3,5 cantos para", home: "80%", away: "60%", avg: "70%", homeTone: 80, awayTone: 60, avgTone: 70 },
    { label: "Mais de 4,5 cantos para", home: "40%", away: "60%", avg: "50%", homeTone: 40, awayTone: 60, avgTone: 50 },
    { label: "Mais de 2,5 escanteios contra", home: "100%", away: "100%", avg: "100%", homeTone: 100, awayTone: 100, avgTone: 100 },
    { label: "Mais de 3,5 escanteios contra", home: "80%", away: "100%", avg: "90%", homeTone: 80, awayTone: 100, avgTone: 90 },
    { label: "Mais de 4,5 escanteios contra", home: "40%", away: "100%", avg: "70%", homeTone: 40, awayTone: 100, avgTone: 70 },
  ];
  const tempoRows = [
    { section: "Primeiro tempo" },
    { label: "Média FH", home: "4.6", away: "5,75", avg: "5.18", homeTone: 60, awayTone: 70, avgTone: 65 },
    { label: "FH acima de 4", home: "60%", away: "75%", avg: "68%", homeTone: 60, awayTone: 75, avgTone: 68 },
    { label: "FH Mais de 5", home: "20%", away: "75%", avg: "48%", homeTone: 20, awayTone: 75, avgTone: 48 },
    { label: "FH acima de 6", home: "20%", away: "25%", avg: "23%", homeTone: 20, awayTone: 25, avgTone: 23 },
    { section: "Segundo tempo" },
    { label: "Média de 2 horas", home: "6", away: "6,5", avg: "6,25", homeTone: 80, awayTone: 80, avgTone: 80 },
    { label: "2 horas em 4", home: "40%", away: "75%", avg: "58%", homeTone: 40, awayTone: 75, avgTone: 58 },
    { label: "2 horas acima de 5", home: "40%", away: "75%", avg: "58%", homeTone: 40, awayTone: 75, avgTone: 58 },
    { label: "2 horas acima de 6", home: "40%", away: "50%", avg: "45%", homeTone: 40, awayTone: 50, avgTone: 45 },
  ];
  const rows = subtab === "equipe" ? equipeRows : subtab === "tempos" ? tempoRows : totalRows;
  const label = subtab === "equipe" ? "Cantos da equipe" : subtab === "tempos" ? "Primeiro/Segundo Tempo" : "Escanteios da partida";
  const table = renderStatsTable(`Total de escanteios da partida entre ${match.home} e ${match.away}. A média da liga é usada como referência.`, label, rows, match);

  return analysisModule("Número de escanteios", "Quantos escanteios haverá?", "", `${summary}${table}`);
}

function renderFinalizacoesTab(match, subtab) {
  const equipeRows = [
    { label: "Chutes / Partida", home: "12,60", away: "10.40", avg: "12:00", homeTone: 85, awayTone: 70, avgTone: 80 },
    { label: "Taxa de conversão de chutes", home: "5%", away: "8%", avg: "7%", homeTone: 45, awayTone: 55, avgTone: 50 },
    { label: "Tiros no alvo / M", home: "3,80", away: "2,40", avg: "3,00", homeTone: 60, awayTone: 30, avgTone: 45 },
    { label: "Tiros fora do alvo / M", home: "8,80", away: "8,00", avg: "8,00", homeTone: 85, awayTone: 80, avgTone: 80 },
    { label: "Chutes por gol marcado", home: "21:00", away: "13:00", avg: "17", homeTone: 80, awayTone: 80, avgTone: 80 },
    { label: "Chutes da equipe acima de 10,5", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "Chutes por equipe acima de 11,5", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "Chutes por equipe acima de 12,5", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "Chutes por equipe acima de 13,5", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "Chutes por equipe acima de 14,5", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "Chutes da equipe acima de 15,5", home: "60%", away: "20%", avg: "40%", homeTone: 60, awayTone: 20, avgTone: 40 },
    { label: "A equipe tem um índice de acerto de 3,5 ou mais chutes a gol.", home: "60%", away: "40%", avg: "50%", homeTone: 60, awayTone: 40, avgTone: 50 },
    { label: "A equipe tem um índice de acerto de 4,5 ou mais chutes a gol.", home: "40%", away: "0%", avg: "20%", homeTone: 40, awayTone: 0, avgTone: 20 },
    { label: "A equipe acerta 5,5 ou mais chutes a gol.", home: "20%", away: "0%", avg: "10%", homeTone: 20, awayTone: 0, avgTone: 10 },
    { label: "A equipe tem um índice de acerto de 6,5 ou mais chutes a gol.", home: "0%", away: "0%", avg: "0%", homeTone: 0, awayTone: 0, avgTone: 0 },
  ];
  const matchRows = [
    { label: "Match Shots Acima de 23,5", home: "80%", away: "80%", avg: "80%", homeTone: 80, awayTone: 80, avgTone: 80 },
    { label: "Match Shots Acima de 24,5", home: "80%", away: "80%", avg: "80%", homeTone: 80, awayTone: 80, avgTone: 80 },
    { label: "Match Shots Acima de 25,5", home: "60%", away: "80%", avg: "70%", homeTone: 60, awayTone: 80, avgTone: 70 },
    { label: "Match Shots Acima de 26,5", home: "40%", away: "60%", avg: "50%", homeTone: 40, awayTone: 60, avgTone: 50 },
    { label: "Match Shots On Target Over 7.5", home: "60%", away: "60%", avg: "60%", homeTone: 60, awayTone: 60, avgTone: 60 },
    { label: "Match Shots On Target Over 8.5", home: "60%", away: "60%", avg: "60%", homeTone: 60, awayTone: 60, avgTone: 60 },
    { label: "Disparos no alvo acima de 9,5", home: "40%", away: "40%", avg: "29%", homeTone: 40, awayTone: 40, avgTone: 29 },
  ];
  const rows = subtab === "match" ? matchRows : equipeRows;
  const first = subtab === "match" ? "Match Shots" : "Finalizações da equipe";
  return analysisModule("Finalizações", "Chutes, tiros no alvo e volume ofensivo", "", renderStatsTable("", first, rows, match));
}

function playerBar(name, value, max, side = "home") {
  const width = Math.max(8, Math.round((Number(value) / max) * 100));
  return `
    <li class="player-bar ${side}">
      <span style="width: ${width}%"></span>
      <strong>${name}</strong>
      <em>${value}</em>
    </li>
  `;
}

function playerCard(title, players, side, footer) {
  const max = Math.max(...players.map((player) => Number(player.value)));
  return `
    <article class="player-card">
      <header>
        <span class="analysis-crest small">${side === "home" ? "AM" : "AGO"}</span>
        <h4>${title}</h4>
      </header>
      <ul class="player-list">
        ${players.map((player) => playerBar(player.name, player.value, max, side)).join("")}
      </ul>
      <p>${footer}</p>
    </article>
  `;
}

function renderJogadoresTab(match, subtab) {
  const scorersHome = [
    { name: "Gonzalo Mathías Mastriani Borges", value: 3 },
    { name: "Emerson Raymundo Santos", value: 1 },
    { name: "Fernando Elizari", value: 1 },
    { name: "Nathan Raphael Pelae Cardoso", value: 1 },
    { name: "Jhonny Cardinoti Pedro", value: 1 },
    { name: "Luís Gustavo de Almeida Pinto", value: 1 },
  ];
  const scorersAway = [
    { name: "Gustavo Coutinho Silva Lopes", value: 3 },
    { name: "Guilherme", value: 2 },
    { name: "Leonardo Gomes da Silva Jacó", value: 2 },
    { name: "Ewerton Diógenes Da Silva", value: 1 },
    { name: "Guilherme Lopes da Silva", value: 1 },
    { name: "Marrony da Silva Liberato", value: 1 },
  ];
  const cardsHome = [
    { name: "Rafael Raúl Barcelos", value: 5 },
    { name: "Nathan Raphael Pelae Cardoso", value: 3 },
    { name: "Emerson Raymundo Santos", value: 2 },
    { name: "Luís Gustavo de Almeida Pinto", value: 2 },
    { name: "Thauan Willians Jesus Silva", value: 2 },
    { name: "Matías Emanuel Segovia Torales", value: 2 },
  ];
  const cardsAway = [
    { name: "Guilherme Lopes da Silva", value: 4 },
    { name: "Cristiano Claudinei Nogueira", value: 4 },
    { name: "Gustavo Coutinho Silva Lopes", value: 2 },
    { name: "Leonardo Gomes da Silva Jacó", value: 2 },
    { name: "Marrony da Silva Liberato", value: 2 },
    { name: "Paulo Vitor Fagundes dos Anjos", value: 2 },
  ];
  const cards90Home = [
    { name: "Jhonatan Júnior Jesus de Lima", value: 0.66 },
    { name: "Rafael Raul Barcelos", value: 0.56 },
    { name: "Otávio Gonçalves de Oliveira", value: 0.52 },
    { name: "Emerson Raymundo Santos", value: 0.42 },
    { name: "Leandro Santos do Nascimento", value: 0.37 },
    { name: "Thauan Willians Jesus Silva", value: 0.35 },
  ];
  const cards90Away = [
    { name: "Felipe Guimarães da Silva", value: 3.33 },
    { name: "Ariel Felipe Gomes da Rosa", value: 1.1 },
    { name: "Bruno José de Souza", value: 0.8 },
    { name: "Nata Felipe de Amorim Santos", value: 0.74 },
    { name: "Leonardo Gomes da Silva Jacó", value: 0.57 },
    { name: "Cristiano Claudinei Nogueira", value: 0.43 },
  ];
  const footer = `Estatísticas da temporada de 2026 da ${match.league}`;
  let title = "Quais jogadores marcarão gols?";
  let content = `
    <div class="players-grid">
      ${playerCard(`Artilheiros - ${match.home}`, scorersHome, "home", footer)}
      ${playerCard(`Artilheiros - ${match.away}`, scorersAway, "away", footer)}
    </div>
  `;

  if (subtab === "cartoes") {
    title = "Quem pode receber cartão?";
    content = `
      <div class="players-grid">
        ${playerCard(`Cartões dados - ${match.home}`, cardsHome, "home", footer)}
        ${playerCard(`Cartões entregues - ${match.away}`, cardsAway, "away", footer)}
      </div>
    `;
  }

  if (subtab === "cartoes90") {
    title = "Cartões por 90 minutos";
    content = `
      <div class="players-grid">
        ${playerCard(`Cartões / 90 - ${match.home}`, cards90Home, "home", footer)}
        ${playerCard(`Cartões / 90 - ${match.away}`, cards90Away, "away", footer)}
      </div>
    `;
  }

  return analysisModule(title, "", "", content);
}

function metricText(value, decimals = 1) {
  const number = validMetric(value);
  if (number === null) return "—";
  return number.toFixed(decimals).replace(".", ",");
}

function percentText(value) {
  const number = validMetric(value);
  return number === null ? "—" : `${clamp(number, 0, 100)}%`;
}

function averagePercent(...values) {
  return averageValues(values.map(validMetric));
}

function apiProbability(match, potentialPaths, oddPaths, fallback = null) {
  const potential = validMetric(detailField(match, potentialPaths));
  if (potential !== null && potential <= 100) return clamp(potential, 0, 100);

  const odd = validMetric(detailField(match, oddPaths));
  if (odd && odd > 1) return clamp(100 / odd, 0, 100);
  return fallback;
}

function probabilityRow(label, home, away, average) {
  const finalAverage = validMetric(average) ?? averagePercent(home, away);
  return {
    label,
    home: percentText(home),
    away: percentText(away),
    avg: percentText(finalAverage),
    homeTone: validMetric(home) ?? 0,
    awayTone: validMetric(away) ?? 0,
    avgTone: validMetric(finalAverage) ?? 0,
  };
}

function historyProbability(history, key, line, direction = "over") {
  if (!history?.count) return null;
  return direction === "under" ? history.under(key, line) : history.over(key, line);
}

function realDataNotice(match) {
  const availability = match.detail?.availability;
  if (!match.detail) return "Dados iniciais da partida recebidos da FootyStats.";
  const sources = [
    "detalhes da partida",
    availability?.homeLast && availability?.awayLast ? "últimos 5 jogos" : null,
    availability?.players ? "jogadores da liga" : null,
  ].filter(Boolean);
  return `Fonte: FootyStats • ${sources.join(" • ")}`;
}

function renderGolsTab(match, subtab) {
  const histories = matchHistories(match);
  const totalXg = validMetric(detailField(match, ["total_xg_prematch"]));
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5];
  const potentialFields = {
    0.5: ["o05_potential", "over05"],
    1.5: ["o15_potential", "over15"],
    2.5: ["o25_potential", "over25"],
    3.5: ["o35_potential", "over35"],
    4.5: ["o45_potential", "over45"],
  };
  const oddFields = {
    0.5: ["odds_ft_over05"],
    1.5: ["odds_ft_over15"],
    2.5: ["odds_ft_over25"],
    3.5: ["odds_ft_over35"],
    4.5: ["odds_ft_over45"],
  };
  const overRows = lines.map((line) => {
    const home = historyProbability(histories.home, "totalGoals", line);
    const away = historyProbability(histories.away, "totalGoals", line);
    const fallback =
      totalXg !== null ? projectedConfidence(totalXg, line, "over") : null;
    const average = apiProbability(
      match,
      potentialFields[line],
      oddFields[line],
      averagePercent(home, away) ?? fallback,
    );
    return probabilityRow(`Mais de ${String(line).replace(".", ",")}`, home, away, average);
  });
  const bttsHome = histories.home.btts;
  const bttsAway = histories.away.btts;
  const bttsAverage = apiProbability(
    match,
    ["btts_potential"],
    ["odds_btts_yes"],
    averagePercent(bttsHome, bttsAway),
  );
  overRows.push(probabilityRow("Ambas marcam", bttsHome, bttsAway, bttsAverage));

  const underRows = lines.map((line) => {
    const home = historyProbability(histories.home, "totalGoals", line, "under");
    const away = historyProbability(histories.away, "totalGoals", line, "under");
    const over = apiProbability(match, potentialFields[line], oddFields[line]);
    const average = averagePercent(home, away) ?? (over === null ? null : 100 - over);
    return probabilityRow(`Menos de ${String(line).replace(".", ",")}`, home, away, average);
  });
  const timeLines = [
    { section: "Gols do primeiro tempo" },
    probabilityRow(
      "Mais de 0,5 FH",
      historyProbability(histories.home, "htGoals", 0.5),
      historyProbability(histories.away, "htGoals", 0.5),
      apiProbability(match, ["o05HT_potential"], ["odds_1st_half_over05"]),
    ),
    probabilityRow(
      "Mais de 1,5 FH",
      historyProbability(histories.home, "htGoals", 1.5),
      historyProbability(histories.away, "htGoals", 1.5),
      apiProbability(match, ["o15HT_potential"], ["odds_1st_half_over15"]),
    ),
    { section: "Gols do segundo tempo" },
    probabilityRow(
      "Mais de 0,5 2H",
      historyProbability(histories.home, "secondHalfGoals", 0.5),
      historyProbability(histories.away, "secondHalfGoals", 0.5),
      apiProbability(match, ["o05_2H_potential"], ["odds_2nd_half_over05"]),
    ),
    probabilityRow(
      "Mais de 1,5 2H",
      historyProbability(histories.home, "secondHalfGoals", 1.5),
      historyProbability(histories.away, "secondHalfGoals", 1.5),
      apiProbability(match, ["o15_2H_potential"], ["odds_2nd_half_over15"]),
    ),
  ];
  const rows = subtab === "tempos" ? timeLines : subtab === "under" ? underRows : overRows;
  const label =
    subtab === "tempos" ? "1º/2º Tempo" : subtab === "under" ? "Gols (Menos)" : "Gols da partida";
  const summary = summaryStatCards([
    {
      label: "xG pré-jogo",
      value: metricText(totalXg, 2),
      helper: "Projeção total da API",
      featured: true,
    },
    {
      label: match.home,
      value: metricText(histories.home.avg("goalsFor"), 2),
      helper: "Gols marcados / últimos jogos",
    },
    {
      label: match.away,
      value: metricText(histories.away.avg("goalsFor"), 2),
      helper: "Gols marcados / últimos jogos",
    },
  ]);

  return analysisModule(
    "Previsões de gols e Ambas as Equipes Marcam",
    "Dados reais e forma recente",
    realDataNotice(match),
    `${summary}${renderStatsTable("", label, rows, match)}`,
  );
}

function renderCartoesTab(match, subtab) {
  const histories = matchHistories(match);
  const totalAverage = averageValues([
    histories.home.avg("totalCards"),
    histories.away.avg("totalCards"),
  ]);
  const homeAverage = histories.home.avg("cardsFor");
  const awayAverage = histories.away.avg("cardsFor");
  const potential = validMetric(detailField(match, ["cards_potential"]));
  const summary = summaryStatCards([
    {
      label: "Total de cartões por partida",
      value: metricText(totalAverage ?? match.stats.cards, 2),
      helper: "Média dos últimos jogos",
      featured: true,
    },
    { label: match.home, value: metricText(homeAverage, 2), helper: "Cartões / partida" },
    { label: match.away, value: metricText(awayAverage, 2), helper: "Cartões / partida" },
  ]);
  const totalRows = [2.5, 3.5, 4.5, 5.5, 6.5].map((line) =>
    probabilityRow(
      `Mais de ${String(line).replace(".", ",")}`,
      historyProbability(histories.home, "totalCards", line),
      historyProbability(histories.away, "totalCards", line),
      potential,
    ),
  );
  const teamRows = [
    {
      label: "Cartões por partida",
      home: metricText(homeAverage, 2),
      away: metricText(awayAverage, 2),
      avg: metricText(averageValues([homeAverage, awayAverage]), 2),
    },
    ...[0.5, 1.5, 2.5, 3.5].map((line) =>
      probabilityRow(
        `Mais de ${String(line).replace(".", ",")} por equipe`,
        historyProbability(histories.home, "cardsFor", line),
        historyProbability(histories.away, "cardsFor", line),
      ),
    ),
    { section: "Cartões do adversário" },
    ...[0.5, 1.5, 2.5, 3.5].map((line) =>
      probabilityRow(
        `Mais de ${String(line).replace(".", ",")} contra`,
        historyProbability(histories.home, "cardsAgainst", line),
        historyProbability(histories.away, "cardsAgainst", line),
      ),
    ),
  ];

  return analysisModule(
    "Número de cartões",
    "Histórico disciplinar real",
    realDataNotice(match),
    `${summary}${renderStatsTable("", subtab === "equipe" ? "Cartões de Equipe" : "Cartões no Jogo", subtab === "equipe" ? teamRows : totalRows, match)}`,
  );
}

function renderEscanteiosTab(match, subtab) {
  const histories = matchHistories(match);
  const totalAverage = averageValues([
    histories.home.avg("totalCorners"),
    histories.away.avg("totalCorners"),
  ]);
  const homeAverage = histories.home.avg("cornersFor");
  const awayAverage = histories.away.avg("cornersFor");
  const summary = summaryStatCards([
    {
      label: "Escanteios / Partida",
      value: metricText(totalAverage ?? match.stats.corners, 2),
      helper: "Média dos últimos jogos",
      featured: true,
    },
    { label: match.home, value: metricText(homeAverage, 2), helper: "A favor / partida" },
    { label: match.away, value: metricText(awayAverage, 2), helper: "A favor / partida" },
  ]);
  const potentialByLine = {
    8.5: ["corners_o85_potential"],
    9.5: ["corners_o95_potential"],
    10.5: ["corners_o105_potential"],
  };
  const totalRows = [6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5].map((line) =>
    probabilityRow(
      `Mais de ${String(line).replace(".", ",")}`,
      historyProbability(histories.home, "totalCorners", line),
      historyProbability(histories.away, "totalCorners", line),
      apiProbability(
        match,
        potentialByLine[line] || ["corners_potential"],
        [`odds_corners_over_${String(line).replace(".5", "5").replace(".", "")}`],
      ),
    ),
  );
  const teamRows = [
    {
      label: "Escanteios conquistados por partida",
      home: metricText(homeAverage, 2),
      away: metricText(awayAverage, 2),
      avg: metricText(averageValues([homeAverage, awayAverage]), 2),
    },
    {
      label: "Escanteios contra / partida",
      home: metricText(histories.home.avg("cornersAgainst"), 2),
      away: metricText(histories.away.avg("cornersAgainst"), 2),
      avg: metricText(
        averageValues([
          histories.home.avg("cornersAgainst"),
          histories.away.avg("cornersAgainst"),
        ]),
        2,
      ),
    },
    ...[2.5, 3.5, 4.5].map((line) =>
      probabilityRow(
        `Mais de ${String(line).replace(".", ",")} cantos para`,
        historyProbability(histories.home, "cornersFor", line),
        historyProbability(histories.away, "cornersFor", line),
      ),
    ),
  ];
  const timeRows = [
    { section: "Primeiro tempo" },
    {
      label: "Média FH",
      home: metricText(histories.home.avg("firstHalfCorners"), 2),
      away: metricText(histories.away.avg("firstHalfCorners"), 2),
      avg: metricText(
        averageValues([
          histories.home.avg("firstHalfCorners"),
          histories.away.avg("firstHalfCorners"),
        ]),
        2,
      ),
    },
    ...[3.5, 4.5, 5.5].map((line) =>
      probabilityRow(
        `FH acima de ${String(line).replace(".", ",")}`,
        historyProbability(histories.home, "firstHalfCorners", line),
        historyProbability(histories.away, "firstHalfCorners", line),
      ),
    ),
    { section: "Segundo tempo" },
    ...[3.5, 4.5, 5.5].map((line) =>
      probabilityRow(
        `2H acima de ${String(line).replace(".", ",")}`,
        historyProbability(histories.home, "secondHalfCorners", line),
        historyProbability(histories.away, "secondHalfCorners", line),
      ),
    ),
  ];
  const rows = subtab === "equipe" ? teamRows : subtab === "tempos" ? timeRows : totalRows;

  return analysisModule(
    "Número de escanteios",
    "Quantos escanteios haverá?",
    realDataNotice(match),
    `${summary}${renderStatsTable("", subtab === "equipe" ? "Escanteios da equipe" : subtab === "tempos" ? "Primeiro/Segundo Tempo" : "Escanteios da partida", rows, match)}`,
  );
}

function renderFinalizacoesTab(match, subtab) {
  const histories = matchHistories(match);
  const homeShots = histories.home.avg("shotsFor");
  const awayShots = histories.away.avg("shotsFor");
  const homeTarget = histories.home.avg("onTargetFor");
  const awayTarget = histories.away.avg("onTargetFor");
  const teamRows = [
    {
      label: "Chutes / Partida",
      home: metricText(homeShots, 2),
      away: metricText(awayShots, 2),
      avg: metricText(averageValues([homeShots, awayShots]), 2),
    },
    {
      label: "Tiros no alvo / Partida",
      home: metricText(homeTarget, 2),
      away: metricText(awayTarget, 2),
      avg: metricText(averageValues([homeTarget, awayTarget]), 2),
    },
    ...[10.5, 11.5, 12.5, 13.5, 14.5].map((line) =>
      probabilityRow(
        `Chutes da equipe acima de ${String(line).replace(".", ",")}`,
        historyProbability(histories.home, "shotsFor", line),
        historyProbability(histories.away, "shotsFor", line),
      ),
    ),
    ...[3.5, 4.5, 5.5].map((line) =>
      probabilityRow(
        `Chutes no alvo acima de ${String(line).replace(".", ",")}`,
        historyProbability(histories.home, "onTargetFor", line),
        historyProbability(histories.away, "onTargetFor", line),
      ),
    ),
  ];
  const matchRows = [
    ...[19.5, 21.5, 23.5, 25.5].map((line) =>
      probabilityRow(
        `Match Shots acima de ${String(line).replace(".", ",")}`,
        historyProbability(histories.home, "totalShots", line),
        historyProbability(histories.away, "totalShots", line),
      ),
    ),
    ...[6.5, 7.5, 8.5, 9.5].map((line) =>
      probabilityRow(
        `Chutes no alvo totais acima de ${String(line).replace(".", ",")}`,
        historyProbability(histories.home, "totalOnTarget", line),
        historyProbability(histories.away, "totalOnTarget", line),
      ),
    ),
  ];

  return analysisModule(
    "Finalizações",
    "Chutes e tiros no alvo",
    realDataNotice(match),
    renderStatsTable(
      "",
      subtab === "match" ? "Match Shots" : "Finalizações da equipe",
      subtab === "match" ? matchRows : teamRows,
      match,
    ),
  );
}

function realPlayerCard(match, title, players, side, footer) {
  const team = side === "home" ? match.home : match.away;
  const logo = side === "home" ? match.homeLogo : match.awayLogo;
  const safeLogo = safeImageUrl(logo);

  if (!players.length) {
    return `
      <article class="player-card">
        <header>
          ${teamMark(team, logo, "", "analysis-crest small")}
          <h4>${title}</h4>
        </header>
        <p>Dados de jogadores indisponíveis para esta liga.</p>
      </article>
    `;
  }

  const max = Math.max(...players.map((player) => Number(player.value) || 0), 1);
  return `
    <article class="player-card">
      <header>
        <span class="analysis-crest small${safeLogo ? " has-image" : ""}">
          ${safeLogo ? `<img src="${escapeHtml(safeLogo)}" alt="">` : teamCode(team)}
        </span>
        <h4>${title}</h4>
      </header>
      <ul class="player-list">
        ${players.map((player) => playerBar(escapeHtml(player.name), player.value, max, side)).join("")}
      </ul>
      <p>${footer}</p>
    </article>
  `;
}

function renderJogadoresTab(match, subtab) {
  const homePlayers = match.detail?.players?.home || [];
  const awayPlayers = match.detail?.players?.away || [];
  const valueField =
    subtab === "gols"
      ? "goals_overall"
      : subtab === "cartoes90"
        ? "cards_per_90_overall"
        : "cards_overall";
  const title =
    subtab === "gols"
      ? "Artilheiros"
      : subtab === "cartoes90"
        ? "Cartões por 90 minutos"
        : "Jogadores mais advertidos";
  const prepare = (players) =>
    players
      .map((player) => ({
        name: player.full_name || player.known_as || `${player.first_name || ""} ${player.last_name || ""}`.trim(),
        value: validMetric(player[valueField]) ?? 0,
      }))
      .filter((player) => player.name && player.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  const footer = `Estatísticas reais da temporada • ${match.league}`;

  return analysisModule(
    title,
    "",
    realDataNotice(match),
    `
      <div class="players-grid">
        ${realPlayerCard(match, `${title} - ${match.home}`, prepare(homePlayers), "home", footer)}
        ${realPlayerCard(match, `${title} - ${match.away}`, prepare(awayPlayers), "away", footer)}
      </div>
    `,
  );
}

function renderCasaForaTab(match, subtab) {
  const raw = match.detail?.match || match.raw || {};
  const homePpg = validMetric(
    raw.pre_match_home_ppg ?? raw.pre_match_teamA_overall_ppg ?? raw.home_ppg,
  );
  const awayPpg = validMetric(
    raw.pre_match_away_ppg ?? raw.pre_match_teamB_overall_ppg ?? raw.away_ppg,
  );
  const homeXg = validMetric(raw.team_a_xg_prematch);
  const awayXg = validMetric(raw.team_b_xg_prematch);
  const homeOdd = validMetric(raw.odds_ft_1);
  const drawOdd = validMetric(raw.odds_ft_x);
  const awayOdd = validMetric(raw.odds_ft_2);
  const homeProbability = apiProbability(match, [], ["odds_ft_1"], match.stats.homeForm);
  const drawProbability = apiProbability(match, [], ["odds_ft_x"]);
  const awayProbability = apiProbability(match, [], ["odds_ft_2"], match.stats.awayForm);
  const marketRows = [
    marketLine(`${match.home} vence`, homeOdd, homeProbability || 0, homeOdd ? "Odd real" : "Sem odd real"),
    marketLine("Empate", drawOdd, drawProbability || 0, drawOdd ? "Odd real" : "Sem odd real"),
    marketLine(`${match.away} vence`, awayOdd, awayProbability || 0, awayOdd ? "Odd real" : "Sem odd real"),
  ].join("");
  const selected =
    subtab === "mandante"
      ? [
          analysisCard("PPG em casa", metricText(homePpg, 2), "Pontos por jogo"),
          analysisCard("xG pré-jogo", metricText(homeXg, 2)),
          analysisCard("Posição", match.detail?.teams?.home?.tablePosition ?? "—"),
          analysisCard("Odd vitória", homeOdd ? homeOdd.toFixed(2) : "—"),
        ]
      : subtab === "visitante"
        ? [
            analysisCard("PPG fora", metricText(awayPpg, 2), "Pontos por jogo"),
            analysisCard("xG pré-jogo", metricText(awayXg, 2)),
            analysisCard("Posição", match.detail?.teams?.away?.tablePosition ?? "—"),
            analysisCard("Odd vitória", awayOdd ? awayOdd.toFixed(2) : "—"),
          ]
        : [
            analysisCard(match.home, `${metricText(homePpg, 2)} PPG`, `xG ${metricText(homeXg, 2)}`),
            analysisCard("Empate", drawOdd ? `Odd ${drawOdd.toFixed(2)}` : "Odd indisponível"),
            analysisCard(match.away, `${metricText(awayPpg, 2)} PPG`, `xG ${metricText(awayXg, 2)}`),
          ];

  return `
    <div class="analysis-block">
      ${analysisHeading("Casa / Fora", "PPG, xG e odds reais")}
      <div class="analysis-grid">${selected.join("")}</div>
      <div class="market-lines">${marketRows}</div>
      <p class="analysis-note">${realDataNotice(match)}</p>
    </div>
  `;
}

function renderTeamIdentity(match, side) {
  const team = side === "home" ? match.home : match.away;
  const logo = side === "home" ? match.homeLogo : match.awayLogo;
  const label = side === "home" ? "Casa" : "Fora";
  const odd = validMetric(detailField(match, side === "home" ? ["odds_ft_1"] : ["odds_ft_2"]));
  const history = side === "home" ? matchHistories(match).home : matchHistories(match).away;
  const form = history.form.length ? history.form : formPattern(side === "home" ? match.stats.homeForm : match.stats.awayForm, side);

  return `
    <div class="analysis-team-card ${side}">
      ${teamMark(team, logo, "", "analysis-crest")}
      <div class="analysis-team-meta">
        <span>${label}</span>
        <strong>${escapeHtml(team)}</strong>
        <em>${odd && odd > 1 ? `Odd ${odd.toFixed(2)}` : "Odd indisponível"}</em>
      </div>
      <div class="form-strip" aria-label="Forma recente ${escapeHtml(team)}">
        ${form.slice(0, 5).map(formBadge).join("")}
      </div>
    </div>
  `;
}

function stadiumName(match) {
  return cleanText(
    match.stadium || detailField(match, ["stadium_name"]),
    "Estádio não informado",
  );
}

function renderFixtureAnalysis(match) {
  const histories = matchHistories(match);
  const raw = match.detail?.match || match.raw || {};
  const totalXg = validMetric(raw.total_xg_prematch);
  const btts = apiProbability(match, ["btts_potential"], ["odds_btts_yes"]);
  const homePpg = validMetric(raw.pre_match_home_ppg ?? raw.pre_match_teamA_overall_ppg);
  const awayPpg = validMetric(raw.pre_match_away_ppg ?? raw.pre_match_teamB_overall_ppg);

  return `
    <section class="fixture-analysis-card">
      ${analysisHeading("Fixture Analysis", `${match.country} / ${match.league}`)}
      <div class="fixture-copy">
        <p>Em ${matchDateLabel(match)}, <strong>${escapeHtml(match.home)}</strong> e <strong>${escapeHtml(match.away)}</strong> se enfrentam pela <strong>${escapeHtml(match.league)}</strong>.</p>
        <p>O PPG pré-jogo está em <strong>${metricText(homePpg, 2)}</strong> para o mandante e <strong>${metricText(awayPpg, 2)}</strong> para o visitante. O xG total pré-jogo é <strong>${metricText(totalXg, 2)}</strong>.</p>
        <p>A forma recente considera <strong>${histories.home.count}</strong> jogos de ${escapeHtml(match.home)} e <strong>${histories.away.count}</strong> jogos de ${escapeHtml(match.away)}. A leitura BTTS da API está em <strong>${percentText(btts)}</strong>.</p>
        <p>${realDataNotice(match)}. Mercados sem base suficiente permanecem sem sugestão.</p>
      </div>
    </section>
  `;
}

function trendRows(match, side) {
  const team = side === "home" ? match.home : match.away;
  const history = side === "home" ? matchHistories(match).home : matchHistories(match).away;
  const goals = history.avg("goalsFor");
  const conceded = history.avg("goalsAgainst");
  const corners = history.avg("totalCorners");
  const cards = history.avg("totalCards");

  if (!history.count) {
    return [{ type: "neutral", text: `Últimos jogos de ${team} não estão disponíveis nesta consulta.` }];
  }

  return [
    {
      type: history.points >= history.count * 1.6 ? "up" : "down",
      text: `${team} somou ${history.points} pontos nos últimos ${history.count} jogos.`,
    },
    {
      type: goals >= 1.5 ? "up" : "neutral",
      text: `Média recente de ${metricText(goals, 2)} gols marcados e ${metricText(conceded, 2)} sofridos.`,
    },
    {
      type: history.btts >= 60 ? "up" : "neutral",
      text: `Ambas marcaram em ${percentText(history.btts)} das partidas analisadas.`,
    },
    {
      type: corners >= 9 ? "up" : "neutral",
      text: `Os jogos recentes tiveram média de ${metricText(corners, 2)} escanteios.`,
    },
    {
      type: cards >= 4.5 ? "down" : "neutral",
      text: `Média disciplinar combinada de ${metricText(cards, 2)} cartões.`,
    },
  ];
}

function renderTrendColumn(match, side) {
  const team = side === "home" ? match.home : match.away;
  const logo = side === "home" ? match.homeLogo : match.awayLogo;
  return `
    <article class="trend-column">
      <header>
        ${teamMark(team, logo, "", "analysis-crest small")}
        <strong>${escapeHtml(team)}</strong>
      </header>
      <div class="trend-list">
        ${trendRows(match, side)
          .map(
            (row) => `
              <div class="trend-item ${row.type}">
                <span>${trendIcon(row.type)}</span>
                <p>${row.text}</p>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderAiStatsSummary(match) {
  const raw = match.detail?.match || match.raw || {};
  const totalXg = validMetric(raw.total_xg_prematch);
  const btts = apiProbability(match, ["btts_potential"], ["odds_btts_yes"]);
  const corners85 = apiProbability(
    match,
    ["corners_o85_potential", "corners_potential"],
    ["odds_corners_over_85"],
  );
  const over15 = apiProbability(
    match,
    ["o15_potential", "over15"],
    ["odds_ft_over15"],
    totalXg !== null ? projectedConfidence(totalXg, 1.5, "over") : null,
  );
  const mainPick =
    over15 !== null && over15 >= 70
      ? "Mais de 1,5 gols"
      : corners85 !== null && corners85 >= 70
        ? "Mais de 8,5 escanteios"
        : "Sem entrada forte";

  return `
    <section class="ai-summary-card">
      ${analysisHeading("GPT-5 AI Stats Summary", `${match.home} vs ${match.away}`)}
      <div class="ai-summary-copy">
        <p>A leitura usa os dados reais disponíveis da FootyStats. O xG total pré-jogo é <strong>${metricText(totalXg, 2)}</strong>, o BTTS aparece em <strong>${percentText(btts)}</strong> e a linha de mais de 8,5 escanteios em <strong>${percentText(corners85)}</strong>.</p>
        <p>O mercado de mais de 1,5 gols apresenta leitura de <strong>${percentText(over15)}</strong>. Quando odds ou histórico não estão disponíveis, o JTIPS não classifica a seleção como aposta de valor.</p>
      </div>
      <div class="ai-pick-grid">
        ${analysisCard("Leitura principal", mainPick, mainPick === "Sem entrada forte" ? "Dados insuficientes" : "Maior consistência")}
        ${analysisCard("xG total", metricText(totalXg, 2), "Pré-jogo")}
        ${analysisCard("BTTS", percentText(btts), "Potencial da API")}
        ${analysisCard("Qualidade", match.detail?.availability?.homeLast && match.detail?.availability?.awayLast ? "Alta" : "Parcial", realDataNotice(match))}
      </div>
      <p class="ai-disclaimer">Análise estatística, sem garantia de resultado. Use gestão responsável.</p>
    </section>
  `;
}

function renderMatchHeader(match) {
  return `
    <div class="analysis-match-header">
      ${renderTeamIdentity(match, "home")}

      <div class="analysis-match-center compact">
        <span class="league-line">${match.country} / ${match.league}</span>
        <p>${matchDateLabel(match)} - ${match.time}</p>
        <small>Estádio - ${stadiumName(match)}</small>
      </div>

      ${renderTeamIdentity(match, "away")}
    </div>
  `;
}

function renderDetailContent(match) {
  const subtab = getActiveSubtab();

  switch (state.activeTab) {
    case "casa-fora":
      return renderCasaForaTab(match, subtab);
    case "gols":
      return renderGolsTab(match, subtab);
    case "cartoes":
      return renderCartoesTab(match, subtab);
    case "escanteios":
      return renderEscanteiosTab(match, subtab);
    case "finalizacoes":
      return renderFinalizacoesTab(match, subtab);
    case "jogadores":
      return renderJogadoresTab(match, subtab);
    default:
      return renderResumoTab(match, subtab);
  }
}

function renderDetail(match) {
  if (!match) {
    refs.matchCover.innerHTML = `
      <div class="analysis-empty-header">
        <p class="eyebrow">Sem partida</p>
        <h2>Nenhuma anÃ¡lise encontrada</h2>
      </div>
    `;
    refs.detailLeague.textContent = "Sem partida";
    refs.detailTitle.textContent = "Nenhuma análise encontrada";
    refs.detailTime.textContent = "--:--";
    refs.matchSubtabs.innerHTML = "";
    refs.detailBody.innerHTML = `<p class="empty-state">Ajuste os filtros para carregar uma partida.</p>`;
    return;
  }

  refs.detailLeague.textContent = `${match.country} • ${match.league}`;
  refs.matchCover.innerHTML = renderMatchHeader(match);
  refs.detailTitle.textContent = `${match.home} x ${match.away}`;
  refs.detailTime.textContent = match.time;
  renderTabNavigation(match);

  if (match.detailLoading) {
    refs.detailBody.innerHTML = `
      <div class="detail-loading">
        <span></span>
        <strong>Carregando estatísticas reais</strong>
        <p>Buscando partida, últimos jogos, times e jogadores na FootyStats.</p>
      </div>
    `;
    return;
  }

  if (match.detailError) {
    refs.detailBody.innerHTML = `
      <div class="detail-api-warning">
        <strong>Alguns detalhes não puderam ser carregados</strong>
        <p>As informações iniciais da partida continuam disponíveis. Tente atualizar novamente.</p>
      </div>
      ${renderDetailContent(match)}
    `;
    return;
  }

  refs.detailBody.innerHTML = renderDetailContent(match);
}

function render() {
  state.filtered = getFilteredMatches();

  if (!state.filtered.some((match) => match.id === state.selectedId)) {
    state.selectedId = state.filtered[0]?.id ?? null;
  }

  renderDateChips();
  renderBestOfDay();
  renderDailyAgenda();
  renderSummary(state.filtered);
  renderFixtures([...state.filtered]);
  renderDetail(matches.find((match) => match.id === state.selectedId));
}

function selectMatch(id) {
  state.currentAnalysisMatch = null;
  state.selectedId = id;
  render();
}

function resetFilters() {
  refs.dateFilter.value = today;
  refs.countryFilter.value = "todos";
  refs.leagueFilter.value = "todos";
  refs.teamFilter.value = "";
  refs.marketFilter.value = "todos";
  refs.oddFilter.value = "1.30";
  refs.confidenceFilter.value = "0";
  refs.confidenceValue.textContent = "0%";
  void refreshMatchesForDate();
}

function showDashboardView(view) {
  const meta = VIEW_META[view] ?? VIEW_META.melhores;
  const activeNavView = view === "analise" ? state.analysisSourceView : view;

  refs.appViews.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.viewPanel !== view);
  });

  refs.navLinks.forEach((link) => {
    const isActive = link.dataset.view === activeNavView;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  refs.topbarEyebrow.textContent = meta.eyebrow;
  refs.topbarTitle.textContent = meta.title;
}

function getCurrentAnalysisMatch() {
  return state.currentAnalysisMatch ?? matches.find((match) => match.id === state.selectedId);
}

function openDailyAnalysis(analysisId, sourceView = "jogos") {
  const match = DAILY_ANALYSIS_MATCHES[analysisId];

  if (!match) return;

  state.currentAnalysisMatch = match;
  state.analysisSourceView = sourceView;
  state.activeTab = "resumo";
  showDashboardView("analise");
  renderDetail(match);
}

function bootstrap() {
  refs.dateFilter.value = today;
  refreshFilterOptions({ preserve: false });
  setApiStatus("mock");

  [
    refs.countryFilter,
    refs.leagueFilter,
    refs.teamFilter,
    refs.marketFilter,
    refs.oddFilter,
    refs.confidenceFilter,
  ].forEach((input) => input.addEventListener("input", render));

  refs.dateFilter.addEventListener("change", () => {
    void refreshMatchesForDate();
  });

  refs.confidenceFilter.addEventListener("input", () => {
    refs.confidenceValue.textContent = `${refs.confidenceFilter.value}%`;
  });

  refs.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (link.dataset.view !== "analise") {
        state.currentAnalysisMatch = null;
      }
      showDashboardView(link.dataset.view);
    });
  });

  refs.analysisTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const sourcePanel = trigger.closest("[data-view-panel]");
      openDailyAnalysis(trigger.dataset.analysisId, sourcePanel?.dataset.viewPanel ?? "jogos");
    });
  });

  refs.dailyStatusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.dailyStatus = button.dataset.dailyStatus;
      renderDailyGames();
    });
  });

  refs.matchTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      renderDetail(getCurrentAnalysisMatch());
    });
  });

  refs.dateChips.forEach((button) => {
    button.addEventListener("click", () => {
      refs.dateFilter.value = shiftedDate(Number(button.dataset.dateShift));
      void refreshMatchesForDate();
    });
  });

  refs.clearFilters.addEventListener("click", resetFilters);
  refs.refreshButton.addEventListener("click", () => {
    void refreshMatchesForDate();
  });

  refs.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    refs.loginView.classList.add("is-hidden");
    refs.appShell.classList.remove("is-hidden");
    render();
  });

  refs.logoutButton.addEventListener("click", () => {
    refs.appShell.classList.add("is-hidden");
    refs.loginView.classList.remove("is-hidden");
  });

  render();
  void refreshMatchesForDate();
}

bootstrap();
