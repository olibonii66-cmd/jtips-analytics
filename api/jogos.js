const API_BASE = 'https://api.football-data-api.com';
const TZ = 'America/Sao_Paulo';
const cache = new Map();
const TTL = 1000 * 60;

function todaySP() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function brDateToIso(d) {
  if (!d) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return d;
}

function isoToDMY(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}-${m}-${y}`;
}

function rowDateSP(row) {
  const unix = Number(row?.date_unix);
  if (Number.isFinite(unix) && unix > 0) {
    return new Date(unix * 1000).toLocaleDateString('sv-SE', { timeZone: TZ });
  }
  const raw = row?.date_GMT || row?.date || row?.kickoff || row?.time;
  if (raw) {
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString('sv-SE', { timeZone: TZ });
  }
  return null;
}

async function apiFetch(endpoint, params, key) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set('key', key);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));
  return { response, json, url: url.toString().replace(key, '***') };
}

async function fetchLeagueList(key) {
  const { json } = await apiFetch('league-list', { chosen_leagues_only: 'true' }, key);
  const map = {};
  const seasons = [];
  for (const league of json.data || []) {
    for (const season of league.season || []) {
      const id = season.id;
      if (!id) continue;
      map[String(id)] = { name: league.name, country: season.country || league.country || '' };
      seasons.push({
        id,
        year: String(season.year || season.season || ''),
        league_name: league.name,
        country: season.country || league.country || ''
      });
    }
  }
  return { map, seasons };
}

async function fetchTodaysMatches(key, date) {
  const attempts = [
    { date, timezone: TZ },
    { date },
    { date: isoToDMY(date), timezone: TZ },
    { date: isoToDMY(date) }
  ];

  const pages = [];
  const diagnostics = [];

  for (const params of attempts) {
    const first = await apiFetch('todays-matches', { ...params, page: 1 }, key);
    diagnostics.push({ endpoint: 'todays-matches', params, ok: first.response.ok, success: first.json?.success, total: first.json?.pager?.total_results ?? (first.json?.data || []).length });

    if (!first.response.ok || first.json?.success === false) continue;

    const maxPage = Math.max(1, Number(first.json?.pager?.max_page || 1));
    const localPages = [first.json];

    if (maxPage > 1) {
      const other = await Promise.all(
        Array.from({ length: maxPage - 1 }, (_, i) => apiFetch('todays-matches', { ...params, page: i + 2 }, key))
      );
      for (const item of other) {
        if (item.response.ok && item.json?.success !== false) localPages.push(item.json);
      }
    }

    const rows = localPages.flatMap(p => p.data || []);
    if (rows.length) {
      return { rows, request_remaining: first.json?.metadata?.request_remaining || null, diagnostics, source: 'todays-matches' };
    }

    pages.push(...localPages);
  }

  return { rows: [], request_remaining: pages[0]?.metadata?.request_remaining || null, diagnostics, source: 'todays-matches-empty' };
}

function candidateSeasonsForDate(seasons, date) {
  const y = Number(String(date).slice(0, 4));
  const list = seasons.filter(s => {
    const year = String(s.year || '');
    return year.includes(String(y)) || year.includes(String(y - 1)) || year.includes(String(y + 1));
  });
  return (list.length ? list : seasons).slice(0, 60);
}

async function fetchLeagueMatchesFallback(key, date, seasons) {
  const candidates = candidateSeasonsForDate(seasons, date);
  const rows = [];
  const diagnostics = [];
  const concurrency = 5;

  async function loadSeason(season) {
    const first = await apiFetch('league-matches', { season_id: season.id, page: 1, max_per_page: 1000 }, key);
    diagnostics.push({ endpoint: 'league-matches', season_id: season.id, league: season.league_name, ok: first.response.ok, success: first.json?.success, total: first.json?.pager?.total_results ?? (first.json?.data || []).length });

    if (!first.response.ok || first.json?.success === false) return [];

    const maxPage = Math.max(1, Number(first.json?.pager?.max_page || 1));
    const pages = [first.json];

    if (maxPage > 1 && maxPage <= 4) {
      const other = await Promise.all(
        Array.from({ length: maxPage - 1 }, (_, i) => apiFetch('league-matches', { season_id: season.id, page: i + 2, max_per_page: 1000 }, key))
      );
      for (const item of other) {
        if (item.response.ok && item.json?.success !== false) pages.push(item.json);
      }
    }

    return pages.flatMap(p => p.data || []).filter(r => rowDateSP(r) === date);
  }

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const result = await Promise.all(batch.map(loadSeason));
    rows.push(...result.flat());
    if (rows.length >= 1) {
      // continua mais um pouco para capturar outras ligas do mesmo bloco, mas evita custo excessivo
    }
  }

  return { rows, diagnostics, source: 'league-matches-fallback' };
}

function uniqueRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const id = String(row.id || `${row.homeID}-${row.awayID}-${row.date_unix || row.date_GMT || ''}`);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'Chave de dados não configurada na Vercel.' });

    const date = brDateToIso(String(req.query.data || todaySP()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: 'Data inválida. Use YYYY-MM-DD.' });
    }

    const cacheKey = `jogos:v12_4:${date}`;
    const cached = cache.get(cacheKey);
    if (!req.query.refresh && cached && Date.now() - cached.ts < TTL) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json(cached.data);
    }

    const { map: leagueMap, seasons } = await fetchLeagueList(key);

    let loaded = await fetchTodaysMatches(key, date);
    let rawRows = loaded.rows;

    if (!rawRows.length) {
      const fallback = await fetchLeagueMatchesFallback(key, date, seasons);
      rawRows = fallback.rows;
      loaded = {
        ...loaded,
        rows: rawRows,
        source: fallback.source,
        diagnostics: [...(loaded.diagnostics || []), ...(fallback.diagnostics || [])]
      };
    }

    const dados = uniqueRows(rawRows).map(row => {
      const league = leagueMap[String(row.competition_id)] || {};
      return { ...row, __league_name: league.name || row.competition_name || '', __league_country: league.country || row.country || '' };
    });

    const columns = Array.from(new Set(dados.flatMap(row => Object.keys(row))));
    const ligasNoDia = Array.from(new Set(dados.map(r => r.__league_name || r.competition_name || r.competition_id).filter(Boolean))).sort();

    const payload = {
      ok: true,
      data: date,
      total: dados.length,
      count: dados.length,
      request_remaining: loaded.request_remaining || null,
      source: loaded.source,
      columns,
      dados,
      ligas_no_dia: ligasNoDia,
      diagnostics: loaded.diagnostics?.slice(0, 120) || [],
      pager: {
        current_page: 1,
        max_page: 1,
        total_results: dados.length,
        pages_loaded: 1
      }
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
