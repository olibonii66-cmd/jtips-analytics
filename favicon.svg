const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";

const ALLOWED_ENDPOINTS = new Set([
  "league-list",
  "league-tables",
  "todays-matches",
  "league-matches",
  "league-teams",
  "league-players",
  "team",
  "player-stats",
  "match"
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
      error: "A variável FOOTYSTATS_API_KEY não está configurada no Vercel."
    });
  }

  const endpoint = normalizeEndpoint(request.query.endpoint);
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return response.status(400).json({
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

  try {
    const footyStatsResponse = await fetch(footyStatsUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const contentType = footyStatsResponse.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await footyStatsResponse.json()
      : { error: await footyStatsResponse.text() };

    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return response.status(footyStatsResponse.status).json(payload);
  } catch (error) {
    console.error("Erro no proxy FootyStats:", error);
    return response.status(502).json({
      error: "Não foi possível conectar à FootyStats."
    });
  }
};

function normalizeEndpoint(value) {
  const endpoint = Array.isArray(value) ? value[0] : value;
  return String(endpoint || "").replace(/^\/+|\/+$/g, "");
}
