let leagues = [];
let selectedMatch = null;
let selectedDate = getTodayISO();

const tabButtons = document.querySelectorAll(".tab");
const tabContent = document.getElementById("tabContent");

tabButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    tabButtons.forEach(function(item) {
      item.classList.remove("active");
    });

    button.classList.add("active");
    renderTab(button.dataset.tab);
  });
});

function initDateNavigation() {
  const dateNav = document.querySelector(".date-nav");

  if (!dateNav) return;

  const dates = buildDateOptions(selectedDate);

  dateNav.innerHTML = `
    <button type="button" onclick="changeSelectedDate(-1)">‹</button>

    ${dates.map(function(item) {
      return `
        <button
          type="button"
          class="${item.date === selectedDate ? "active" : ""}"
          onclick="selectDate('${item.date}')"
        >
          ${item.label}
        </button>
      `;
    }).join("")}

    <button type="button" onclick="changeSelectedDate(1)">›</button>
  `;
}

function buildDateOptions(centerDate) {
  const base = parseISODate(centerDate);
  const offsets = [-2, -1, 0, 1, 2, 3, 4];

  return offsets.map(function(offset) {
    const date = new Date(base);
    date.setDate(date.getDate() + offset);

    const iso = toISODate(date);
    const today = getTodayISO();

    let label = formatShortDate(date);

    if (iso === today) {
      label = "Hoje";
    }

    if (offset === -1 && centerDate === today) {
      label = "Ontem";
    }

    if (offset === 1 && centerDate === today) {
      label = "Amanhã";
    }

    return {
      date: iso,
      label
    };
  });
}

function selectDate(date) {
  selectedDate = date;
  initDateNavigation();
  loadMatchesByDate(selectedDate);
}

function changeSelectedDate(days) {
  const date = parseISODate(selectedDate);
  date.setDate(date.getDate() + days);

  selectedDate = toISODate(date);
  initDateNavigation();
  loadMatchesByDate(selectedDate);
}

async function loadMatchesByDate(date) {
  const container = document.getElementById("matchesContainer");

  leagues = [];
  selectedMatch = null;

  container.innerHTML = `
    <article class="card">
      <h2>Carregando jogos...</h2>
      <p class="small-note">
        Buscando partidas de ${formatFullDate(parseISODate(date))}.
      </p>
    </article>
  `;

  try {
    const response = await fetch(`/api/jogos?date=${encodeURIComponent(date)}&timezone=America/Sao_Paulo`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Erro ao carregar jogos da API.");
    }

    const matches = extractMatchesFromApi(payload.raw || payload.data || payload);

    if (!matches.length) {
      showEmptyMatches(date);
      return;
    }

    leagues = groupMatchesByLeague(matches);
    renderMatches();
  } catch (error) {
    leagues = [];

    container.innerHTML = `
      <article class="card">
        <h2>⚠️ Não foi possível carregar os jogos</h2>
        <p class="small-note">
          ${escapeHTML(error.message)}
        </p>
      </article>
    `;
  }
}

function showEmptyMatches(date) {
  const container = document.getElementById("matchesContainer");

  container.innerHTML = `
    <article class="card">
      <h2>📭 Nenhum jogo encontrado</h2>
      <p class="small-note">
        Não encontramos partidas disponíveis para
        <strong>${formatFullDate(parseISODate(date))}</strong>
        nas ligas liberadas pela sua API.
      </p>
      <p class="small-note">
        Use os botões de data acima para procurar jogos em outro dia.
      </p>
    </article>
  `;
}

function extractMatchesFromApi(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.matches)) return raw.matches;
  if (Array.isArray(raw.fixtures)) return raw.fixtures;

  if (raw.data && Array.isArray(raw.data.matches)) {
    return raw.data.matches;
  }

  return [];
}

function groupMatchesByLeague(matches) {
  const groups = new Map();

  matches.forEach(function(match) {
    const leagueName = getLeagueName(match);

    if (!groups.has(leagueName)) {
      groups.set(leagueName, {
        name: leagueName,
        matches: []
      });
    }

    groups.get(leagueName).matches.push(normalizeMatch(match));
  });

  return Array.from(groups.values());
}

