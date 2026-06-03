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

    return { date: iso, label };
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

function extractMatchesFromApi(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.matches)) return raw.matches;
  if (Array.isArray(raw.fixtures)) return raw.fixtures;
  if (raw.data && Array.isArray(raw.data.matches)) return raw.data.matches;

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

  const homeGoals = getNumber(match.homeGoalCount, match.home_goals, match.homeGoals);
  const awayGoals = getNumber(match.awayGoalCount, match.away_goals, match.awayGoals);
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
    const now = Date.now();

    if (matchTime > now) return "pre";
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
    dadosapi: renderDadosApi,
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

/* =========================
   HELPERS DE DADOS DA API
========================= */

function raw() {
  return selectedMatch ? selectedMatch.raw || {} : {};
}

function getValue(keys, fallback = "-") {
  const data = raw();

  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
      return data[key];
    }
  }

  return fallback;
}

function getByIncludes(words, fallback = "-") {
  const data = raw();
  const keys = Object.keys(data);

  const found = keys.find(function(key) {
    const lower = key.toLowerCase();

    return words.every(function(word) {
      return lower.includes(word.toLowerCase());
    });
  });

  if (!found) return fallback;

  const value = data[found];

  if (value === undefined || value === null || value === "") return fallback;

  return value;
}

function getNumber() {
  for (const value of arguments) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);

    if (Number.isFinite(number)) return number;
  }

  return null;
}

function apiNumber(keys, fallback = "-") {
  const value = getValue(keys, fallback);

  if (value === fallback) return fallback;

  const number = Number(value);

  if (!Number.isFinite(number)) return String(value);

  return number % 1 === 0 ? String(number) : number.toFixed(2);
}

function apiPercent(keys, fallback = "-") {
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

function apiText(keys, fallback = "-") {
  const value = getValue(keys, fallback);

  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);

  return String(value);
}

