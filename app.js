// =============================================
//  FOOTSTATS API CONFIG
// =============================================
const API_KEY = 'SUA_CHAVE_AQUI';
const API_BASE = 'https://api.footstats.com.br/v1'; // ajuste conforme doc da Footstats

// =============================================
//  STATE
// =============================================
const state = {
  activeSection: 'home',
  activeLeague: 'all',
  theme: 'dark',
  matches: [],
  standings: [],
  players: [],
  odds: [],
  h2h: null,
  tips: [],
};

// =============================================
//  MOCK DATA (fallback / demo)
// =============================================
const MOCK = {
  matches: [
    { id: 1, league: 'Brasileirão Série A', league_flag: '🇧🇷', home: 'Flamengo', home_badge: '🔴', away: 'Palmeiras', away_badge: '🟢', score_home: 2, score_away: 1, time: '72\'', status: 'live', odds: { home: 1.85, draw: 3.40, away: 4.20 } },
    { id: 2, league: 'Premier League', league_flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', home: 'Manchester City', home_badge: '🔵', away: 'Arsenal', away_badge: '🔴', score_home: 1, score_away: 1, time: '55\'', status: 'live', odds: { home: 1.60, draw: 3.80, away: 5.50 } },
    { id: 3, league: 'La Liga', league_flag: '🇪🇸', home: 'Real Madrid', home_badge: '⚪', away: 'Barcelona', away_badge: '🔵', score_home: null, score_away: null, time: '21:00', status: 'upcoming', odds: { home: 2.10, draw: 3.30, away: 3.50 } },
    { id: 4, league: 'Libertadores', league_flag: '🏆', home: 'River Plate', home_badge: '⚪', away: 'Boca Juniors', away_badge: '🟡', score_home: null, score_away: null, time: '19:30', status: 'upcoming', odds: { home: 2.40, draw: 3.10, away: 2.80 } },
    { id: 5, league: 'Brasileirão Série A', league_flag: '🇧🇷', home: 'Corinthians', home_badge: '⚫', away: 'São Paulo', away_badge: '⚫', score_home: 0, score_away: 2, time: 'FIM', status: 'finished', odds: { home: 2.20, draw: 3.00, away: 3.20 } },
    { id: 6, league: 'Bundesliga', league_flag: '🇩🇪', home: 'Bayern München', home_badge: '🔴', away: 'Borussia Dortmund', away_badge: '🟡', score_home: null, score_away: null, time: '15:30', status: 'upcoming', odds: { home: 1.45, draw: 4.50, away: 6.00 } },
    { id: 7, league: 'Copa do Brasil', league_flag: '🇧🇷', home: 'Atlético-MG', home_badge: '⚫', away: 'Internacional', away_badge: '🔴', score_home: 1, score_away: 1, time: '38\'', status: 'live', odds: { home: 1.90, draw: 3.20, away: 3.80 } },
  ],
  standings: [
    { pos: 1, team: 'Flamengo', badge: '🔴', pts: 52, pg: 22, v: 16, e: 4, d: 2, gm: 48, gs: 20, sg: 28, form: ['W','W','D','W','W'] },
    { pos: 2, team: 'Palmeiras', badge: '🟢', pts: 48, pg: 22, v: 14, e: 6, d: 2, gm: 40, gs: 18, sg: 22, form: ['W','D','W','W','D'] },
    { pos: 3, team: 'Atlético-MG', badge: '⚫', pts: 45, pg: 22, v: 13, e: 6, d: 3, gm: 38, gs: 22, sg: 16, form: ['L','W','W','D','W'] },
    { pos: 4, team: 'São Paulo', badge: '⚫', pts: 41, pg: 22, v: 12, e: 5, d: 5, gm: 35, gs: 24, sg: 11, form: ['W','W','L','D','W'] },
    { pos: 5, team: 'Internacional', badge: '🔴', pts: 38, pg: 22, v: 11, e: 5, d: 6, gm: 32, gs: 26, sg: 6, form: ['D','W','D','W','L'] },
    { pos: 6, team: 'Corinthians', badge: '⚫', pts: 35, pg: 22, v: 10, e: 5, d: 7, gm: 28, gs: 28, sg: 0, form: ['L','L','W','D','W'] },
    { pos: 7, team: 'Botafogo', badge: '⚫', pts: 34, pg: 22, v: 9, e: 7, d: 6, gm: 30, gs: 27, sg: 3, form: ['W','D','D','L','W'] },
    { pos: 8, team: 'Fluminense', badge: '🔴', pts: 30, pg: 22, v: 8, e: 6, d: 8, gm: 25, gs: 30, sg: -5, form: ['L','W','L','D','W'] },
    { pos: 17, team: 'Cruzeiro', badge: '🔵', pts: 18, pg: 22, v: 4, e: 6, d: 12, gm: 18, gs: 36, sg: -18, form: ['L','D','L','L','D'] },
    { pos: 18, team: 'Coritiba', badge: '⚪', pts: 14, pg: 22, v: 3, e: 5, d: 14, gm: 14, gs: 42, sg: -28, form: ['L','L','D','L','L'] },
  ],
  players: [
    { rank: 1, name: 'Pedro', initials: 'PE', team: 'Flamengo', league: 'Brasileirão', goals: 18, assists: 6, shots: 72, passes: 310, rating: 8.4 },
    { rank: 2, name: 'Raphael Veiga', initials: 'RV', team: 'Palmeiras', league: 'Brasileirão', goals: 14, assists: 8, shots: 60, passes: 420, rating: 8.1 },
    { rank: 3, name: 'Hulk', initials: 'HK', team: 'Atlético-MG', league: 'Brasileirão', goals: 12, assists: 4, shots: 55, passes: 280, rating: 7.9 },
    { rank: 4, name: 'Calleri', initials: 'CA', team: 'São Paulo', league: 'Brasileirão', goals: 11, assists: 3, shots: 50, passes: 240, rating: 7.8 },
    { rank: 5, name: 'Erling Haaland', initials: 'EH', team: 'Man City', league: 'Premier League', goals: 24, assists: 5, shots: 95, passes: 180, rating: 9.0 },
    { rank: 6, name: 'Kylian Mbappé', initials: 'KM', team: 'Real Madrid', league: 'La Liga', goals: 21, assists: 9, shots: 88, passes: 310, rating: 8.9 },
    { rank: 7, name: 'Lamine Yamal', initials: 'LY', team: 'Barcelona', league: 'La Liga', goals: 14, assists: 16, shots: 68, passes: 580, rating: 8.7 },
  ],
  odds: [
    { match: 'Flamengo × Palmeiras', league: 'Brasileirão', bet365_home: 1.85, bet365_draw: 3.40, bet365_away: 4.20, betano_home: 1.90, betano_draw: 3.35, betano_away: 4.10, value: 'home' },
    { match: 'Man City × Arsenal', league: 'Premier League', bet365_home: 1.60, bet365_draw: 3.80, bet365_away: 5.50, betano_home: 1.65, betano_draw: 3.75, betano_away: 5.30, value: 'draw' },
    { match: 'Real Madrid × Barcelona', league: 'La Liga', bet365_home: 2.10, bet365_draw: 3.30, bet365_away: 3.50, betano_home: 2.05, betano_draw: 3.40, betano_away: 3.60, value: 'away' },
    { match: 'River × Boca', league: 'Libertadores', bet365_home: 2.40, bet365_draw: 3.10, bet365_away: 2.80, betano_home: 2.45, betano_draw: 3.15, betano_away: 2.75, value: null },
    { match: 'Bayern × Dortmund', league: 'Bundesliga', bet365_home: 1.45, bet365_draw: 4.50, bet365_away: 6.00, betano_home: 1.50, betano_draw: 4.40, betano_away: 5.80, value: 'home' },
    { match: 'Atlético-MG × Inter', league: 'Copa do Brasil', bet365_home: 1.90, bet365_draw: 3.20, bet365_away: 3.80, betano_home: 1.95, betano_draw: 3.15, betano_away: 3.70, value: null },
  ],
  h2h: {
    teamA: 'Flamengo', teamB: 'Palmeiras',
    wins_a: 7, draws: 5, wins_b: 8,
    goals_a: 24, goals_b: 26,
    matches: [
      { date: '12/05/2024', league: 'Brasileirão', score_a: 2, score_b: 1 },
      { date: '18/03/2024', league: 'Copa do Brasil', score_a: 1, score_b: 1 },
      { date: '30/10/2023', league: 'Brasileirão', score_a: 0, score_b: 2 },
      { date: '14/08/2023', league: 'Brasileirão', score_a: 3, score_b: 1 },
      { date: '02/04/2023', league: 'Copa do Brasil', score_a: 1, score_b: 3 },
      { date: '22/10/2022', league: 'Brasileirão', score_a: 0, score_b: 0 },
      { date: '05/06/2022', league: 'Libertadores', score_a: 2, score_b: 0 },
      { date: '10/11/2021', league: 'Brasileirão', score_a: 4, score_b: 0 },
      { date: '08/08/2021', league: 'Brasileirão', score_a: 1, score_b: 2 },
      { date: '27/06/2021', league: 'Copa do Brasil', score_a: 1, score_b: 1 },
    ]
  },
  tips: [
    { match: 'Flamengo × Palmeiras', league: 'Brasileirão Série A', market: 'Ambos marcam: Sim', odd: 1.95, confidence: 4, analysis: 'Flamengo tem o segundo melhor ataque em casa com 2.1 gols/jogo. Palmeiras marca em 80% dos jogos fora. Os dois times têm defesas que vazam em clássicos. Histórico H2H aponta para confrontos abertos. Recomendamos fortemente ambas as equipes marcarem neste confronto de alto nível.', time: '21:00', date: 'Hoje' },
    { match: 'Man City × Arsenal', league: 'Premier League', market: 'Over 2.5 gols', odd: 1.75, confidence: 5, analysis: 'Os últimos 8 confrontos diretos tiveram média de 3.4 gols. Man City marca 2.8 gols/jogo em casa. Arsenal é o melhor ataque visitante da Premier League. Com os dois ataques em grande fase, esperamos um jogo aberto com pelo menos 3 gols.', time: '16:30', date: 'Hoje' },
    { match: 'Real Madrid × Barcelona', league: 'La Liga', market: 'Real Madrid Vence', odd: 2.10, confidence: 3, analysis: 'El Clásico sempre é imprevisível, mas o Real Madrid tem vantagem jogando no Bernabéu. Nos últimos 5 clássicos em casa, o Real ganhou 4. Barcelona viaja com desfalques importantes. As odds de 2.10 para o Real apresentam valor.', time: '21:00', date: 'Amanhã' },
    { match: 'Bayern × Dortmund', league: 'Bundesliga', market: 'Bayern Vence & Over 2.5', odd: 1.85, confidence: 4, analysis: 'Der Klassiker com Bayern em excelente fase: 8 vitórias consecutivas em casa. Dortmund tem defesa vulnerável fora (2.1 gols sofridos/jogo fora). Bayern marca em média 3.2 gols em casa. Combinação com valor real.', time: '15:30', date: 'Hoje' },
    { match: 'Atlético-MG × Inter', league: 'Copa do Brasil', market: 'Empate no intervalo', odd: 2.80, confidence: 3, analysis: 'Jogos de Copa do Brasil tendem a ser mais cautelosos no início. Nos últimos 6 jogos do Atlético em casa em mata-mata, 4 terminaram empatados no intervalo. Internacional viaja para administrar o resultado. Odd de 2.80 tem grande valor.', time: '19:30', date: 'Hoje' },
  ],
};

