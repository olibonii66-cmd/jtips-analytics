const FOOTYSTATS_API_KEY = 'example';
const FOOTYSTATS_REMOTE_URL = 'https://api.football-data-api.com';
const FOOTYSTATS_PROXY_URL = '/api/footystats';
const FOOTYSTATS_BASE_URL = window.location.protocol === 'file:' ? FOOTYSTATS_REMOTE_URL : FOOTYSTATS_PROXY_URL;
const DEFAULT_SEASON_ID = 2012;
const FALLBACK_LEAGUE_ID = 1625; // EPL 2018/2019, usado pela chave example em parte da documentação
const APP_TIMEZONE = 'America/Sao_Paulo';

const state = {
  matches: [],
  teams: [],
  players: [],
  marketChart: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const endpoints = {
  todaysMatches: (date) => `/todays-matches?date=${date}&timezone=${encodeURIComponent(APP_TIMEZONE)}`,
  leagueMatches: (seasonId = DEFAULT_SEASON_ID) => `/league-matches?season_id=${seasonId}&max_per_page=500`,
  leagueMatchesByLeagueId: (leagueId = FALLBACK_LEAGUE_ID) => `/league-matches?league_id=${leagueId}&max_per_page=500`,
  leagueTeams: (seasonId = DEFAULT_SEASON_ID) => `/league-teams?season_id=${seasonId}&include=stats`,
  leagueTeamsByLeagueId: (leagueId = FALLBACK_LEAGUE_ID) => `/league-teams?league_id=${leagueId}&include=stats`,
  leaguePlayers: (seasonId = DEFAULT_SEASON_ID) => `/league-players?season_id=${seasonId}&include=stats`,
  leaguePlayersByLeagueId: (leagueId = FALLBACK_LEAGUE_ID) => `/league-players?league_id=${leagueId}&include=stats`,
  match: (matchId) => `/match?match_id=${matchId}`,
};

async function footyFetch(path, { raw = false } = {}) {
  const glue = path.includes('?') ? '&' : '?';
  const url = `${FOOTYSTATS_BASE_URL}${path}${glue}key=${encodeURIComponent(FOOTYSTATS_API_KEY)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Erro HTTP ${response.status} em ${path}`);
  const payload = await response.json();

  // A API pode retornar success=false, error, message ou apenas data vazia dependendo do endpoint/plano.
  if (payload?.success === false || payload?.error) {
    throw new Error(payload.message || payload.error || `A API recusou a requisição em ${path}.`);
  }

  if (raw) return payload;
  const normalized = normalizeApiArray(payload);
  console.info('[FootyStats]', path, { total: normalized.length, payload });
  return normalized;
}

async function footyFetchFirst(paths) {
  const errors = [];
  for (const path of paths) {
    try {
      const data = await footyFetch(path);
      if (data.length) return data;
      errors.push(`${path}: retornou 0 registros`);
    } catch (error) {
      errors.push(`${path}: ${error.message}`);
    }
  }
  console.warn('[FootyStats] Nenhum endpoint retornou registros', errors);
  return [];
}

function normalizeApiArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.fixtures)) return payload.fixtures;
  if (Array.isArray(payload?.result)) return payload.result;
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
}

function unixToTime(unix) {
  if (!unix || Number(unix) < 0) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE }).format(new Date(Number(unix) * 1000));
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return '--';
  return `${Math.round(number)}%`;
}

function numberOrDash(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return '--';
  return number.toFixed(digits).replace('.', ',');
}

function teamName(match, side) {
  const keys = side === 'home'
    ? ['home_name', 'homeName', 'team_a_name', 'team_a', 'home_team_name']
    : ['away_name', 'awayName', 'team_b_name', 'team_b', 'away_team_name'];
  return keys.map((key) => match[key]).find(Boolean) || (side === 'home' ? `Time ${match.homeID || 'A'}` : `Time ${match.awayID || 'B'}`);
}

function leagueName(match) {
  return match.competition_name || match.league || match.season || `Liga ${match.competition_id || '--'}`;
}

function matchScore(match) {
  const home = Number.isFinite(Number(match.homeGoalCount)) ? match.homeGoalCount : '-';
  const away = Number.isFinite(Number(match.awayGoalCount)) ? match.awayGoalCount : '-';
  return `${home} x ${away}`;
}

function statusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('complete')) return 'Finalizado';
  if (normalized.includes('live')) return 'Ao vivo';
  if (normalized.includes('suspend')) return 'Suspenso';
  if (normalized.includes('cancel')) return 'Cancelado';
  return 'Agendado';
}

function impliedProbability(odd) {
  const value = Number(odd);
  if (!Number.isFinite(value) || value <= 1) return null;
  return 100 / value;
}

function isValueBet(probability, odd) {
  const implied = impliedProbability(odd);
  const model = Number(probability);
  return Number.isFinite(model) && implied && model > implied + 5;
}

function setSkeleton(selector, quantity = 3) {
  $(selector).innerHTML = Array.from({ length: quantity }, () => '<div class="skeleton"></div>').join('');
}

function showError(selector, message) {
  $(selector).innerHTML = `<div class="error-box"><strong>Não foi possível carregar.</strong><br>${message}</div>`;
}

async function loadDashboard() {
  setApiStatus('carregando');
  ['#featuredMatches', '#teamStats', '#playerStats', '#oddsGrid', '#tipsList'].forEach((selector) => setSkeleton(selector));
  $('#matchesTable').innerHTML = `<tr><td colspan="7"><div class="skeleton"></div></td></tr>`;

  const date = $('#matchDate').value || todayISO();
  try {
    const [todayMatches, leagueMatches, teams, players] = await Promise.all([
      footyFetchFirst([
        endpoints.todaysMatches(date),
        endpoints.leagueMatches(),
        endpoints.leagueMatchesByLeagueId(),
      ]),
      footyFetchFirst([
        endpoints.leagueMatches(),
        endpoints.leagueMatchesByLeagueId(),
      ]),
      footyFetchFirst([
        endpoints.leagueTeams(),
        endpoints.leagueTeamsByLeagueId(),
      ]),
      footyFetchFirst([
        endpoints.leaguePlayers(),
        endpoints.leaguePlayersByLeagueId(),
      ]),
    ]);

    // Primeiro tentamos jogos do dia. Se a chave example não trouxer jogos de hoje, caímos na temporada teste.
    const matchesData = todayMatches.length ? todayMatches : leagueMatches;

    state.matches = matchesData.slice(0, 120);
    state.teams = teams.slice(0, 12);
    state.players = players.slice(0, 30);

    renderAll();
    setApiStatus(state.matches.length ? 'ok' : 'vazio');
  } catch (error) {
    setApiStatus('erro');
    ['#featuredMatches', '#teamStats', '#playerStats', '#oddsGrid', '#tipsList'].forEach((selector) => showError(selector, error.message));
    $('#matchesTable').innerHTML = `<tr><td colspan="7">Falha ao carregar dados: ${error.message}</td></tr>`;
  }
}

function setApiStatus(status) {
  const apiStatus = $('#apiStatus');
  apiStatus.className = 'status-pill';
  if (status === 'ok') { apiStatus.textContent = 'API online'; apiStatus.classList.add('ok'); }
  else if (status === 'erro') { apiStatus.textContent = 'API com falha'; apiStatus.classList.add('error'); }
  else if (status === 'vazio') { apiStatus.textContent = 'API sem jogos'; apiStatus.classList.add('error'); }
  else { apiStatus.textContent = 'Carregando'; }
}

function renderAll() {
  renderKpis();
  renderFeaturedMatches();
  renderMatchesTable();
  renderTeams();
  renderPlayers();
  renderOdds();
  renderTips();
  renderMarketChart();
}

function renderKpis() {
  const matches = state.matches;
  const overValues = matches.map((m) => Number(m.o25_potential || m.o25_potential_pre_match || m.o25 || m.over25_potential)).filter(Number.isFinite);
  const bttsValues = matches.map((m) => Number(m.btts_potential)).filter(Number.isFinite);
  const values = matches.filter((m) => isValueBet(m.o25_potential, m.odds_ft_over25)).length;
  $('#kpiMatches').textContent = matches.length;
  $('#kpiOver25').textContent = overValues.length ? percent(avg(overValues)) : '--';
  $('#kpiBtts').textContent = bttsValues.length ? percent(avg(bttsValues)) : '--';
  $('#kpiValue').textContent = values;
}

function avg(list) { return list.reduce((sum, value) => sum + value, 0) / list.length; }