function formatOdd(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return "-";

  return number.toFixed(2);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";

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

function getCurrentHomeShort() {
  return selectedMatch ? selectedMatch.homeShort : "A";
}

function getCurrentAwayShort() {
  return selectedMatch ? selectedMatch.awayShort : "B";
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

/* =========================
   COMPONENTES VISUAIS
========================= */

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
  const text = String(value).replace("%", "");
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

/* =========================
   ABAS COM DADOS REAIS
========================= */

function renderCompletas() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const homeGoals = apiNumber(["homeGoalCount", "home_goals", "homeGoals"]);
  const awayGoals = apiNumber(["awayGoalCount", "away_goals", "awayGoals"]);
  const totalGoals = apiNumber(["totalGoalCount", "total_goals", "goals_total"]);

  const homeXg = apiNumber(["team_a_xg", "home_xg", "xg_home", "homeXG"]);
  const awayXg = apiNumber(["team_b_xg", "away_xg", "xg_away", "awayXG"]);
  const totalXg = apiNumber(["total_xg", "xg_total", "xg"]);

  const homeCorners = apiNumber(["team_a_corners", "home_corners", "homeCornerCount"]);
  const awayCorners = apiNumber(["team_b_corners", "away_corners", "awayCornerCount"]);
  const totalCorners = apiNumber(["totalCornerCount", "total_corners", "cornerCount"]);

  const homeCards = apiNumber(["team_a_cards_num", "home_cards", "homeYellowCards", "home_cards_num"]);
  const awayCards = apiNumber(["team_b_cards_num", "away_cards", "awayYellowCards", "away_cards_num"]);
  const totalCards = apiNumber(["total_cards", "cards_total", "totalCards"]);

  return `
    ${aiHero(
      "Completas",
      "Resumo geral da partida com gols, odds, xG, escanteios, cartões e leitura inicial.",
      ["Partida", `${escapeHTML(home)} x ${escapeHTML(away)}`],
      ["Liga", escapeHTML(getCurrentLeagueName())],
      ["Status", selectedMatch ? selectedMatch.status.toUpperCase() : "-"]
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
            <tr><td>Over 2.5</td><td>${apiNumber(["odds_ft_over25", "odds_over_25", "odds_o25"])}</td><td>${selectedMatch ? selectedMatch.over25 : "-"}</td></tr>
            <tr><td>BTTS</td><td>${apiNumber(["odds_btts_yes", "odds_btts", "btts_odds"])}</td><td>${selectedMatch ? selectedMatch.btts : "-"}</td></tr>
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
          { label: "Status", value: selectedMatch ? selectedMatch.status : "-" }
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
            A partida entre <strong>${escapeHTML(home)}</strong> e <strong>${escapeHTML(away)}</strong>
            terminou com placar <strong>${selectedMatch ? selectedMatch.score : "-"}</strong>.
          </p>
          <p>
            A API informa Over 2.5 em <strong>${selectedMatch ? selectedMatch.over25 : "-"}</strong>
            e BTTS em <strong>${selectedMatch ? selectedMatch.btts : "-"}</strong>.
          </p>
          <p>
            Os demais detalhes ficam distribuídos nas abas Gols, Escanteios, Cartões, Chutes e Intervalo.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderGols() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const homeGoals = apiNumber(["homeGoalCount", "home_goals", "homeGoals"]);
  const awayGoals = apiNumber(["awayGoalCount", "away_goals", "awayGoals"]);
  const totalGoals = apiNumber(["totalGoalCount", "total_goals", "goals_total"]);

  const homeGoalMinutes = apiText(["homeGoals", "home_goal_minutes", "home_goal_times"]);
  const awayGoalMinutes = apiText(["awayGoals", "away_goal_minutes", "away_goal_times"]);

  return `
    ${aiHero(
      "Gols",
      "Dados de gols, Over/Under, BTTS, xG e minutos dos gols retornados pela API.",
      ["Placar", selectedMatch ? selectedMatch.score : "-"],
      ["Over 2.5", selectedMatch ? selectedMatch.over25 : "-"],
      ["BTTS", selectedMatch ? selectedMatch.btts : "-"]
    )}

    <section class="grid-3">
      <article class="card">
        <h2>⚽ Gols marcados</h2>
        ${statCards([
          { label: `${home}`, value: homeGoals },
          { label: `${away}`, value: awayGoals },
          { label: "Total", value: totalGoals }
        ])}
      </article>

      <article class="card">
        <h2>⏱️ Minutos dos gols</h2>
        ${dataTable(
          ["Equipe", "Minutos"],
          [
            [home, homeGoalMinutes],
            [away, awayGoalMinutes]
          ]
        )}
      </article>

      <article class="card">
        <h2>📈 xG</h2>
        ${statCards([
          { label: `${home} xG`, value: apiNumber(["team_a_xg", "home_xg", "xg_home", "homeXG"]) },
          { label: `${away} xG`, value: apiNumber(["team_b_xg", "away_xg", "xg_away", "awayXG"]) },
          { label: "xG total", value: apiNumber(["total_xg", "xg_total", "xg"]) }
        ])}
      </article>
    </section>

    <section class="grid-2">
      ${twoTeamTable("📊 Over / Under / BTTS", [
        ["Over 0.5", apiPercent(["o05_potential", "over05_potential", "over_05_percentage"]), "-", "-"],
        ["Over 1.5", apiPercent(["o15_potential", "over15_potential", "over_15_percentage"]), "-", "-"],
        ["Over 2.5", selectedMatch ? selectedMatch.over25 : "-", "-", "-"],
        ["Over 3.5", apiPercent(["o35_potential", "over35_potential", "over_35_percentage"]), "-", "-"],
        ["BTTS", selectedMatch ? selectedMatch.btts : "-", "-", "-"]
      ])}

      <article class="card">
        <h2>🧠 Insight de gols</h2>
        <div class="summary-text">
          <p>
            Total de gols: <strong>${escapeHTML(totalGoals)}</strong>.
            Over 2.5 informado pela API: <strong>${escapeHTML(selectedMatch ? selectedMatch.over25 : "-")}</strong>.
          </p>
          <p>
            BTTS informado pela API: <strong>${escapeHTML(selectedMatch ? selectedMatch.btts : "-")}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderEscanteios() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const homeCorners = apiNumber(["team_a_corners", "home_corners", "homeCornerCount"]);
  const awayCorners = apiNumber(["team_b_corners", "away_corners", "awayCornerCount"]);
  const totalCorners = apiNumber(["totalCornerCount", "total_corners", "cornerCount"]);

  return `
    ${aiHero(
      "Escanteios",
      "Dados de escanteios totais, escanteios por equipe e linhas de mercado.",
      ["Total", totalCorners],
      [home, homeCorners],
      [away, awayCorners]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🚩 Número de Escanteios</h2>

        <div class="corner-summary">
          <div class="corner-icon">⚑</div>
          <div>
            <strong class="corner-big">${escapeHTML(totalCorners)}</strong>
            <b>Escanteios / Partida</b>
            <p class="small-note">
              ${escapeHTML(home)}: ${escapeHTML(homeCorners)} ·
              ${escapeHTML(away)}: ${escapeHTML(awayCorners)}
            </p>
          </div>
        </div>
      </article>

      ${twoTeamTable("📊 Escanteios por equipe", [
        ["Escanteios", homeCorners, awayCorners, totalCorners],
        ["Escanteios HT", apiNumber(["team_a_corners_ht", "home_corners_ht"]), apiNumber(["team_b_corners_ht", "away_corners_ht"]), apiNumber(["corners_ht", "total_corners_ht"])],
        ["Escanteios 2T", apiNumber(["team_a_corners_2h", "home_corners_2h"]), apiNumber(["team_b_corners_2h", "away_corners_2h"]), apiNumber(["corners_2h", "total_corners_2h"])]
      ])}
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📈 Linhas de escanteios</h2>
        ${dataTable(
          ["Mercado", "Valor"],
          [
            ["Over 6.5", apiPercent(["corners_o65_potential", "corner_o65_potential", "over65_corners"])],
            ["Over 7.5", apiPercent(["corners_o75_potential", "corner_o75_potential", "over75_corners"])],
            ["Over 8.5", apiPercent(["corners_o85_potential", "corner_o85_potential", "over85_corners"])],
            ["Over 9.5", apiPercent(["corners_o95_potential", "corner_o95_potential", "over95_corners"])],
            ["Over 10.5", apiPercent(["corners_o105_potential", "corner_o105_potential", "over105_corners"])]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight de escanteios</h2>
        <div class="summary-text">
          <p>
            Total de escanteios encontrado: <strong>${escapeHTML(totalCorners)}</strong>.
          </p>
          <p>
            ${escapeHTML(home)} teve <strong>${escapeHTML(homeCorners)}</strong> escanteios,
            enquanto ${escapeHTML(away)} teve <strong>${escapeHTML(awayCorners)}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderCartoes() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const homeCards = apiNumber(["team_a_cards_num", "home_cards", "homeYellowCards", "home_cards_num"]);
  const awayCards = apiNumber(["team_b_cards_num", "away_cards", "awayYellowCards", "away_cards_num"]);
  const totalCards = apiNumber(["total_cards", "cards_total", "totalCards"]);

  return `
    ${aiHero(
      "Cartões",
      "Dados de cartões, faltas e disciplina da partida.",
      ["Total cartões", totalCards],
      [home, homeCards],
      [away, awayCards]
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
            <strong class="cards-big">${escapeHTML(totalCards)}</strong>
            <b>Cartões / Partida</b>
            <p class="small-note">
              ${escapeHTML(home)}: ${escapeHTML(homeCards)} ·
              ${escapeHTML(away)}: ${escapeHTML(awayCards)}
            </p>
          </div>
        </div>
      </article>

      ${twoTeamTable("📊 Cartões por equipe", [
        ["Cartões", homeCards, awayCards, totalCards],
        ["Amarelos", apiNumber(["team_a_yellow_cards", "homeYellowCards"]), apiNumber(["team_b_yellow_cards", "awayYellowCards"]), apiNumber(["yellow_cards_total"])],
        ["Vermelhos", apiNumber(["team_a_red_cards", "homeRedCards"]), apiNumber(["team_b_red_cards", "awayRedCards"]), apiNumber(["red_cards_total"])],
        ["Faltas", apiNumber(["team_a_fouls", "home_fouls"]), apiNumber(["team_b_fouls", "away_fouls"]), apiNumber(["total_fouls", "fouls_total"])]
      ])}
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📈 Linhas de cartões</h2>
        ${dataTable(
          ["Mercado", "Valor"],
          [
            ["Over 2.5", apiPercent(["cards_o25_potential", "over25_cards"])],
            ["Over 3.5", apiPercent(["cards_o35_potential", "over35_cards"])],
            ["Over 4.5", apiPercent(["cards_o45_potential", "over45_cards"])],
            ["Over 5.5", apiPercent(["cards_o55_potential", "over55_cards"])],
            ["Over 6.5", apiPercent(["cards_o65_potential", "over65_cards"])]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight de cartões</h2>
        <div class="summary-text">
          <p>
            Total de cartões encontrado: <strong>${escapeHTML(totalCards)}</strong>.
          </p>
          <p>
            ${escapeHTML(home)} recebeu <strong>${escapeHTML(homeCards)}</strong> cartões,
            e ${escapeHTML(away)} recebeu <strong>${escapeHTML(awayCards)}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderChutes() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const homeShots = apiNumber(["team_a_shots", "home_shots", "homeTotalShots"]);
  const awayShots = apiNumber(["team_b_shots", "away_shots", "awayTotalShots"]);
  const totalShots = apiNumber(["total_shots", "shots_total", "match_shots"]);

  const homeSot = apiNumber(["team_a_shotsOnTarget", "team_a_shots_on_target", "home_shots_on_target"]);
  const awaySot = apiNumber(["team_b_shotsOnTarget", "team_b_shots_on_target", "away_shots_on_target"]);
  const totalSot = apiNumber(["shots_on_target_total", "total_shots_on_target"]);

  return `
    ${aiHero(
      "Chutes",
      "Dados de finalizações, chutes no alvo, posse e volume ofensivo.",
      ["Chutes totais", totalShots],
      [home, homeShots],
      [away, awayShots]
    )}

    <section class="grid-2">
      ${twoTeamTable("🎯 Chutes e finalizações", [
        ["Chutes totais", homeShots, awayShots, totalShots],
        ["Chutes no alvo", homeSot, awaySot, totalSot],
        ["Chutes fora", apiNumber(["team_a_shots_off_target", "home_shots_off_target"]), apiNumber(["team_b_shots_off_target", "away_shots_off_target"]), apiNumber(["total_shots_off_target"])],
        ["Ataques perigosos", apiNumber(["team_a_dangerous_attacks", "home_dangerous_attacks"]), apiNumber(["team_b_dangerous_attacks", "away_dangerous_attacks"]), "-"],
        ["Posse", apiPercent(["team_a_possession", "home_possession"]), apiPercent(["team_b_possession", "away_possession"]), "-"]
      ])}

      <article class="card">
        <h2>📌 Resumo ofensivo</h2>
        ${statCards([
          { label: `${home} chutes`, value: homeShots },
          { label: `${away} chutes`, value: awayShots },
          { label: "Total chutes", value: totalShots },
          { label: `${home} no alvo`, value: homeSot },
          { label: `${away} no alvo`, value: awaySot },
          { label: "Total no alvo", value: totalSot }
        ])}
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📈 Linhas de chutes</h2>
        ${dataTable(
          ["Mercado", "Valor"],
          [
            ["Over 20.5 chutes", apiPercent(["shots_o205_potential", "over205_shots"])],
            ["Over 22.5 chutes", apiPercent(["shots_o225_potential", "over225_shots"])],
            ["Over 24.5 chutes", apiPercent(["shots_o245_potential", "over245_shots"])],
            ["Over 7.5 no alvo", apiPercent(["sot_o75_potential", "shots_on_target_o75"])],
            ["Over 8.5 no alvo", apiPercent(["sot_o85_potential", "shots_on_target_o85"])]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight de chutes</h2>
        <div class="summary-text">
          <p>
            Volume total de chutes: <strong>${escapeHTML(totalShots)}</strong>.
          </p>
          <p>
            Chutes no alvo totais: <strong>${escapeHTML(totalSot)}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderIntervalo() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const htHomeGoals = apiNumber(["half_time_home_goals", "ht_home_goals", "homeGoalCountHT", "home_goals_ht"]);
  const htAwayGoals = apiNumber(["half_time_away_goals", "ht_away_goals", "awayGoalCountHT", "away_goals_ht"]);
  const htTotalGoals = apiNumber(["half_time_total_goals", "ht_total_goals", "total_goals_ht"]);

  return `
    ${aiHero(
      "Intervalo",
      "Dados do primeiro tempo, segundo tempo, gols por período e placar HT.",
      ["HT", `${htHomeGoals} - ${htAwayGoals}`],
      ["Gols HT", htTotalGoals],
      ["FT", selectedMatch ? selectedMatch.score : "-"]
    )}

    <section class="grid-2">
      ${twoTeamTable("⏱️ Primeiro tempo", [
        ["Gols HT", htHomeGoals, htAwayGoals, htTotalGoals],
        ["Escanteios HT", apiNumber(["team_a_corners_ht", "home_corners_ht"]), apiNumber(["team_b_corners_ht", "away_corners_ht"]), apiNumber(["total_corners_ht"])],
        ["Cartões HT", apiNumber(["team_a_cards_ht", "home_cards_ht"]), apiNumber(["team_b_cards_ht", "away_cards_ht"]), apiNumber(["total_cards_ht"])],
        ["Chutes HT", apiNumber(["team_a_shots_ht", "home_shots_ht"]), apiNumber(["team_b_shots_ht", "away_shots_ht"]), apiNumber(["total_shots_ht"])]
      ])}

      ${twoTeamTable("⏱️ Segundo tempo", [
        ["Gols 2T", apiNumber(["second_half_home_goals", "home_goals_2h"]), apiNumber(["second_half_away_goals", "away_goals_2h"]), apiNumber(["second_half_total_goals", "total_goals_2h"])],
        ["Escanteios 2T", apiNumber(["team_a_corners_2h", "home_corners_2h"]), apiNumber(["team_b_corners_2h", "away_corners_2h"]), apiNumber(["total_corners_2h"])],
        ["Cartões 2T", apiNumber(["team_a_cards_2h", "home_cards_2h"]), apiNumber(["team_b_cards_2h", "away_cards_2h"]), apiNumber(["total_cards_2h"])],
        ["Chutes 2T", apiNumber(["team_a_shots_2h", "home_shots_2h"]), apiNumber(["team_b_shots_2h", "away_shots_2h"]), apiNumber(["total_shots_2h"])]
      ])}
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>⚽ Minutos dos gols</h2>
        ${dataTable(
          ["Equipe", "Minutos"],
          [
            [home, apiText(["homeGoals", "home_goal_minutes", "home_goal_times"])],
            [away, apiText(["awayGoals", "away_goal_minutes", "away_goal_times"])]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight intervalo</h2>
        <div class="summary-text">
          <p>
            Placar no intervalo encontrado: <strong>${escapeHTML(htHomeGoals)} - ${escapeHTML(htAwayGoals)}</strong>.
          </p>
          <p>
            Placar final: <strong>${selectedMatch ? selectedMatch.score : "-"}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderJogadores() {
  const playerEntries = Object.keys(raw())
    .filter(function(key) {
      const lower = key.toLowerCase();
      return (
        lower.includes("player") ||
        lower.includes("scorer") ||
        lower.includes("assist") ||
        lower.includes("lineup") ||
        lower.includes("substitution")
      );
    })
    .map(function(key) {
      return [key, apiText([key])];
    });

  return `
    ${aiHero(
      "Jogadores",
      "Dados de jogadores, artilheiros, assistências e eventos individuais quando disponíveis na API.",
      ["Campos jogadores", String(playerEntries.length)],
      ["Mandante", getCurrentHomeName()],
      ["Visitante", getCurrentAwayName()]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>⚽ Jogadores / Artilheiros</h2>
        ${
          playerEntries.length
            ? dataTable(["Campo", "Valor"], playerEntries)
            : `<p class="small-note">A API não retornou campos de jogadores neste endpoint para esta partida.</p>`
        }
      </article>

      <article class="card">
        <h2>📌 Observação</h2>
        <p class="small-note">
          Se a API tiver endpoint específico de lineups, escalações ou jogadores, conectamos depois.
          Neste momento esta aba lê apenas os campos disponíveis no objeto da partida.
        </p>
      </article>
    </section>
  `;
}

function renderIA() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  const totalGoals = apiNumber(["totalGoalCount", "total_goals", "goals_total"]);
  const totalCorners = apiNumber(["totalCornerCount", "total_corners", "cornerCount"]);
  const totalCards = apiNumber(["total_cards", "cards_total", "totalCards"]);
  const totalShots = apiNumber(["total_shots", "shots_total", "match_shots"]);

  return `
    ${aiHero(
      "IA / Tendências",
      "Resumo automático usando os dados reais retornados pela API.",
      ["Partida", `${escapeHTML(home)} x ${escapeHTML(away)}`],
      ["Placar", selectedMatch ? selectedMatch.score : "-"],
      ["Fonte", "API"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🧠 Resumo automático</h2>

        <div class="summary-text">
          <p>
            ${escapeHTML(home)} enfrentou ${escapeHTML(away)} pela competição
            <strong>${escapeHTML(getCurrentLeagueName())}</strong>.
          </p>

          <p>
            O placar registrado foi <strong>${selectedMatch ? selectedMatch.score : "-"}</strong>,
            com <strong>${escapeHTML(totalGoals)}</strong> gols no total.
          </p>

          <p>
            A partida teve <strong>${escapeHTML(totalCorners)}</strong> escanteios,
            <strong>${escapeHTML(totalCards)}</strong> cartões e
            <strong>${escapeHTML(totalShots)}</strong> chutes, quando esses campos estão disponíveis na API.
          </p>

          <p>
            Mercado Over 2.5: <strong>${selectedMatch ? selectedMatch.over25 : "-"}</strong>.
            BTTS: <strong>${selectedMatch ? selectedMatch.btts : "-"}</strong>.
          </p>
        </div>
      </article>

      <article class="card">
        <h2>🎯 Leitura de mercado</h2>

        ${statCards([
          { label: "Over 2.5", value: selectedMatch ? selectedMatch.over25 : "-" },
          { label: "BTTS", value: selectedMatch ? selectedMatch.btts : "-" },
          { label: "Odd casa", value: selectedMatch ? selectedMatch.odds[0] : "-" },
          { label: "Odd empate", value: selectedMatch ? selectedMatch.odds[1] : "-" },
          { label: "Odd fora", value: selectedMatch ? selectedMatch.odds[2] : "-" },
          { label: "Status", value: selectedMatch ? selectedMatch.status : "-" }
        ])}
      </article>
    </section>
  `;
}

/* =========================
   ABA DEBUG DADOS API
========================= */

function renderDadosApi() {
  const data = raw();

  if (!data || !Object.keys(data).length) {
    return `
      <article class="card">
        <h2>Nenhum dado carregado</h2>
        <p class="small-note">Volte para a lista e selecione uma partida.</p>
      </article>
    `;
  }

  const keys = Object.keys(data);

  return `
    ${aiHero(
      "Dados API",
      "Mapa completo dos campos retornados pela API para esta partida.",
      ["Campos recebidos", String(keys.length)],
      ["Partida", `${escapeHTML(getCurrentHomeName())} x ${escapeHTML(getCurrentAwayName())}`],
      ["Status", "Auditoria"]
    )}

    <section class="api-toolbar">
      <input
        id="apiSearch"
        type="search"
        placeholder="Filtrar campos da API. Exemplo: corner, card, goal, odds, shots..."
        oninput="filterApiRows(this.value)"
      />
      <small>
        Dica: pesquise por <strong>goal</strong>, <strong>corner</strong>, <strong>card</strong>,
        <strong>shot</strong>, <strong>odds</strong>, <strong>xg</strong>, <strong>team</strong>, <strong>image</strong>.
      </small>
      <div>
        <span class="api-badge">Total: ${keys.length}</span>
      </div>
    </section>

    <section class="api-grid">
      <article class="api-card">
        <h3>🧾 Campos da API</h3>

        <table class="api-table">
          <tbody>
            ${keys.map(function(key) {
              const value = formatApiValue(data[key]);

              return `
                <tr class="api-row" data-key="${escapeHTML(key.toLowerCase())}" data-value="${escapeHTML(value.toLowerCase())}">
                  <th>${escapeHTML(key)}</th>
                  <td>${escapeHTML(value)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </article>

      <article class="api-card">
        <h3>JSON bruto completo</h3>
        <pre class="raw-json">${escapeHTML(JSON.stringify(data, null, 2))}</pre>
      </article>
    </section>
  `;
}

function formatApiValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function filterApiRows(query) {
  const value = String(query || "").toLowerCase().trim();
  const rows = document.querySelectorAll(".api-row");

  rows.forEach(function(row) {
    const text = `${row.dataset.key || ""} ${row.dataset.value || ""}`;
    row.style.display = !value || text.includes(value) ? "" : "none";
  });
}

/* =========================
   DATA / TEXTO
========================= */

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
