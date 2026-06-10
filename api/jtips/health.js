const BASE_URL = process.env.FOOTYSTATS_BASE_URL || "https://api.football-data-api.com";

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
    response.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }

  if (!process.env.FOOTYSTATS_API_KEY) {
    response.status(500).json({
      ok: false,
      connected: false,
      error: "FOOTYSTATS_API_KEY_MISSING",
      message: "Configure FOOTYSTATS_API_KEY nas variáveis de ambiente do Vercel.",
    });
    return;
  }

  try {
    const url = new URL(`${BASE_URL}/league-teams`);
    url.searchParams.set("key", process.env.FOOTYSTATS_API_KEY);

    const upstream = await fetch(url.toString(), {
      headers: { accept: "application/json,text/plain,*/*" },
    });

    const raw = await upstream.text();
    const trimmed = raw.trim();
    const connected = upstream.ok && trimmed === "true";

    response.status(connected ? 200 : 502).json({
      ok: connected,
      connected,
      upstream_status: upstream.status,
      test_endpoint: "/league-teams?key=***",
      response_preview: trimmed.slice(0, 160),
      message: connected
        ? "FootyStats conectada com sucesso."
        : "A FootyStats respondeu, mas não retornou true para a chave.",
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      connected: false,
      error: "FOOTYSTATS_HEALTH_FAILED",
      message: "Não foi possível testar a conexão com a FootyStats.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
