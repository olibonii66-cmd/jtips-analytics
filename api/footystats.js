const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";
const REQUEST_TIMEOUT = 20000;

const ALLOWED_ENDPOINTS = new Set([
  "league-list",
  "league-tables",
  "todays-matches",
  "league-matches",
  "league-teams",
  "league-players",
  "team",
  "player-stats",
  "match",
  "lastx"
]);

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({
      error: "Método não permitido."
    });
  }

  const apiKey = process.env.FOOTYSTATS_API_KEY;
  if (!apiKey) {
    return response.status(500).json({
      code: "MISSING_ENV",
      error: "A variável FOOTYSTATS_API_KEY não está configurada no Vercel."
    });
  }

  const endpoint = normalizeEndpoint(request.query.endpoint);
  if (!endpoint) {
    return response.status(200).json({
      ok: true,
      service: "ScoutBet FootyStats proxy",
      apiKeyConfigured: true,
      usage: "/api/footystats?endpoint=todays-matches&date=YYYY-MM-DD&timezone=America/Sao_Paulo"
    });
  }

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return response.status(400).json({
      code: "INVALID_ENDPOINT",
      error: "Endpoint da FootyStats não permitido."
    });
  }

  const footyStatsUrl = new URL(`${FOOTYSTATS_BASE_URL}/${endpoint}`);
  footyStatsUrl.searchParams.set("key", apiKey);

  Object.entries(request.query).forEach(([key, value]) => {
    if (key === "endpoint" || key === "key" || value === undefined) return;

    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      footyStatsUrl.searchParams.append(key, String(item));
    });
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const footyStatsResponse = await fetch(footyStatsUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    const contentType = footyStatsResponse.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await footyStatsResponse.json()
      : { error: await footyStatsResponse.text() };

    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    response.setHeader("X-ScoutBet-Upstream-Status", String(footyStatsResponse.status));
    return response.status(footyStatsResponse.status).json(payload);
  } catch (error) {
    console.error("Erro no proxy FootyStats:", error);
    return response.status(502).json({
      code: error.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_CONNECTION",
      error: error.name === "AbortError"
        ? "A FootyStats demorou mais que o esperado para responder."
        : "Não foi possível conectar à FootyStats."
    });
  } finally {
    clearTimeout(timeout);
  }
};

function normalizeEndpoint(value) {
  const endpoint = Array.isArray(value) ? value[0] : value;
  return String(endpoint || "").replace(/^\/+|\/+$/g, "");
}