function renderFeaturedMatches() {
  const featured = [...state.matches]
    .sort((a, b) => Number(b.o25_potential || 0) - Number(a.o25_potential || 0))
    .slice(0, 5);

  $('#featuredMatches').innerHTML = featured.length ? featured.map((match) => `
    <article class="match-card">
      <div class="match-teams"><strong>${teamName(match, 'home')}</strong><span>${unixToTime(match.date_unix)}</span><strong>${teamName(match, 'away')}</strong></div>
      <div class="scoreline"><span>${leagueName(match)}</span><strong>${matchScore(match)}</strong><span>${statusLabel(match.status)}</span></div>
      <div class="odds-row"><span>Over 2.5: ${percent(match.o25_potential)}</span><span>BTTS: ${percent(match.btts_potential)}</span><span class="value">${valueLabel(match)}</span></div>
    </article>`).join('') : emptyState('Nenhuma partida encontrada para a data selecionada.');
}

function renderMatchesTable() {
  const leagueText = $('#leagueFilter').value.toLowerCase().trim();
  const status = $('#statusFilter').value;
  const rows = state.matches.filter((match) => {
    const leagueOk = !leagueText || leagueName(match).toLowerCase().includes(leagueText);
    const statusOk = status === 'all' || String(match.status || '').toLowerCase().includes(status);
    return leagueOk && statusOk;
  });

  $('#matchesTable').innerHTML = rows.length ? rows.map((match) => `
    <tr>
      <td>${unixToTime(match.date_unix)}</td>
      <td>${leagueName(match)}</td>
      <td>${teamName(match, 'home')}</td>
      <td><strong>${matchScore(match)}</strong></td>
      <td>${teamName(match, 'away')}</td>
      <td>${statusLabel(match.status)}</td>
      <td><span class="tag">O2.5 ${percent(match.o25_potential)}</span> <span class="tag">BTTS ${percent(match.btts_potential)}</span></td>
    </tr>`).join('') : `<tr><td colspan="7">Nenhum jogo bate com os filtros.</td></tr>`;
}

function renderTeams() {
  const teams = state.teams.slice(0, 6);
  $('#teamStats').innerHTML = teams.length ? teams.map((team) => `
    <article class="stat-card">
      <span>${team.country || 'Equipe'}</span>
      <strong>${team.name || team.full_name || team.english_name || `Time ${team.id}`}</strong>
      <p>PPG: ${numberOrDash(team.seasonPPG_overall)} · Vitórias: ${percent(team.winPercentage_overall)} · Gols: ${numberOrDash(team.seasonGoals_overall, 0)}</p>
      <p>BTTS: ${percent(team.seasonBTTSPercentage_overall)} · Cartões: ${numberOrDash(team.cardsTotal_overall || team.seasonCards_overall, 0)}</p>
    </article>`).join('') : emptyState('Sem estatísticas de times nesta chave/temporada.');
}

function renderPlayers() {
  const players = [...state.players]
    .sort((a, b) => Number(b.goals_overall || 0) - Number(a.goals_overall || 0))
    .slice(0, 8);
  $('#playerStats').innerHTML = players.length ? players.map((player, index) => `
    <div class="leader-row">
      <div><strong>#${index + 1} ${player.full_name || player.known_as || 'Jogador'}</strong><br><span class="muted">${player.position || '--'} · ${player.nationality || '--'}</span></div>
      <div><strong>${player.goals_overall || 0}</strong><br><span class="muted">gols</span></div>
    </div>`).join('') : emptyState('Sem estatísticas de jogadores nesta chave/temporada.');
}

function renderOdds() {
  const matches = state.matches.filter((match) => match.odds_ft_1 || match.odds_ft_x || match.odds_ft_2).slice(0, 9);
  $('#oddsGrid').innerHTML = matches.length ? matches.map((match) => `
    <article class="odds-card">
      <strong>${teamName(match, 'home')} x ${teamName(match, 'away')}</strong>
      <p class="muted">${leagueName(match)}</p>
      <div class="odds-row"><span>1: ${numberOrDash(match.odds_ft_1)}</span><span>X: ${numberOrDash(match.odds_ft_x)}</span><span>2: ${numberOrDash(match.odds_ft_2)}</span></div>
      <p class="${isValueBet(match.o25_potential, match.odds_ft_over25) ? 'value' : 'no-value'}">${valueLabel(match)}</p>
    </article>`).join('') : emptyState('Nenhuma odd disponível no conjunto retornado.');
}