function normalizeMatch(match) {
  const homeName =
    match.home_name ||
    match.homeName ||
    match.team_a_name ||
    match.home_team_name ||
    match.homeTeam ||
    match.home ||
    `Mandante ${match.homeID || ""}`.trim();

  const awayName =
    match.away_name ||
    match.awayName ||
    match.team_b_name ||
    match.away_team_name ||
    match.awayTeam ||
    match.away ||
    `Visitante ${match.awayID || ""}`.trim();

  const homeGoals = getNumber(
    match.homeGoalCount,
    match.home_goals,
    match.homeGoals
  );

  const awayGoals = getNumber(
    match.awayGoalCount,
    match.away_goals,
    match.awayGoals
  );

  const status = normalizeStatus(match.status, match.game_status, match);

  return {
    id: String(match.id || match.match_id || `${homeName}-${awayName}-${match.date_unix || ""}`),
    time: getMatchTime(match),
    status,
    home: homeName,
    away: awayName,
    homeShort: makeShort(homeName),
    awayShort: makeShort(awayName),
    homeLogo: getTeamLogo(match, "home"),
    awayLogo: getTeamLogo(match, "away"),
    score: status === "done" ? `${homeGoals ?? 0} - ${awayGoals ?? 0}` : "vs",
    odds: [
      formatOdd(match.odds_ft_1 || match.odds_1 || match.home_odds),
      formatOdd(match.odds_ft_X || match.odds_x || match.draw_odds),
      formatOdd(match.odds_ft_2 || match.odds_2 || match.away_odds)
    ],
    over25: formatPercent(
      match.o25_potential ||
      match.over_25_percentage ||
      match.over25 ||
      match.over_2_5_probability
    ),
    btts: formatPercent(
      match.btts_potential ||
      match.btts_percentage ||
      match.btts ||
      match.btts_probability
    ),
    form: ["d", "d", "d", "d", "d"],
    raw: match
  };
}

function getTeamLogo(match, side) {
  if (side === "home") {
    return (
      match.home_image ||
      match.home_logo ||
      match.homeBadge ||
      match.home_badge ||
      match.team_a_image ||
      match.team_a_logo ||
      match.team_a_badge ||
      match.home_url ||
      ""
    );
  }

  return (
    match.away_image ||
    match.away_logo ||
    match.awayBadge ||
    match.away_badge ||
    match.team_b_image ||
    match.team_b_logo ||
    match.team_b_badge ||
    match.away_url ||
    ""
  );
}

function getLeagueName(match) {
  if (match.resolved_league_name) {
    return match.resolved_league_name;
  }

  const country =
    match.country ||
    match.country_name ||
    match.league_country ||
    match.resolved_league_country ||
    "";

  const league =
    match.league_name ||
    match.competition_name ||
    match.season_name ||
    match.league ||
    match.name ||
    "";

  if (league && country) {
    return `${country} › ${league}`;
  }

  if (league) {
    return league;
  }

  const leagueId =
    match.competition_id ||
    match.league_id ||
    match.season_id ||
    match.resolved_league_id ||
    "";

  return leagueId ? `Liga ${leagueId}` : "Liga não identificada";
}

function normalizeStatus(status, gameStatus, match) {
  const value = String(status || gameStatus || "").toLowerCase().trim();

  if (
    value === "incomplete" ||
    value === "pending" ||
    value === "not_started" ||
    value === "not started" ||
    value === "scheduled" ||
    value === "pre-match" ||
    value === "pre match" ||
    value === ""
  ) {
    return "pre";
  }

  if (
    value === "complete" ||
    value === "completed" ||
    value === "finished" ||
    value === "final" ||
    value === "ft" ||
    value === "full-time" ||
    value === "full time"
  ) {
    return "done";
  }

  const unix =
    match.date_unix ||
    match.match_time ||
    match.timestamp ||
    match.kickoff_unix;

  if (unix && Number.isFinite(Number(unix))) {
    const matchTime = Number(unix) * 1000;
    const now = Date.now();

    if (matchTime > now) {
      return "pre";
    }
  }

  return "pre";
}

