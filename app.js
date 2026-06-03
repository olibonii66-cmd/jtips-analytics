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

    if (iso === today) label = "Hoje";
    if (offset === -1 && centerDate === today) label = "Ontem";
    if (offset === 1 && centerDate === today) label = "Amanhã";

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
      <p class="small-note">Buscando partidas de ${formatFullDate(parseISODate(date))}.</p>
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
        <p class="small-note">${escapeHTML(error.message)}</p>
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
      <p class="small-note">Use os botões de data acima para procurar jogos em outro dia.</p>
    </article>
  `;
}

function extractMatchesFromApi(rawData) {
  if (!rawData) return [];

  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData.data)) return rawData.data;
  if (Array.isArray(rawData.matches)) return rawData.matches;
  if (Array.isArray(rawData.fixtures)) return rawData.fixtures;

  if (rawData.data && Array.isArray(rawData.data.matches)) {
    return rawData.data.matches;
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

  const homeGoals = getCleanNumber(
    match.homeGoalCount,
    match.home_goals,
    match.homeGoals
  );

  const awayGoals = getCleanNumber(
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
      formatOdd(match.odds_ft_x || match.odds_ft_X || match.odds_x || match.draw_odds),
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
    raw: match
  };
}

function getTeamLogo(match, side) {
  const rawLogo = side === "home"
    ? (
      match.home_image ||
      match.home_logo ||
      match.homeBadge ||
      match.home_badge ||
      match.team_a_image ||
      match.team_a_logo ||
      match.team_a_badge ||
      ""
    )
    : (
      match.away_image ||
      match.away_logo ||
      match.awayBadge ||
      match.away_badge ||
      match.team_b_image ||
      match.team_b_logo ||
      match.team_b_badge ||
      ""
    );

  return normalizeImageUrl(rawLogo);
}

function normalizeImageUrl(value) {
  if (!value) return "";

  const clean = String(value).trim();

  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
  if (clean.startsWith("//")) return `https:${clean}`;
  if (clean.startsWith("/img/")) return `https://cdn.footystats.org${clean}`;
  if (clean.startsWith("img/")) return `https://cdn.footystats.org/${clean}`;
  if (clean.startsWith("/teams/")) return `https://cdn.footystats.org/img${clean}`;
  if (clean.startsWith("teams/")) return `https://cdn.footystats.org/img/${clean}`;

  return `https://cdn.footystats.org/img/${clean.replace(/^\/+/, "")}`;
}