function renderTips() {
  const tips = state.matches
    .filter((match) => Number(match.o25_potential) > 55 || Number(match.btts_potential) > 55)
    .slice(0, 6);
  $('#tipsList').innerHTML = tips.length ? tips.map((match) => {
    const market = Number(match.o25_potential) >= Number(match.btts_potential) ? 'Over 2.5 gols' : 'Ambas marcam';
    const confidence = Math.min(5, Math.max(1, Math.round(Number(match.o25_potential || match.btts_potential) / 20)));
    return `<article class="tip-card">
      <strong>${teamName(match, 'home')} x ${teamName(match, 'away')}</strong>
      <span class="tag">Mercado sugerido: ${market}</span>
      <p>Modelo indica boa aderência estatística ao mercado, considerando potencial pré-jogo e odds disponíveis.</p>
      <span class="stars">${'★'.repeat(confidence)}${'☆'.repeat(5 - confidence)}</span>
    </article>`;
  }).join('') : emptyState('Ainda não há tips fortes para este filtro.');
}

function renderMarketChart() {
  const ctx = $('#marketsChart');
  if (!ctx || !window.Chart) return;
  const data = {
    over25: state.matches.filter((m) => Number(m.o25_potential) >= 55).length,
    btts: state.matches.filter((m) => Number(m.btts_potential) >= 55).length,
    cards: state.matches.filter((m) => Number(m.cards_potential) >= 4).length,
  };
  if (state.marketChart) state.marketChart.destroy();
  state.marketChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Over 2.5', 'BTTS', 'Cartões'], datasets: [{ data: [data.over25, data.btts, data.cards] }] },
    options: { plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } } } }
  });
}

function valueLabel(match) {
  return isValueBet(match.o25_potential, match.odds_ft_over25) ? 'Value bet em Over 2.5' : 'Sem value claro';
}

function emptyState(message) { return `<div class="error-box">${message}</div>`; }

async function handleH2H(event) {
  event.preventDefault();
  const matchId = $('#matchIdInput').value.trim();
  if (!matchId) return showError('#h2hResults', 'Informe um ID de partida válido.');
  setSkeleton('#h2hResults', 2);
  try {
    const [match] = await footyFetch(endpoints.match(matchId));
    const h2h = match?.h2h;
    if (!h2h) return showError('#h2hResults', 'A partida foi encontrada, mas não retornou dados H2H nesta chave.');
    $('#h2hResults').innerHTML = `
      <article class="h2h-card">
        <strong>${teamName(match, 'home')} x ${teamName(match, 'away')}</strong>
        <p>Vitórias mandante: ${percent(h2h.team_a_win_percent || h2h.home_win_percent)} · Empates: ${percent(h2h.draw_percent)} · Vitórias visitante: ${percent(h2h.team_b_win_percent || h2h.away_win_percent)}</p>
        <p>Over 2.5 H2H: ${percent(h2h.over25_percent || h2h.o25_percent)} · BTTS H2H: ${percent(h2h.btts_percent)}</p>
      </article>`;
  } catch (error) {
    showError('#h2hResults', error.message);
  }
}

function setupInteractions() {
  $('#matchDate').value = todayISO();
  $('#refreshBtn').addEventListener('click', loadDashboard);
  $('#leagueFilter').addEventListener('input', renderMatchesTable);
  $('#statusFilter').addEventListener('change', renderMatchesTable);
  $('#h2hForm').addEventListener('submit', handleH2H);
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $$('.nav-link').forEach((link) => link.addEventListener('click', () => $('#sidebar').classList.remove('open')));
  $('#themeToggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = current === 'light' ? 'light' : '';
  localStorage.setItem('theme', current);
  $('#themeToggle').innerHTML = current === 'light' ? '<i class="fa-solid fa-sun"></i><span>Light</span>' : '<i class="fa-solid fa-moon"></i><span>Dark</span>';
  renderMarketChart();
}

function hydrateTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.dataset.theme = 'light';
    $('#themeToggle').innerHTML = '<i class="fa-solid fa-sun"></i><span>Light</span>';
  }
}

setupInteractions();
hydrateTheme();
loadDashboard();
