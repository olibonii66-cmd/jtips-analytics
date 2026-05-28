const ALLOWED_LEAGUES = ['BRAZIL 1','ENGLAND 1','FRANCE 1','GERMANY 1','ITALY 1','PORTUGAL 1','SPAIN 1'];
const ALLOWED_SOURCES = ['footystats','bet365'];

export default async function handler(req, res) {
  res.status(200).json({ ok: true, fontes: ALLOWED_SOURCES, ligas: ALLOWED_LEAGUES });
}
