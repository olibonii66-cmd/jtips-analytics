
import { checkRateLimit, getClientIp } from './_helpers.js';

const API_BASE = 'https://api.football-data-api.com';
const TZ = 'America/Sao_Paulo';
const cache = new Map();
const TTL = 1000 * 60;

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

async function fetchMatchesPage(key, date, page = 1) {
  const url = new URL(`${API_BASE}/todays-matches`);
  url.searchParams.set('key', key);
  url.searchParams.set('date', date);
  url.searchParams.set('timezone', TZ);
  url.searchParams.set('page', String(page));
  const response = await fetch(url);
  const json = await response.json();
  return { response, json };
}

export default async function handler(req, res) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' });
    }

    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'Chave de dados não configurada na Vercel.' });

    const date = String(req.query.data || todaySP());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, error: 'Data inválida. Use YYYY-MM-DD.' });

    const cacheKey = `jogos:${date}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json(cached.data);
    }

    const leagueMapPromise = fetchLeagueMap(key);
    const first = await fetchMatchesPage(key, date, 1);
    const { response, json } = first;

    if (!response.ok || !json.success) {
      return res.status(response.status || 500).json({ ok: false, error: json.message || 'Não foi possível carregar os jogos.', raw: json });
    }

    const maxPage = Math.max(1, Number(json.pager?.max_page || 1));
    const pages = [json];
    if (maxPage > 1) {
      const others = await Promise.all(
        Array.from({ length: maxPage - 1 }, (_, i) => fetchMatchesPage(key, date, i + 2))
      );
      for (const item of others) {
        if (item.response.ok && item.json?.success) pages.push(item.json);
      }
    }

    const leagueMap = await leagueMapPromise;
    const rawRows = pages.flatMap(p => p.data || []);
    const dados = rawRows.map(row => {
      const league = leagueMap[String(row.competition_id)] || {};
      return { ...row, __league_name: league.name || '', __league_country: league.country || '' };
    });

    const columns = Array.from(new Set(dados.flatMap(row => Object.keys(row))));
    const ligasNoDia = Array.from(new Set(dados.map(r => r.__league_name || r.competition_name || r.competition_id).filter(Boolean))).sort();
    const payload = {
      ok: true,
      data: date,
      total: dados.length,
      count: dados.length,
      request_remaining: json.metadata?.request_remaining || null,
      columns,
      dados,
      ligas_no_dia: ligasNoDia,
      pager: {
        current_page: 1,
        max_page: maxPage,
        total_results: dados.length,
        pages_loaded: pages.length
      }
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
