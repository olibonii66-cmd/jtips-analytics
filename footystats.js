// api/footystats.js
// Proxy serverless — lê FOOTYSTATS_API_KEY do ambiente Vercel
// Frontend chama: /api/footystats?endpoint=league-list&...
// Esta função repassa para https://api.football-data-api.com/<endpoint>&key=...

const API_BASE = 'https://api.football-data-api.com';

export default async function handler(req, res) {
  // CORS para o próprio domínio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = process.env.FOOTYSTATS_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'FOOTYSTATS_API_KEY não configurada no Vercel.' });
  }

  // Pega o endpoint e demais query params enviados pelo frontend
  const { endpoint, ...params } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Parâmetro "endpoint" é obrigatório.' });
  }

  // Monta a URL final com a chave injetada pelo servidor
  const qs = new URLSearchParams({ ...params, key }).toString();
  const url = `${API_BASE}/${endpoint}?${qs}`;

  try {
    const apiRes = await fetch(url);
    const data = await apiRes.json();

    // Repassa o status code original da API
    res.status(apiRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Erro ao conectar com a API Footystats.', detail: err.message });
  }
}
