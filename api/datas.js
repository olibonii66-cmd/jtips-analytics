const API_BASE = 'https://api.futpythontrader.com/api/dados';

export default async function handler(req, res) {
  try {
    const token = process.env.FUTPYTHON_TOKEN;
    const fonte = String(req.query.fonte || 'footystats').toLowerCase();

    if (!token) {
      return res.status(500).json({ ok: false, error: 'FUTPYTHON_TOKEN não configurado na Vercel.' });
    }

    const response = await fetch(`${API_BASE}/jogos-do-dia/${fonte}/datas/`, {
      headers: { Authorization: `Token ${token}` },
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: text.slice(0, 500) });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    res.status(200).json({ ok: true, fonte, ...json });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Erro interno.' });
  }
}
