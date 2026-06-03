export default async function handler(req, res) {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "FOOTYSTATS_API_KEY não configurada na Vercel."
    });
  }

  try {
    const leagueId = req.query.league_id || "1625";
    const seasonId = req.query.season_id || "2018";

    const url = `https://api.football-data-api.com/league-matches?key=${apiKey}&league_id=${leagueId}&season_id=${seasonId}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "Erro ao buscar jogos na API externa.",
        status: response.status
      });
    }

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      source: "football-data-api",
      data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao buscar jogos.",
      detail: error.message
    });
  }
}