function getMatchTime(match) {
  const unix =
    match.date_unix ||
    match.match_time ||
    match.timestamp ||
    match.kickoff_unix;

  if (unix && Number.isFinite(Number(unix))) {
    const date = new Date(Number(unix) * 1000);

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    });
  }

  const rawDate =
    match.date ||
    match.kickoff ||
    match.match_date ||
    match.time;

  if (rawDate) {
    const date = new Date(rawDate);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo"
      });
    }

    return String(rawDate).slice(0, 5);
  }

  return "--:--";
}

function getNumber() {
  for (const value of arguments) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function formatOdd(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "-";
  }

  return number.toFixed(2);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    const text = String(value);
    return text.includes("%") ? text : "-";
  }

  if (number <= 1) {
    return `${Math.round(number * 100)}%`;
  }

  return `${Math.round(number)}%`;
}

function makeShort(name) {
  return String(name)
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(function(part) {
      return part[0];
    })
    .join("")
    .toUpperCase()
    .slice(0, 3) || "T";
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFormLabel(item) {
  if (item === "w") return "V";
  if (item === "d") return "E";
  return "D";
}

function renderTeamIcon(match, side) {
  const logo = side === "home" ? match.homeLogo : match.awayLogo;
  const short = side === "home" ? match.homeShort : match.awayShort;

  if (logo) {
    return `
      <img
        src="${escapeHTML(logo)}"
        alt="${escapeHTML(short)}"
        style="width:34px;height:34px;border-radius:10px;object-fit:contain;background:#e8f3ec;border:1px solid #cfe2d5;padding:4px;flex-shrink:0;"
      >
    `;
  }

  return `<span class="team-badge">${escapeHTML(short)}</span>`;
}

function renderBigTeamIcon(match, side) {
  const logo = side === "home" ? match.homeLogo : match.awayLogo;
  const short = side === "home" ? match.homeShort : match.awayShort;

  if (logo) {
    return `
      <img
        src="${escapeHTML(logo)}"
        alt="${escapeHTML(short)}"
        style="width:74px;height:74px;border-radius:20px;object-fit:contain;background:#e8f3ec;border:1px solid #cfe2d5;padding:8px;margin:0 auto 8px;display:block;"
      >
    `;
  }

  return `<div class="big-badge">${escapeHTML(short)}</div>`;
}

function renderMatches() {
  const container = document.getElementById("matchesContainer");

  if (!leagues.length) {
    showEmptyMatches(selectedDate);
    return;
  }

  container.innerHTML = leagues.map(function(league) {
    return `
      <article class="league-card">
        <header class="league-header">
          <div class="league-name">${escapeHTML(league.name)}</div>
          <div class="col-label">Forma</div>
          <div class="col-label">Odds<br>1 · X · 2</div>
          <div class="col-label">+2.5</div>
          <div class="col-label">BTTS</div>
          <div></div>
        </header>

        ${league.matches.map(function(match) {
          return `
            <div class="match-row">
              <div class="time">
                ${match.status === "done"
                  ? '<span class="status status-done">Finalizado</span>'
                  : `${escapeHTML(match.time)}<br><span class="status status-pre">Pré-jogo</span>`
                }
              </div>

              <div class="team">
                ${renderTeamIcon(match, "home")}
                <span class="team-name">${escapeHTML(match.home)}</span>
              </div>

              <div class="score">${escapeHTML(match.score)}</div>

              <div class="team">
                ${renderTeamIcon(match, "away")}
                <span class="team-name">${escapeHTML(match.away)}</span>
              </div>

              <div class="form">
                ${match.form.map(function(item) {
                  return `<span class="${item}">${getFormLabel(item)}</span>`;
                }).join("")}
              </div>

              <div class="odds">
                ${match.odds.map(function(odd) {
                  return `<span>${escapeHTML(odd)}</span>`;
                }).join("")}
              </div>

              <div class="percent">${escapeHTML(match.over25)}</div>
              <div class="percent">${escapeHTML(match.btts)}</div>

              <button class="stats-btn" type="button" onclick="showStats('${encodeURIComponent(match.id)}')">
                Estatísticas
              </button>
            </div>
          `;
        }).join("")}
      </article>
    `;
  }).join("");
}

function showStats(encodedMatchId) {
  const matchId = decodeURIComponent(encodedMatchId);
  const foundMatch = findMatchById(matchId);

  if (foundMatch) {
    selectedMatch = foundMatch;
    updateMatchHeader(foundMatch);
  }

  document.getElementById("homePage").classList.add("hidden");
  document.getElementById("statsPage").classList.remove("hidden");

  renderTab("completas");

  tabButtons.forEach(function(item) {
    item.classList.toggle("active", item.dataset.tab === "completas");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function findMatchById(matchId) {
  for (const league of leagues) {
    const match = league.matches.find(function(item) {
      return String(item.id) === String(matchId);
    });

    if (match) return match;
  }

  return null;
}

function updateMatchHeader(match) {
  const header = document.querySelector(".match-header");

  if (!header) return;

  header.innerHTML = `
    <div class="match-meta">
      <strong>Partida selecionada</strong><br>
      ${escapeHTML(formatFullDate(parseISODate(selectedDate)))} · ${escapeHTML(match.time)}<br>
      Dados via API
    </div>

    <div class="versus">
      <div>
        ${renderBigTeamIcon(match, "home")}
        <strong>${escapeHTML(match.home)}</strong>
      </div>

      <div class="vs">${escapeHTML(match.score)}</div>

      <div>
        ${renderBigTeamIcon(match, "away")}
        <strong>${escapeHTML(match.away)}</strong>
      </div>
    </div>

    <div class="pre-badge">
      ${match.status === "done" ? "✅ FINALIZADO" : "📅 PRÉ-JOGO"}
    </div>
  `;
}

function showHome() {
  document.getElementById("statsPage").classList.add("hidden");
  document.getElementById("homePage").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTab(tab) {
  const views = {
    completas: renderCompletas,
    gols: renderGols,
    escanteios: renderEscanteios,
    cartoes: renderCartoes,
    chutes: renderChutes,
    intervalo: renderIntervalo,
    jogadores: renderJogadores,
    ia: renderIA
  };

  tabContent.innerHTML = views[tab]();
}

function getCurrentHomeName() {
  return selectedMatch ? selectedMatch.home : "Time A";
}

function getCurrentAwayName() {
  return selectedMatch ? selectedMatch.away : "Time B";
}

function getCurrentHomeShort() {
  return selectedMatch ? selectedMatch.homeShort : "A";
}

function getCurrentAwayShort() {
  return selectedMatch ? selectedMatch.awayShort : "B";
}

function aiHero(title, description, chip1, chip2, chip3) {
  return `
    <section class="hero">
      <div>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>

      <div class="hero-chip">
        <span>${chip1[0]}</span>
        <strong>${chip1[1]}</strong>
      </div>

      <div class="hero-chip">
        <span>${chip2[0]}</span>
        <strong>${chip2[1]}</strong>
      </div>

      <div class="hero-chip">
        <span>${chip3[0]}</span>
        <strong>${chip3[1]}</strong>
      </div>
    </section>
  `;
}

function heatRows(rows) {
  return rows.map(function(row) {
    return `
      <tr>
        <td>${row[0]}</td>
        <td class="${row[2]}">${row[1]}</td>
        <td class="${row[4]}">${row[3]}</td>
        <td class="${row[6] || row[4]}">${row[5] || "-"}</td>
      </tr>
    `;
  }).join("");
}

function simpleHeatRows(rows) {
  return rows.map(function(row) {
    return `
      <tr>
        <td>${row[0]}</td>
        <td class="${row[2]}">${row[1]}</td>
        <td class="${row[4]}">${row[3]}</td>
      </tr>
    `;
  }).join("");
}

function marketTable(rows) {
  return `
    <table class="heat-table">
      <thead>
        <tr>
          <th>Mercado</th>
          <th>${escapeHTML(getCurrentHomeShort())}</th>
          <th>${escapeHTML(getCurrentAwayShort())}</th>
          <th>Média</th>
        </tr>
      </thead>
      <tbody>${heatRows(rows)}</tbody>
    </table>
  `;
}

function simpleMarketTable(rows) {
  return `
    <table class="heat-table">
      <thead>
        <tr>
          <th>Indicador</th>
          <th>${escapeHTML(getCurrentHomeShort())}</th>
          <th>${escapeHTML(getCurrentAwayShort())}</th>
        </tr>
      </thead>
      <tbody>${simpleHeatRows(rows)}</tbody>
    </table>
  `;
}

function teamProgress(short, name, value, width, red) {
  return `
    <div class="team-row">
      <div class="small-badge">${escapeHTML(short)}</div>

      <div>
        <strong>${escapeHTML(name)}</strong>
        <div class="progress ${red ? "red" : ""}">
          <span style="width:${width}%;"></span>
        </div>
        <p class="small-note">${escapeHTML(value)}</p>
      </div>

      <b class="${red ? "red" : ""}">${value.includes("%") ? escapeHTML(value) : width + "%"}</b>
    </div>
  `;
}

function renderCompletas() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();
  const homeShort = getCurrentHomeShort();
  const awayShort = getCurrentAwayShort();

  return `
    <section class="ai-strip">
      <h2 class="section-title">✦ Insights da IA</h2>

      <div class="ai-grid">
        <article class="ai-card">
          <div class="ai-icon">🎯</div>
          <div>
            <span>Mercado com mais valor</span>
            <strong>Over 1.5 Gols · em análise</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">📈</div>
          <div>
            <span>Tendência do jogo</span>
            <strong>Pré-análise disponível</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">⚠️</div>
          <div>
            <span>Atenção</span>
            <strong>Dados completos entram na próxima etapa</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">🛡️</div>
          <div>
            <span>Status</span>
            <strong>Partida via API</strong>
          </div>
        </article>
      </div>
    </section>

    <section class="grid-3">
      <article class="card">
        <h2>⚖️ Odds Market</h2>

        <table class="table">
          <thead>
            <tr>
              <th>Mercado</th>
              <th>Odds</th>
              <th>Estat.</th>
            </tr>
          </thead>

          <tbody>
            <tr><td>${escapeHTML(home)} vence</td><td>${selectedMatch ? selectedMatch.odds[0] : "-"}</td><td>-</td></tr>
            <tr><td>Empate</td><td>${selectedMatch ? selectedMatch.odds[1] : "-"}</td><td>-</td></tr>
            <tr><td>${escapeHTML(away)} vence</td><td>${selectedMatch ? selectedMatch.odds[2] : "-"}</td><td>-</td></tr>
            <tr><td>Over 2.5</td><td>-</td><td>${selectedMatch ? selectedMatch.over25 : "-"}</td></tr>
            <tr><td>BTTS</td><td>-</td><td>${selectedMatch ? selectedMatch.btts : "-"}</td></tr>
          </tbody>
        </table>
      </article>

      <article class="card form-compare">
        <h2>📈 Forma Atual — Quem vence?</h2>

        <div class="form-top">
          <div>
            <div class="big-badge">${escapeHTML(homeShort)}</div>
            <strong>${escapeHTML(home)}</strong><br>
            <span class="rating">-</span>
          </div>

          <div>
            <div class="power-bar equal">
              <span></span>
              <span></span>
            </div>

            <p class="summary-text">
              Dados reais de forma serão conectados na etapa de estatísticas completas.
            </p>
          </div>

          <div>
            <div class="big-badge">${escapeHTML(awayShort)}</div>
            <strong>${escapeHTML(away)}</strong><br>
            <span class="rating">-</span>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>🤝 Head to Head</h2>
        <p class="small-note">
          O histórico entre as equipes será carregado pela API na próxima etapa.
        </p>
        <div class="tile-grid">
          <div class="tile"><strong>-</strong><span>Over 1.5</span><small>pendente</small></div>
          <div class="tile"><strong>-</strong><span>Over 2.5</span><small>pendente</small></div>
          <div class="tile"><strong>-</strong><span>BTTS</span><small>pendente</small></div>
        </div>
      </article>
    </section>
  `;
}

function renderGols() {
  return `
    ${aiHero(
      "Análise de Gols",
      "Leitura focada em gols marcados, gols sofridos, Over/Under, BTTS e distribuição por tempo.",
      ["Mercado sugerido", "Aguardando dados"],
      ["Over 2.5", selectedMatch ? selectedMatch.over25 : "-"],
      ["BTTS", selectedMatch ? selectedMatch.btts : "-"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>⚽ Gols Marcados</h2>
        ${teamProgress(getCurrentHomeShort(), getCurrentHomeName(), "Aguardando dados", "50")}
        ${teamProgress(getCurrentAwayShort(), getCurrentAwayName(), "Aguardando dados", "50")}
      </article>

      <article class="card">
        <h2>📊 Over 2.5 & BTTS Predictions</h2>
        ${marketTable([
          ["Over 0.5", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Over 1.5", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Over 2.5", selectedMatch ? selectedMatch.over25 : "-", "heat-mid", "-", "heat-mid", selectedMatch ? selectedMatch.over25 : "-", "heat-mid"],
          ["BTTS", selectedMatch ? selectedMatch.btts : "-", "heat-mid", "-", "heat-mid", selectedMatch ? selectedMatch.btts : "-", "heat-mid"]
        ])}
      </article>
    </section>
  `;
}

function renderEscanteios() {
  return `
    ${aiHero(
      "Análise de Escanteios",
      "Leitura focada em escanteios totais, escanteios por equipe, linhas Over e comportamento por tempo.",
      ["Média esperada", "Aguardando dados"],
      ["Mercado sugerido", "Aguardando dados"],
      ["Status", "API conectada parcialmente"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🚩 Número de Escanteios</h2>
        <div class="corner-summary">
          <div class="corner-icon">⚑</div>
          <div>
            <strong class="corner-big">-</strong>
            <b>Escanteios / Partida</b>
            <p class="small-note">Dados de escanteios serão conectados na próxima etapa.</p>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>📊 Escanteios Totais</h2>
        ${marketTable([
          ["Over 6", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Over 7", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Over 8", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"]
        ])}
      </article>
    </section>
  `;
}

function renderCartoes() {
  return `
    ${aiHero(
      "Análise de Cartões",
      "Leitura focada em cartões totais, cartões por equipe e comportamento por tempo.",
      ["Média esperada", "Aguardando dados"],
      ["Mercado sugerido", "Aguardando dados"],
      ["Status", "API conectada parcialmente"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🟨🟥 Número de Cartões</h2>
        <div class="cards-summary">
          <div class="cards-icon">
            <span class="red-card"></span>
            <span class="yellow-card"></span>
          </div>
          <div>
            <strong class="cards-big">-</strong>
            <b>Cartões / Partida</b>
            <p class="small-note">Dados de cartões serão conectados na próxima etapa.</p>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>📊 Cartões Totais</h2>
        ${marketTable([
          ["Over 2.5", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Over 3.5", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Over 4.5", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"]
        ])}
      </article>
    </section>
  `;
}

function renderChutes() {
  return `
    ${aiHero(
      "Análise de Chutes",
      "Leitura de volume ofensivo, chutes por equipe, chutes no alvo, impedimentos, faltas e posse.",
      ["Volume médio", "Aguardando dados"],
      ["Mercado sugerido", "Aguardando dados"],
      ["Status", "API conectada parcialmente"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🎯 Volume por equipe</h2>
        ${teamProgress(getCurrentHomeShort(), getCurrentHomeName(), "Aguardando dados", "50")}
        ${teamProgress(getCurrentAwayShort(), getCurrentAwayName(), "Aguardando dados", "50")}
      </article>

      <article class="card">
        <h2>📊 Chutes por equipe</h2>
        ${marketTable([
          ["Chutes / Jogo", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Chutes no Alvo", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"],
          ["Finalizações", "-", "heat-mid", "-", "heat-mid", "-", "heat-mid"]
        ])}
      </article>
    </section>
  `;
}

function renderIntervalo() {
  return `
    ${aiHero(
      "Análise de Intervalo",
      "Leitura de 1º tempo e 2º tempo com foco em forma HT, cartões por tempo e tendência após o intervalo.",
      ["Forma HT", "Aguardando dados"],
      ["Melhor tempo", "Aguardando dados"],
      ["Status", "API conectada parcialmente"]
    )}

    <section class="grid-2">
      <article class="card form-compare">
        <h2>⏱️ First / Second Half WDL</h2>
        <p class="small-note">
          Dados de intervalo serão conectados na próxima etapa.
        </p>
      </article>

      <article class="card">
        <h2>📊 Resultado por Tempo</h2>
        ${simpleMarketTable([
          ["Win % 1st Half", "-", "heat-mid", "-", "heat-mid"],
          ["Draw % 1st Half", "-", "heat-mid", "-", "heat-mid"],
          ["Draw % 2nd Half", "-", "heat-mid", "-", "heat-mid"]
        ])}
      </article>
    </section>
  `;
}

function renderJogadores() {
  return `
    ${aiHero(
      "Análise de Jogadores",
      "Leitura individual para jogadores com maior chance de marcar e média de cartões por 90 minutos.",
      ["Principal jogador", "Aguardando dados"],
      ["Cartões / 90", "Aguardando dados"],
      ["Status", "API conectada parcialmente"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>⚽ Quem pode marcar? — ${escapeHTML(getCurrentHomeName())}</h2>
        <p class="small-note">Dados de jogadores serão conectados na próxima etapa.</p>
      </article>

      <article class="card">
        <h2>🟨 Cartões / 90 — ${escapeHTML(getCurrentAwayName())}</h2>
        <p class="small-note">Dados de jogadores serão conectados na próxima etapa.</p>
      </article>
    </section>
  `;
}

function renderIA() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  return `
    ${aiHero(
      "IA / Tendências",
      "Resumo inteligente da partida, análise complementar, leitura de mercado e tendências individuais das equipes quando disponíveis.",
      ["Partida", `${escapeHTML(home)} x ${escapeHTML(away)}`],
      ["Status", "Aguardando estatísticas"],
      ["Fonte", "API"]
    )}

    <section id="iaRoot">
      <section class="ia-layout">
        <div class="stack">
          <article class="card">
            <div class="card-header">
              <div>
                <h2>🧠 Resumo das estatísticas da IA</h2>
                <p class="card-subtitle">
                  Esta área será preenchida quando conectarmos os dados completos da partida.
                </p>
              </div>
              <span class="badge">Resumo IA</span>
            </div>

            <div class="summary-text">
              <p>
                A partida selecionada é <strong>${escapeHTML(home)} x ${escapeHTML(away)}</strong>.
                A listagem de jogos já vem da API. Agora falta conectar os endpoints específicos
                de estatísticas, tendências e jogadores.
              </p>
            </div>
          </article>

          <article class="card">
            <div class="card-header">
              <div>
                <h2>📋 Análise de acessórios</h2>
                <p class="card-subtitle">
                  Histórico, confronto direto e dados complementares entram na próxima etapa.
                </p>
              </div>
              <span class="badge">Pendente</span>
            </div>

            <p class="small-note">
              Nenhuma análise complementar carregada para esta partida ainda.
            </p>
          </article>
        </div>

        <aside class="stack">
          <article class="card">
            <h2>🎯 Opções de aposta</h2>
            <p class="small-note">
              As sugestões serão exibidas depois que conectarmos os dados completos da partida.
            </p>
          </article>
        </aside>
      </section>
    </section>
  `;
}

function playerList(players) {
  return `
    <div class="player-list">
      ${players.map(function(player) {
        return `
          <div class="player-row">
            <div class="player-name" style="--bar:${player[2]}%;">
              <span>${player[0]}</span>
            </div>
            <strong>${player[1]}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function goalsMinuteTable() {
  return `
    <table class="heat-table">
      <thead>
        <tr>
          <th>Intervalo</th>
          <th>${escapeHTML(getCurrentHomeShort())}</th>
          <th>${escapeHTML(getCurrentAwayShort())}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>0 - 15</td><td class="heat-mid">-</td><td class="heat-mid">-</td></tr>
        <tr><td>16 - 30</td><td class="heat-mid">-</td><td class="heat-mid">-</td></tr>
        <tr><td>31 - 45</td><td class="heat-mid">-</td><td class="heat-mid">-</td></tr>
      </tbody>
    </table>
  `;
}

function getTodayISO() {
  return toISODate(new Date());
}

function parseISODate(value) {
  const parts = String(value).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  return new Date(year, month, day);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

function formatFullDate(date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

initDateNavigation();
loadMatchesByDate(selectedDate);
