
const API_BASE = 'https://api.football-data-api.com';

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTYSTATS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'FOOTYSTATS_API_KEY não configurada na Vercel.' });

    const url = new URL(`${API_BASE}/league-list`);
    url.searchParams.set('key', key);
    url.searchParams.set('chosen_leagues_only', 'true');

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok || !json.success) {
      return res.status(response.status || 500).json({ ok: false, error: json.message || 'Erro ao consultar ligas.', raw: json });
    }

    return res.status(200).json({
      ok: true,
      fonte: 'footystats_oficial',
      total: json.pager?.total_results || (json.data || []).length,
      request_remaining: json.metadata?.request_remaining || null,
      ligas: json.data || [],
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