function getLeagueName(match) {
  if (match.resolved_league_name) return match.resolved_league_name;

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

  if (league && country) return `${country} › ${league}`;
  if (league) return league;

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

    if (matchTime > Date.now()) {
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

function renderTeamIcon(match, side) {
  const logo = side === "home" ? match.homeLogo : match.awayLogo;
  const short = side === "home" ? match.homeShort : match.awayShort;

  if (logo) {
    return `
      <img
        src="${escapeHTML(logo)}"
        alt="${escapeHTML(short)}"
        class="team-logo-inline"
        onerror="this.outerHTML='<span class=&quot;team-badge&quot;>${escapeHTML(short)}</span>'"
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
        class="team-logo-big"
        onerror="this.outerHTML='<div class=&quot;big-badge&quot;>${escapeHTML(short)}</div>'"
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

              <div class="team home-team">
                <span class="team-name">${escapeHTML(match.home)}</span>
                ${renderTeamIcon(match, "home")}
              </div>

              <div class="score">${escapeHTML(match.score)}</div>

              <div class="team away-team">
                ${renderTeamIcon(match, "away")}
                <span class="team-name">${escapeHTML(match.away)}</span>
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

  tabContent.innerHTML = views[tab] ? views[tab]() : renderCompletas();
}

function raw() {
  return selectedMatch ? selectedMatch.raw || {} : {};
}

function getValue(keys, fallback = "-") {
  const data = raw();

  for (const key of keys) {
    if (
      data[key] !== undefined &&
      data[key] !== null &&
      data[key] !== "" &&
      data[key] !== -1 &&
      data[key] !== "-1"
    ) {
      return data[key];
    }
  }

  return fallback;
}

function getCleanNumber() {
  for (const value of arguments) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === -1 ||
      value === "-1"
    ) {
      continue;
    }

    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function getActualNumber(keys, fallback = "-") {
  if (!selectedMatch || selectedMatch.status !== "done") {
    return fallback;
  }

  return getMetricNumber(keys, fallback);
}

function getMetricNumber(keys, fallback = "-") {
  const value = getValue(keys, fallback);

  if (value === fallback) return fallback;

  const number = Number(value);

  if (!Number.isFinite(number)) return String(value);

  return number % 1 === 0 ? String(number) : number.toFixed(2);
}

function getPercent(keys, fallback = "-") {
  const value = getValue(keys, fallback);

  if (value === fallback) return fallback;

  const number = Number(value);

  if (!Number.isFinite(number)) {
    const text = String(value);
    return text.includes("%") ? text : text;
  }

  if (number <= 1) return `${Math.round(number * 100)}%`;

  return `${Math.round(number)}%`;
}

function getText(keys, fallback = "-") {
  const value = getValue(keys, fallback);

  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);

  return String(value);
}

function formatOdd(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === -1 ||
    value === "-1"
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "-";
  }

  return number.toFixed(2);
}

function formatPercent(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === -1 ||
    value === "-1"
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    const text = String(value);
    return text.includes("%") ? text : "-";
  }

  if (number <= 1) return `${Math.round(number * 100)}%`;

  return `${Math.round(number)}%`;
}

function getCurrentHomeName() {
  return selectedMatch ? selectedMatch.home : "Time A";
}

function getCurrentAwayName() {
  return selectedMatch ? selectedMatch.away : "Time B";
}

function getCurrentLeagueName() {
  const data = raw();

  return (
    data.resolved_league_name ||
    data.league_name ||
    data.competition_name ||
    data.season_name ||
    "Liga"
  );
}

function getCurrentStatusLabel() {
  if (!selectedMatch) return "-";
  return selectedMatch.status === "done" ? "Finalizado" : "Pré-jogo";
}

function getScoreOrPredictionLabel() {
  if (!selectedMatch) return "-";
  return selectedMatch.status === "done" ? selectedMatch.score : "Pré-jogo";
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

function statCards(cards) {
  return `
    <div class="stat-cards">
      ${cards.map(function(card) {
        return `
          <div class="stat-card">
            <strong>${escapeHTML(card.value)}</strong>
            <span>${escapeHTML(card.label)}</span>
            <small>${escapeHTML(card.small || "")}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function dataTable(headers, rows) {
  return `
    <table class="heat-table">
      <thead>
        <tr>
          ${headers.map(function(header) {
            return `<th>${escapeHTML(header)}</th>`;
          }).join("")}
        </tr>
      </thead>

      <tbody>
        ${rows.map(function(row) {
          return `
            <tr>
              ${row.map(function(cell, index) {
                return `<td class="${index === 0 ? "" : classifyValue(cell)}">${escapeHTML(String(cell))}</td>`;
              }).join("")}
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function classifyValue(value) {
  const text = String(value).replace("%", "").replace("-", "");
  const number = Number(text);

  if (!Number.isFinite(number)) return "heat-mid";
  if (number >= 60) return "heat-high";
  if (number >= 35) return "heat-mid";
  return "heat-low";
}

function twoTeamTable(title, rows) {
  return `
    <article class="card">
      <h2>${title}</h2>
      ${dataTable(
        ["Indicador", getCurrentHomeName(), getCurrentAwayName(), "Total/Média"],
        rows
      )}
    </article>
  `;
}

function renderCompletas() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const homeGoals = getActualNumber(["homeGoalCount", "home_goals", "homeGoals"]);
  const awayGoals = getActualNumber(["awayGoalCount", "away_goals", "awayGoals"]);
  const totalGoals = getActualNumber(["totalGoalCount", "total_goals", "goals_total"]);

  const homeXg = getMetricNumber(["team_a_xg", "home_xg", "xg_home", "homeXG"]);
  const awayXg = getMetricNumber(["team_b_xg", "away_xg", "xg_away", "awayXG"]);
  const totalXg = getMetricNumber(["total_xg", "xg_total", "xg"]);

  const homeCorners = getActualNumber(["team_a_corners", "home_corners", "homeCornerCount"]);
  const awayCorners = getActualNumber(["team_b_corners", "away_corners", "awayCornerCount"]);
  const totalCorners = getActualNumber(["totalCornerCount", "total_corners", "cornerCount"]);

  const homeCards = getActualNumber(["team_a_cards_num", "home_cards", "homeYellowCards", "home_cards_num"]);
  const awayCards = getActualNumber(["team_b_cards_num", "away_cards", "awayYellowCards", "away_cards_num"]);
  const totalCards = getActualNumber(["total_cards", "cards_total", "totalCards"]);

  return `
    ${aiHero(
      "Completas",
      "Resumo geral da partida com odds, gols, xG, escanteios, cartões e leitura inicial.",
      ["Partida", `${escapeHTML(home)} x ${escapeHTML(away)}`],
      ["Liga", getCurrentLeagueName()],
      ["Status", getCurrentStatusLabel()]
    )}

    <section class="ai-strip">
      <h2 class="section-title">✦ Insights rápidos</h2>

      <div class="ai-grid">
        <article class="ai-card">
          <div class="ai-icon">⚽</div>
          <div>
            <span>Total de gols</span>
            <strong>${escapeHTML(totalGoals)}</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">📊</div>
          <div>
            <span>Over 2.5</span>
            <strong>${escapeHTML(selectedMatch ? selectedMatch.over25 : "-")}</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">🤝</div>
          <div>
            <span>BTTS</span>
            <strong>${escapeHTML(selectedMatch ? selectedMatch.btts : "-")}</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">🚩</div>
          <div>
            <span>Escanteios</span>
            <strong>${escapeHTML(totalCorners)}</strong>
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
            <tr><td>Over 2.5</td><td>${getMetricNumber(["odds_ft_over25", "odds_over_25", "odds_o25"])}</td><td>${selectedMatch ? selectedMatch.over25 : "-"}</td></tr>
            <tr><td>BTTS</td><td>${getMetricNumber(["odds_btts_yes", "odds_btts", "btts_odds"])}</td><td>${selectedMatch ? selectedMatch.btts : "-"}</td></tr>
          </tbody>
        </table>
      </article>

      <article class="card">
        <h2>⚽ Placar e xG</h2>
        ${statCards([
          { label: `${home} gols`, value: homeGoals },
          { label: `${away} gols`, value: awayGoals },
          { label: "Total gols", value: totalGoals },
          { label: `${home} xG`, value: homeXg },
          { label: `${away} xG`, value: awayXg },
          { label: "xG total", value: totalXg }
        ])}
      </article>

      <article class="card">
        <h2>📌 Resumo do jogo</h2>
        ${statCards([
          { label: "Escanteios", value: totalCorners },
          { label: "Cartões", value: totalCards },
          { label: "Over 2.5", value: selectedMatch ? selectedMatch.over25 : "-" },
          { label: "BTTS", value: selectedMatch ? selectedMatch.btts : "-" },
          { label: "Horário", value: selectedMatch ? selectedMatch.time : "-" },
          { label: "Status", value: getCurrentStatusLabel() }
        ])}
      </article>
    </section>

    <section class="grid-2">
      ${twoTeamTable("📊 Comparativo geral", [
        ["Gols", homeGoals, awayGoals, totalGoals],
        ["xG", homeXg, awayXg, totalXg],
        ["Escanteios", homeCorners, awayCorners, totalCorners],
        ["Cartões", homeCards, awayCards, totalCards]
      ])}

      <article class="card">
        <h2>🧠 Leitura automática</h2>
        <div class="summary-text">
          <p>
            Partida: <strong>${escapeHTML(home)} x ${escapeHTML(away)}</strong>.
            Status: <strong>${escapeHTML(getCurrentStatusLabel())}</strong>.
          </p>
          <p>
            Mercado Over 2.5: <strong>${selectedMatch ? selectedMatch.over25 : "-"}</strong>.
            BTTS: <strong>${selectedMatch ? selectedMatch.btts : "-"}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderGols() {
  return renderCompletas();
}

function renderEscanteios() {
  return renderCompletas();
}

function renderCartoes() {
  return renderCompletas();
}

function renderChutes() {
  return renderCompletas();
}

function renderIntervalo() {
  return renderCompletas();
}

function renderJogadores() {
  return renderCompletas();
}

function renderIA() {
  return renderCompletas();
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

initDateNavigation();
loadMatchesByDate(selectedDate);
