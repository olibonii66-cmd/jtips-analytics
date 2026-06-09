function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}

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

function leagueLookup(payload) {
  const lookup = new Map();

  extractList(payload).forEach((league) => {
    const seasons = Array.isArray(league.season)
      ? league.season
      : Array.isArray(league.seasons)
        ? league.seasons
        : [league.season || league.current_season].filter(Boolean);

    seasons.forEach((season) => {
      const id = season?.id ?? season?.season_id ?? league.id;
      if (!id) return;

      lookup.set(String(id), {
        name: league.league_name || league.name || `Competição ${id}`,
        country: league.country || league.country_name || "Internacional",
      });
    });
  });

  return lookup;
}

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
    : brazilDateIso();

  const matchesUrl = new URL("https://api.football-data-api.com/todays-matches");
  matchesUrl.searchParams.set("key", apiKey);
  matchesUrl.searchParams.set("date", date);
  matchesUrl.searchParams.set("timezone", "America/Sao_Paulo");

  const leaguesUrl = new URL("https://api.football-data-api.com/league-list");
  leaguesUrl.searchParams.set("key", apiKey);
  leaguesUrl.searchParams.set("chosen_leagues_only", "true");

  try {
    const [matchesResponse, leaguesResponse] = await Promise.all([
      fetch(matchesUrl),
      fetch(leaguesUrl),
    ]);
    const matchesPayload = await matchesResponse.json();
    const leaguesPayload = leaguesResponse.ok ? await leaguesResponse.json() : null;

    if (!matchesResponse.ok) {
      return res.status(matchesResponse.status).json({
        error: "Erro ao consultar a FootyStats",
        details: matchesPayload,
      });
    }

    const leagues = leagueLookup(leaguesPayload);
    const data = extractList(matchesPayload).map((match) => {
      const league = leagues.get(String(match.competition_id));
      return {
        ...match,
        competition_name:
          match.competition_name ||
          league?.name ||
          `Competição ${match.competition_id}`,
        country: match.country || league?.country || "Internacional",
      };
    });

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600",
    );

    return res.status(200).json({
      ...matchesPayload,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Não foi possível consultar a FootyStats",
    });
  }
};
