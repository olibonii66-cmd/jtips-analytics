
const API_BASE = 'https://api.futpythontrader.com/api/dados';
const ALLOWED_LEAGUES = ['BRAZIL 1','ENGLAND 1','FRANCE 1','GERMANY 1','ITALY 1','PORTUGAL 1','SPAIN 1'];
const SOURCE = 'footystats';

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && insideQuotes && next === '"') { value += '"'; i++; continue; }
    if (char === '"') { insideQuotes = !insideQuotes; continue; }
    if (char === ',' && !insideQuotes) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += char;
  }
  if (value.length || row.length) {
    row.push(value);
    if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return { columns: [], rows: [] };
  const columns = rows[0].map(h => h.trim());
  const data = rows.slice(1).map(cells => {
    const obj = {};
    columns.forEach((h, index) => { obj[h] = cells[index] !== undefined ? String(cells[index]).trim() : ''; });
    return obj;
  });
  return { columns, rows: data };
}

async function fetchLeague({ data, league, token }) {
  const url = new URL(`${API_BASE}/${SOURCE}/download/`);
  url.searchParams.set('date', data);
  url.searchParams.set('league', league);
  const response = await fetch(url, { headers: { Authorization: `Token ${token}` } });
  const text = await response.text();
  if (!response.ok) return { ok: false, league, status: response.status, error: text.slice(0, 500), rows: [], columns: [] };
  const parsed = parseCSV(text);
  return { ok: true, league, status: response.status, rows: parsed.rows, columns: parsed.columns };
}

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    const token = process.env.FUTPYTHON_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: 'FUTPYTHON_TOKEN não configurado na Vercel.' });
    const data = String(req.query.data || '');
    const leagueParam = String(req.query.league || 'all');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ ok: false, error: 'Data inválida. Use YYYY-MM-DD.' });
    const leagues = leagueParam === 'all' ? ALLOWED_LEAGUES : leagueParam.split(',').map(x => x.trim()).filter(Boolean);
    const invalid = leagues.filter(l => !ALLOWED_LEAGUES.includes(l));
    if (invalid.length) return res.status(403).json({ ok: false, error: 'Uma ou mais ligas não estão liberadas.', ligas_invalidas: invalid, ligas_liberadas: ALLOWED_LEAGUES });
    const results = await Promise.all(leagues.map(league => fetchLeague({ data, league, token })));
    const rows = results.flatMap(r => r.rows.map(row => ({ ...row, __league_requested: r.league })));
    const columns = Array.from(new Set(results.flatMap(r => r.columns)));
    const errors = results.filter(r => !r.ok).map(r => `${r.league}: ${r.status} - ${r.error}`);
    return res.status(200).json({ ok: true, fonte: SOURCE, data, league: leagueParam, ligas_liberadas: ALLOWED_LEAGUES, ligas_consultadas: leagues, ligas_com_dados: results.filter(r => r.rows.length > 0).map(r => r.league), total: rows.length, count: rows.length, columns, dados: rows, erros: errors });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