// =============================================
//  API — FOOTSTATS (com fallback para mock)
// =============================================
async function fetchAPI(endpoint, params = {}) {
  const qs = new URLSearchParams({ ...params, api_key: API_KEY }).toString();
  const url = `${API_BASE}/${endpoint}?${qs}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function loadMatches(leagueId = '') {
  const container = document.getElementById('matches-list');
  if (!container) return;
  showSkeleton(container, 4);
  try {
    const data = await fetchAPI('fixtures', { league: leagueId, limit: 20 });
    state.matches = data.fixtures || data.results || data;
    renderMatches(container, state.matches);
  } catch {
    renderMatches(container, MOCK.matches);
    state.matches = MOCK.matches;
  }
}

async function loadStandings(leagueId = 'brasileirao') {
  const container = document.getElementById('standings-body');
  if (!container) return;
  try {
    const data = await fetchAPI('standings', { league: leagueId });
    renderStandings(container, data.standings || data);
  } catch {
    renderStandings(container, MOCK.standings);
  }
}

async function loadPlayers(leagueId = '') {
  const container = document.getElementById('players-body');
  if (!container) return;
  try {
    const data = await fetchAPI('players/top', { league: leagueId, season: '2024' });
    renderPlayers(container, data.players || data);
  } catch {
    renderPlayers(container, MOCK.players);
  }
}

async function loadOdds() {
  const container = document.getElementById('odds-body');
  if (!container) return;
  try {
    const data = await fetchAPI('odds', { season: '2024' });
    renderOdds(container, data.odds || data);
  } catch {
    renderOdds(container, MOCK.odds);
  }
}

async function loadH2H(teamA, teamB) {
  const container = document.getElementById('h2h-content');
  if (!container) return;
  showSkeleton(container, 3);
  try {
    const data = await fetchAPI('h2h', { team_a: teamA, team_b: teamB, limit: 10 });
    renderH2H(container, data);
  } catch {
    renderH2H(container, MOCK.h2h);
  }
}

// =============================================
//  RENDER FUNCTIONS
// =============================================
function renderMatches(container, matches) {
  if (!matches || !matches.length) {
    container.innerHTML = errorState('Nenhum jogo encontrado', 'Tente outro campeonato ou data.');
    return;
  }
  container.innerHTML = matches.map(m => {
    const isLive = m.status === 'live';
    const isFinished = m.status === 'finished';
    const scoreDisplay = (m.score_home !== null && m.score_away !== null)
      ? `${m.score_home} - ${m.score_away}`
      : `${m.time || '-'}`;

    return `
      <div class="match-card ${isLive ? 'live' : ''}">
        <div class="match-meta">
          <span class="match-league">${m.league_flag || '⚽'} ${m.league}</span>
          <span class="match-time ${isLive ? 'live-time' : ''}">${isLive ? '● ' + m.time : m.time}</span>
        </div>
        <div class="match-teams">
          <div class="team home">
            <div class="team-badge">${m.home_badge || '⚽'}</div>
            <span>${m.home}</span>
          </div>
          <div class="score ${isLive ? 'live' : ''}">${scoreDisplay}</div>
          <div class="team away">
            <div class="team-badge">${m.away_badge || '⚽'}</div>
            <span>${m.away}</span>
          </div>
        </div>
        ${!isFinished && m.odds ? `
        <div class="match-footer">
          <div class="odds-row">
            <button class="odd-btn">
              <span>1</span>
              <span>${m.odds.home}</span>
            </button>
            <button class="odd-btn">
              <span>X</span>
              <span>${m.odds.draw}</span>
            </button>
            <button class="odd-btn">
              <span>2</span>
              <span>${m.odds.away}</span>
            </button>
          </div>
          <span style="font-size:11px;color:var(--text-muted);">Bet365</span>
        </div>` : ''}
      </div>`;
  }).join('');
}

function renderStandings(tbody, standings) {
  if (!standings || !standings.length) {
    tbody.innerHTML = `<tr><td colspan="10">${errorState('Tabela indisponível', '')}</td></tr>`;
    return;
  }
  tbody.innerHTML = standings.map(t => {
    const form = (t.form || []).map(r => `<div class="form-dot ${r}">${r}</div>`).join('');
    const posClass = t.pos <= 3 ? `pos-${t.pos}` : t.pos >= 17 ? 'pos-rel' : t.pos === 4 ? 'pos-4' : '';
    return `
      <tr>
        <td><span class="pos-badge ${posClass}">${t.pos}</span></td>
        <td><div class="team-inline"><span>${t.badge || '⚽'}</span> <span>${t.team}</span></div></td>
        <td><b>${t.pts}</b></td>
        <td>${t.pg}</td>
        <td style="color:var(--accent)">${t.v}</td>
        <td style="color:var(--warning)">${t.e}</td>
        <td style="color:var(--danger)">${t.d}</td>
        <td>${t.gm}</td>
        <td>${t.gs}</td>
        <td style="color:${t.sg >= 0 ? 'var(--accent)' : 'var(--danger)'}">${t.sg > 0 ? '+' : ''}${t.sg}</td>
        <td><div class="form-dots">${form}</div></td>
      </tr>`;
  }).join('');
}

function renderPlayers(tbody, players) {
  if (!players || !players.length) {
    tbody.innerHTML = `<tr><td colspan="8">${errorState('Dados indisponíveis', '')}</td></tr>`;
    return;
  }
  tbody.innerHTML = players.map(p => `
    <tr>
      <td><b style="color:var(--text-muted)">${p.rank}</b></td>
      <td>
        <div class="player-inline">
          <div class="player-avatar">${p.initials || p.name.slice(0,2).toUpperCase()}</div>
          <div class="player-info">
            <div class="player-name">${p.name}</div>
            <div class="player-team">${p.team} · ${p.league}</div>
          </div>
        </div>
      </td>
      <td><span class="number-cell accent">${p.goals}</span></td>
      <td><span class="number-cell">${p.assists}</span></td>
      <td><span class="number-cell">${p.shots || '-'}</span></td>
      <td><span class="number-cell">${p.passes || '-'}</span></td>
      <td>
        <span style="color:${p.rating >= 8.5 ? 'var(--accent)' : p.rating >= 7.5 ? 'var(--warning)' : 'var(--text-secondary)'}; font-weight:700;">${p.rating}</span>
      </td>
    </tr>`).join('');
}

function renderOdds(tbody, odds) {
  if (!odds || !odds.length) {
    tbody.innerHTML = `<tr><td colspan="8">${errorState('Odds indisponíveis', '')}</td></tr>`;
    return;
  }
  tbody.innerHTML = odds.map(o => `
    <tr>
      <td>
        <div class="odds-match-name">${o.match}</div>
        <div style="font-size:11px;color:var(--text-muted)">${o.league}</div>
      </td>
      <td class="odd-cell ${o.value === 'home' ? 'best' : ''}">${o.bet365_home}${o.value === 'home' ? '<span class="value-tag">VALUE</span>' : ''}</td>
      <td class="odd-cell ${o.value === 'draw' ? 'best' : ''}">${o.bet365_draw}${o.value === 'draw' ? '<span class="value-tag">VALUE</span>' : ''}</td>
      <td class="odd-cell ${o.value === 'away' ? 'best' : ''}">${o.bet365_away}${o.value === 'away' ? '<span class="value-tag">VALUE</span>' : ''}</td>
      <td class="odd-cell">${o.betano_home}</td>
      <td class="odd-cell">${o.betano_draw}</td>
      <td class="odd-cell">${o.betano_away}</td>
    </tr>`).join('');
}

function renderH2H(container, data) {
  const totalGames = (data.wins_a || 0) + (data.draws || 0) + (data.wins_b || 0);
  const pctA = totalGames ? Math.round((data.wins_a / totalGames) * 100) : 33;
  const pctD = totalGames ? Math.round((data.draws / totalGames) * 100) : 33;
  const pctB = 100 - pctA - pctD;

  container.innerHTML = `
    <div class="h2h-summary">
      <div>
        <div class="h2h-team-name">${data.teamA}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:4px;">${data.wins_a} vitórias</div>
        <div style="font-size:12px;color:var(--text-muted)">${data.goals_a} gols marcados</div>
      </div>
      <div class="h2h-stats">
        <div class="h2h-stat-row">
          <span class="h2h-num green">${data.wins_a}</span>
          <span class="h2h-sep">V · E · D</span>
          <span class="h2h-num gray">${data.draws}</span>
          <span class="h2h-sep">·</span>
          <span class="h2h-num red">${data.wins_b}</span>
        </div>
        <div class="h2h-bar">
          <div class="h2h-bar-a" style="width:${pctA}%"></div>
          <div class="h2h-bar-d" style="width:${pctD}%"></div>
          <div class="h2h-bar-b" style="width:${pctB}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:4px">${totalGames} jogos</div>
      </div>
      <div>
        <div class="h2h-team-name">${data.teamB}</div>
        <div style="font-size:12px;color:var(--danger);margin-top:4px;">${data.wins_b} vitórias</div>
        <div style="font-size:12px;color:var(--text-muted)">${data.goals_b} gols marcados</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title"><i class="fas fa-history"></i> Últimos Confrontos</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="standings-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Competição</th>
              <th style="text-align:center">${data.teamA}</th>
              <th style="text-align:center">X</th>
              <th style="text-align:center">${data.teamB}</th>
              <th style="text-align:center">Resultado</th>
            </tr>
          </thead>
          <tbody>
            ${(data.matches || []).map(m => {
              const winner = m.score_a > m.score_b ? data.teamA : m.score_b > m.score_a ? data.teamB : 'Empate';
              const color = winner === data.teamA ? 'var(--accent)' : winner === data.teamB ? 'var(--danger)' : 'var(--warning)';
              return `
                <tr>
                  <td>${m.date}</td>
                  <td><span style="color:var(--text-muted)">${m.league}</span></td>
                  <td style="text-align:center;font-weight:700">${m.score_a}</td>
                  <td style="text-align:center;color:var(--text-muted)">×</td>
                  <td style="text-align:center;font-weight:700">${m.score_b}</td>
                  <td style="text-align:center;color:${color};font-weight:700;font-size:12px">${winner}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderTips(container, tips) {
  if (!tips || !tips.length) {
    container.innerHTML = errorState('Nenhuma tip disponível', 'Volte mais tarde.');
    return;
  }
  container.innerHTML = tips.map(t => {
    const stars = Array.from({ length: 5 }, (_, i) =>
      `<i class="fas fa-star ${i < t.confidence ? 'filled' : 'empty'}"></i>`
    ).join('');
    return `
      <div class="tip-card">
        <div class="tip-header">
          <span class="tip-match">${t.match}</span>
          <div class="tip-confidence">${stars}</div>
        </div>
        <div class="tip-market"><i class="fas fa-tag"></i> ${t.market}</div>
        <p class="tip-analysis">${t.analysis}</p>
        <div class="tip-footer">
          <div class="tip-odd">${t.odd} <span>odd</span></div>
          <div class="tip-league"><i class="fas fa-trophy"></i> ${t.league} · ${t.date} ${t.time}</div>
        </div>
      </div>`;
  }).join('');
}

// =============================================
//  CHARTS
// =============================================
function initCharts() {
  initGoalsChart();
  initFormChart();
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#7986cb', font: { family: 'Inter', size: 11 } }
      }
    },
    scales: {
      x: {
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#4a5288', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' }
      },
      y: {
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#4a5288', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };
}

function initGoalsChart() {
  const ctx = document.getElementById('goalsChart');
  if (!ctx || ctx._chart) return;
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Flamengo','Palmeiras','Atl-MG','São Paulo','Inter','Corinthians','Botafogo','Fluminense'],
      datasets: [
        {
          label: 'Gols Marcados',
          data: [48, 40, 38, 35, 32, 28, 30, 25],
          backgroundColor: 'rgba(0, 230, 118, 0.7)',
          borderColor: '#00e676',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Gols Sofridos',
          data: [20, 18, 22, 24, 26, 28, 27, 30],
          backgroundColor: 'rgba(255, 82, 82, 0.5)',
          borderColor: '#ff5252',
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: {
      ...chartDefaults(),
    }
  });
}

function initFormChart() {
  const ctx = document.getElementById('formChart');
  if (!ctx || ctx._chart) return;
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Rd 18', 'Rd 19', 'Rd 20', 'Rd 21', 'Rd 22'],
      datasets: [
        {
          label: 'Flamengo',
          data: [3, 1, 2, 3, 3],
          borderColor: '#00e676',
          backgroundColor: 'rgba(0,230,118,0.08)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#00e676',
        },
        {
          label: 'Palmeiras',
          data: [1, 3, 3, 1, 1],
          borderColor: '#448aff',
          backgroundColor: 'rgba(68,138,255,0.05)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#448aff',
        }
      ]
    },
    options: {
      ...chartDefaults(),
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          min: 0, max: 3,
          ticks: { ...chartDefaults().scales.y.ticks, stepSize: 1, callback: v => ['','D','D','V'][v] || '' }
        }
      }
    }
  });
}

// =============================================
//  SKELETON & ERROR
// =============================================
function showSkeleton(container, count = 3) {
  container.innerHTML = Array(count).fill(`<div class="skeleton skeleton-card"></div>`).join('');
}

function errorState(title, msg) {
  return `
    <div class="error-state">
      <i class="fas fa-exclamation-circle"></i>
      <h3>${title}</h3>
      <p>${msg}</p>
      <button class="btn-retry" onclick="loadSection('${state.activeSection}')">
        <i class="fas fa-redo"></i> Tentar novamente
      </button>
    </div>`;
}

// =============================================
//  NAVIGATION
// =============================================
function navigate(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add('active');

  const nav = document.querySelector(`[data-section="${section}"]`);
  if (nav) nav.classList.add('active');

  const titles = {
    home: 'Dashboard',
    matches: 'Jogos & Resultados',
    stats: 'Estatísticas',
    odds: 'Odds & Probabilidades',
    h2h: 'Histórico H2H',
    tips: 'Tips de Apostas',
  };
  document.getElementById('page-title').textContent = titles[section] || section;
  state.activeSection = section;
  loadSection(section);
  closeSidebar();
}

function loadSection(section) {
  switch (section) {
    case 'home':
      renderTips(document.getElementById('home-tips'), MOCK.tips.slice(0, 3));
      renderMatches(document.getElementById('home-matches'), MOCK.matches.filter(m => m.status !== 'finished').slice(0, 4));
      setTimeout(initCharts, 100);
      break;
    case 'matches':
      loadMatches(state.activeLeague !== 'all' ? state.activeLeague : '');
      break;
    case 'stats':
      loadStandings();
      loadPlayers();
      break;
    case 'odds':
      loadOdds();
      break;
    case 'h2h':
      renderH2H(document.getElementById('h2h-content'), MOCK.h2h);
      break;
    case 'tips':
      renderTips(document.getElementById('tips-list'), MOCK.tips);
      break;
  }
}

// =============================================
//  THEME
// =============================================
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.innerHTML = state.theme === 'dark'
      ? '<i class="fas fa-sun"></i> Modo Claro'
      : '<i class="fas fa-moon"></i> Modo Escuro';
  }
  localStorage.setItem('theme', state.theme);
}

// =============================================
//  SIDEBAR (mobile)
// =============================================
function openSidebar() {
  document.querySelector('.sidebar').classList.add('open');
  document.querySelector('.overlay').classList.add('active');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.overlay').classList.remove('active');
}

// =============================================
//  LEAGUE TABS
// =============================================
function switchLeagueTab(el, league) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  state.activeLeague = league;

  const section = state.activeSection;
  if (section === 'matches') loadMatches(league !== 'all' ? league : '');
  if (section === 'stats') loadStandings(league !== 'all' ? league : 'brasileirao');
}

// =============================================
//  H2H SEARCH
// =============================================
function searchH2H() {
  const a = document.getElementById('h2h-input-a').value.trim();
  const b = document.getElementById('h2h-input-b').value.trim();
  if (!a || !b) return;
  loadH2H(a, b);
}

// =============================================
//  LIVE CLOCK UPDATE
// =============================================
function updateLiveClock() {
  const now = new Date();
  const el = document.getElementById('live-clock');
  if (el) el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// =============================================
//  INIT
// =============================================
function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  state.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);

  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.innerHTML = savedTheme === 'dark'
      ? '<i class="fas fa-sun"></i> Modo Claro'
      : '<i class="fas fa-moon"></i> Modo Escuro';
  }

  navigate('home');
  updateLiveClock();
  setInterval(updateLiveClock, 60000);
  setInterval(() => { if (state.activeSection === 'matches') loadMatches(); }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
