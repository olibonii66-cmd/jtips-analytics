const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";

function buildUpstreamUrl(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const endpoint = (url.searchParams.get("endpoint") || "todays-matches").replace(/^\/+/, "");
  const upstream = new URL(`${FOOTYSTATS_BASE_URL}/${endpoint}`);

  upstream.searchParams.set("key", process.env.FOOTYSTATS_API_KEY || "");

  for (const [key, value] of url.searchParams.entries()) {
    if (!["endpoint", "key"].includes(key)) upstream.searchParams.set(key, value);
  }

  if (!upstream.searchParams.has("timezone")) {
    upstream.searchParams.set("timezone", "America/Sao_Paulo");
  }

  return upstream;
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.FOOTYSTATS_API_KEY) {
    response.status(500).json({
      error: "FOOTYSTATS_API_KEY não configurada no Vercel",
    });
    return;
  }

  try {
    const upstreamUrl = buildUpstreamUrl(request.url);
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      headers: { accept: "application/json" },
    });

    const contentType = upstreamResponse.headers.get("content-type") || "application/json";
    const body = await upstreamResponse.text();

    response.status(upstreamResponse.status);
    response.setHeader("Content-Type", contentType);
    response.send(body);
  } catch (error) {
    response.status(500).json({
      error: "Erro ao consultar FootyStats",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
