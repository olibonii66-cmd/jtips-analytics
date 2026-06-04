export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY nao configurada na Vercel."
    });
  }

  const matchId = String(req.query.match_id || req.query.matchId || req.query.id || "").trim();

  if (!matchId) {
    return res.status(400).json({
      ok: false,
      error: "Informe o match_id da partida."
    });
  }

  try {
    const url = buildUrl("https://api.football-data-api.com/match", {
      key: apiKey,
      match_id: matchId
    });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json"
      }
    });

    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: "A FootyStats retornou uma resposta invalida.",
        detail: error.message
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "Erro ao buscar detalhes da partida na FootyStats.",
        data: payload
      });
    }

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "match-details",
      input: {
        match_id: matchId
      },
      data: payload?.data || payload?.match || payload
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar detalhes da partida.",
      detail: error.message
    });
  }
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
