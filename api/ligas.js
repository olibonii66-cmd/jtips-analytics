
const ALLOWED_LEAGUES = ['BRAZIL 1','ENGLAND 1','FRANCE 1','GERMANY 1','ITALY 1','PORTUGAL 1','SPAIN 1'];
export default async function handler(req, res) { res.status(200).json({ ok: true, fonte: 'footystats', ligas: ALLOWED_LEAGUES }); }
