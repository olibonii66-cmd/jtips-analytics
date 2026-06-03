export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY não configurada na Vercel."
    });
  }

  try {
    const date = req.query.date || "";
    const timezone = req.query.timezone || "America/Sao_Paulo";
    const page = req.query.page || "1";

    const params = new URLSearchParams({
      key: apiKey,
      timezone,
      page
    });

    if (date) {
      params.set("date", date);
    }

    const url = `https://api.football-data-api.com/todays-matches?${params.toString()}`;

    const response = await fetch(url);

    const data = await response.json().catch(function() {
      return null;
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "Erro ao buscar jogos na FootyStats.",
        status: response.status,
        data
      });
    }

    return res.status(200).json({
      ok: true,
      source: "footystats",
      endpoint: "todays-matches",
      date: date || "today",
      timezone,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar jogos.",
      detail: error.message
    });
  }
}
