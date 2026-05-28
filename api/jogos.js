
const API_BASE = 'https://api.football-data-api.com';
const TZ = 'America/Sao_Paulo';
const cache = new Map();
const TTL = 1000 * 60 * 5;

function todaySP() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

async function fetchLeagueMap(key) {
  try {
    const url = new URL(`${API_BASE}/league-list`);
    url.searchParams.set('key', key);
    url.searchParams.set('chosen_leagues_only', 'true');
    const response = await fetch(url);
    const json = await response.json();
    const map = {};
    for (const league of json.data || []) {
      for (const season of league.season || []) {
        map[String(season.id)] = { name: league.name, country: season.country || league.country || '' };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const date = String(req.query.data || todaySP());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, error: 'Data inválida. Use YYYY-MM-DD.' });

    const cacheKey = `jogos:${date}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(cached.data);
    }

    const url = new URL(`${API_BASE}/todays-matches`);
    url.searchParams.set('key', key);
    url.searchParams.set('date', date);
    url.searchParams.set('timezone', TZ);

    const [response, leagueMap] = await Promise.all([fetch(url), fetchLeagueMap(key)]);
    const json = await response.json();

    if (!response.ok || !json.success) {
      return res.status(response.status || 500).json({ ok: false, error: json.message || 'Erro na API oficial FootyStats.', raw: json });
    }

    const dados = (json.data || []).map(row => {
      const league = leagueMap[String(row.competition_id)] || {};
      return { ...row, __league_name: league.name || '', __league_country: league.country || '' };
    });

    const columns = Array.from(new Set(dados.flatMap(row => Object.keys(row))));
    const payload = {
      ok: true,
      fonte: 'footystats_oficial',
      data: date,
      total: dados.length,
      count: dados.length,
      request_remaining: json.metadata?.request_remaining || null,
      columns,
      dados,
      pager: json.pager || null,
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
