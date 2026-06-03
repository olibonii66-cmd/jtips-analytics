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

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  if (clean.startsWith("//")) {
    return `https:${clean}`;
  }

  if (clean.startsWith("/img/")) {
    return `https://cdn.footystats.org${clean}`;
  }

  if (clean.startsWith("img/")) {
    return `https://cdn.footystats.org/${clean}`;
  }

  if (clean.startsWith("/teams/")) {
    return `https://cdn.footystats.org/img${clean}`;
  }

  if (clean.startsWith("teams/")) {
    return `https://cdn.footystats.org/img/${clean}`;
  }

  return `https://cdn.footystats.org/img/${clean.replace(/^\/+/, "")}`;
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

  renderTab("dadosapi");

  tabButtons.forEach(function(item) {
    item.classList.toggle("active", item.dataset.tab === "dadosapi");
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

function renderDadosApi() {
  const raw = selectedMatch ? selectedMatch.raw : null;

  if (!raw) {
    return `
      <article class="card">
        <h2>Nenhum dado carregado</h2>
        <p class="small-note">Volte para a lista e selecione uma partida.</p>
      </article>
    `;
  }

  const groups = buildApiGroups(raw);
  const keys = Object.keys(raw || {});

  return `
    ${aiHero(
      "Dados API",
      "Mapa completo dos campos retornados pela API para esta partida. Use esta tela para escolher quais dados entram em cada aba.",
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
        Dica: pesquise por <strong>goal</strong>, <strong>corner</strong>, <strong>card</strong>, <strong>shot</strong>,
        <strong>odds</strong>, <strong>xg</strong>, <strong>team</strong>, <strong>image</strong>.
      </small>
      <div>
        <span class="api-badge">Total: ${keys.length}</span>
        <span class="api-badge">Gols: ${groups.gols.length}</span>
        <span class="api-badge">Odds: ${groups.odds.length}</span>
        <span class="api-badge">Escanteios: ${groups.escanteios.length}</span>
        <span class="api-badge">Cartões: ${groups.cartoes.length}</span>
        <span class="api-badge">Chutes: ${groups.chutes.length}</span>
      </div>
    </section>

    <section class="api-grid">
      ${renderApiGroup("⚽ Gols / Placar / BTTS / Over", groups.gols)}
      ${renderApiGroup("💰 Odds / Mercado", groups.odds)}
      ${renderApiGroup("🚩 Escanteios", groups.escanteios)}
      ${renderApiGroup("🟨 Cartões / Faltas", groups.cartoes)}
      ${renderApiGroup("🎯 Chutes / Ataque", groups.chutes)}
      ${renderApiGroup("🏟️ Times / Liga / Imagens", groups.times)}
      ${renderApiGroup("⏱️ Status / Data / Tempo", groups.status)}
      ${renderApiGroup("📦 Outros campos", groups.outros)}

      <article class="api-card">
        <h3>🧾 JSON bruto completo</h3>
        <pre class="raw-json">${escapeHTML(JSON.stringify(raw, null, 2))}</pre>
      </article>
    </section>
  `;
}

function buildApiGroups(raw) {
  const entries = Object.keys(raw || {}).map(function(key) {
    return {
      key,
      value: raw[key]
    };
  });

  const groups = {
    gols: [],
    odds: [],
    escanteios: [],
    cartoes: [],
    chutes: [],
    times: [],
    status: [],
    outros: []
  };

  entries.forEach(function(entry) {
    const key = entry.key.toLowerCase();

    if (
      key.includes("goal") ||
      key.includes("gols") ||
      key.includes("btts") ||
      key.includes("over") ||
      key.includes("under") ||
      key.includes("xg") ||
      key.includes("score")
    ) {
      groups.gols.push(entry);
      return;
    }

    if (
      key.includes("odd") ||
      key.includes("market") ||
      key.includes("probability") ||
      key.includes("potential") ||
      key.includes("prediction")
    ) {
      groups.odds.push(entry);
      return;
    }

    if (
      key.includes("corner") ||
      key.includes("corners")
    ) {
      groups.escanteios.push(entry);
      return;
    }

    if (
      key.includes("card") ||
      key.includes("cards") ||
      key.includes("yellow") ||
      key.includes("red") ||
      key.includes("foul") ||
      key.includes("booking")
    ) {
      groups.cartoes.push(entry);
      return;
    }

    if (
      key.includes("shot") ||
      key.includes("shots") ||
      key.includes("attack") ||
      key.includes("dangerous") ||
      key.includes("possession") ||
      key.includes("offside")
    ) {
      groups.chutes.push(entry);
      return;
    }

    if (
      key.includes("team") ||
      key.includes("home") ||
      key.includes("away") ||
      key.includes("league") ||
      key.includes("season") ||
      key.includes("competition") ||
      key.includes("country") ||
      key.includes("image") ||
      key.includes("logo") ||
      key.includes("badge")
    ) {
      groups.times.push(entry);
      return;
    }

    if (
      key.includes("date") ||
      key.includes("time") ||
      key.includes("status") ||
      key.includes("minute") ||
      key.includes("unix") ||
      key.includes("timestamp")
    ) {
      groups.status.push(entry);
      return;
    }

    groups.outros.push(entry);
  });

  return groups;
}

function renderApiGroup(title, entries) {
  if (!entries.length) {
    return `
      <article class="api-card">
        <h3>${escapeHTML(title)}</h3>
        <div class="api-empty">Nenhum campo encontrado nesta categoria.</div>
      </article>
    `;
  }

  return `
    <article class="api-card">
      <h3>${escapeHTML(title)} · ${entries.length}</h3>

      <table class="api-table">
        <tbody>
          ${entries.map(function(entry) {
            return `
              <tr class="api-row" data-key="${escapeHTML(entry.key.toLowerCase())}" data-value="${escapeHTML(formatApiValue(entry.value).toLowerCase())}">
                <th>${escapeHTML(entry.key)}</th>
                <td>${escapeHTML(formatApiValue(entry.value))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </article>
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

function renderCompletas() {
  const home = getCurrentHomeName();
  const away = getCurrentAwayName();

  return `
    <section class="ai-strip">
      <h2 class="section-title">✦ Insights da IA</h2>

      <div class="ai-grid">
        <article class="ai-card">
          <div class="ai-icon">🎯</div>
          <div>
            <span>Mercado com mais valor</span>
            <strong>Em mapeamento</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">📈</div>
          <div>
            <span>Tendência do jogo</span>
            <strong>Usar aba Dados API</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">⚠️</div>
          <div>
            <span>Status</span>
            <strong>Conectando campos reais</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">🛡️</div>
          <div>
            <span>Partida</span>
            <strong>${escapeHTML(home)} x ${escapeHTML(away)}</strong>
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

      <article class="card">
        <h2>📈 Próximo passo</h2>
        <p class="small-note">
          Usaremos a aba Dados API para mapear todos os campos reais antes de preencher esta aba.
        </p>
      </article>

      <article class="card">
        <h2>🤝 Head to Head</h2>
        <p class="small-note">
          O histórico entre as equipes será carregado depois do mapeamento completo.
        </p>
      </article>
    </section>
  `;
}

function renderGols() {
  return basicTab(
    "Análise de Gols",
    "Leitura focada em gols marcados, gols sofridos, Over/Under, BTTS e distribuição por tempo."
  );
}

function renderEscanteios() {
  return basicTab(
    "Análise de Escanteios",
    "Leitura focada em escanteios totais, escanteios por equipe, linhas Over e comportamento por tempo."
  );
}

function renderCartoes() {
  return basicTab(
    "Análise de Cartões",
    "Leitura focada em cartões totais, cartões por equipe e comportamento por tempo."
  );
}

function renderChutes() {
  return basicTab(
    "Análise de Chutes",
    "Leitura de volume ofensivo, chutes por equipe, chutes no alvo, impedimentos, faltas e posse."
  );
}

function renderIntervalo() {
  return basicTab(
    "Análise de Intervalo",
    "Leitura de 1º tempo e 2º tempo com foco em forma HT, cartões por tempo e tendência após o intervalo."
  );
}

function renderJogadores() {
  return basicTab(
    "Análise de Jogadores",
    "Leitura individual para jogadores com maior chance de marcar e média de cartões por 90 minutos."
  );
}

function renderIA() {
  return basicTab(
    "IA / Tendências",
    "Resumo inteligente da partida, análise complementar, leitura de mercado e tendências individuais das equipes."
  );
}

function basicTab(title, description) {
  return `
    ${aiHero(
      title,
      description,
      ["Partida", `${escapeHTML(getCurrentHomeName())} x ${escapeHTML(getCurrentAwayName())}`],
      ["Status", "Aguardando mapeamento"],
      ["Fonte", "API"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>${escapeHTML(title)}</h2>
        <p class="small-note">
          Esta aba será preenchida depois que conferirmos os campos disponíveis em Dados API.
        </p>
      </article>

      <article class="card">
        <h2>📌 Próximo passo</h2>
        <p class="small-note">
          Abrir a aba Dados API, pesquisar os campos e mapear para esta categoria.
        </p>
      </article>
    </section>
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
