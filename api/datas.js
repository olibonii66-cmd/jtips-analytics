
function todaySPDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}
function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export default async function handler(req, res) {
  const today = todaySPDate();
  const datas = [];
  for (let i = -30; i <= 30; i++) datas.push(addDays(today, i));
  res.status(200).json({ ok: true, today, datas_disponiveis: datas.reverse() });
}
