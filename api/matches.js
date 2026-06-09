module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const apiKey = process.env.FOOTYSTATS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "FOOTYSTATS_API_KEY não configurada",
    });
  }

  const requestedDate = Array.isArray(req.query.date)
    ? req.query.date[0]
    : req.query.date;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "")
    ? requestedDate
    : new Date().toISOString().slice(0, 10);

  const url = new URL(
    "https://api.football-data-api.com/todays-matches"
  );

  url.searchParams.set("key", apiKey);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", "America/Sao_Paulo");

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erro ao consultar a FootyStats",
        details: data,
      });
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Não foi possível consultar a FootyStats",
    });
  }
};
