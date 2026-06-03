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

/* =========================
   HOME / DATAS
========================= */

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

  const homeGoals = cleanNumber(
    match.homeGoalCount,
    match.home_goals,
    match.homeGoals
  );

  const awayGoals = cleanNumber(
    match.awayGoalCount,
    match.away_goals,
    match.awayGoals
  );

  const status = normalizeStatus(match.status, match.game_status, match);

  return {
    id: String(match.id || match.match_id || `${homeName}-${awayName}-${match.date_unix || ""}`),
    matchId: String(match.id || match.match_id || ""),
    seasonId: String(
      match.competition_id ||
      match.league_id ||
      match.season_id ||
      match.resolved_league_id ||
      ""
    ),
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
    raw: match,
    complete: null
  };
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

/* =========================
   RENDER HOME
========================= */

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

async function showStats(encodedMatchId) {
  const matchId = decodeURIComponent(encodedMatchId);
  const foundMatch = findMatchById(matchId);

  if (!foundMatch) return;

  selectedMatch = foundMatch;

  document.getElementById("homePage").classList.add("hidden");
  document.getElementById("statsPage").classList.remove("hidden");

  tabButtons.forEach(function(item) {
    item.classList.toggle("active", item.dataset.tab === "completas");
  });

  updateMatchHeader(selectedMatch);

  tabContent.innerHTML = `
    <article class="card">
      <h2>Carregando estatísticas completas...</h2>
      <p class="small-note">
        Buscando dados de partida, tabela, times, árbitro, odds e estatísticas avançadas.
      </p>
    </article>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });

  try {
    const seasonId =
      selectedMatch.seasonId ||
      selectedMatch.raw.competition_id ||
      selectedMatch.raw.league_id ||
      selectedMatch.raw.season_id;

    if (!selectedMatch.matchId || !seasonId) {
      throw new Error("Não encontramos match_id ou season_id para carregar a partida completa.");
    }

    const response = await fetch(
      `/api/partida-completa?match_id=${encodeURIComponent(selectedMatch.matchId)}&season_id=${encodeURIComponent(seasonId)}`
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Erro ao carregar partida completa.");
    }

    selectedMatch.complete = payload.data;

    syncSelectedMatchFromComplete();
    updateMatchHeader(selectedMatch);
    renderTab("completas");
  } catch (error) {
    tabContent.innerHTML = `
      <article class="card">
        <h2>⚠️ Não foi possível carregar as estatísticas completas</h2>
        <p class="small-note">${escapeHTML(error.message)}</p>
        <p class="small-note">
          A página continuará usando os dados básicos já carregados na lista de jogos.
        </p>
      </article>
    `;
  }
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

function syncSelectedMatchFromComplete() {
  const data = complete();

  if (!data) return;

  selectedMatch.home = data.teams?.home?.name || selectedMatch.home;
  selectedMatch.away = data.teams?.away?.name || selectedMatch.away;
  selectedMatch.homeLogo = data.teams?.home?.image || selectedMatch.homeLogo;
  selectedMatch.awayLogo = data.teams?.away?.image || selectedMatch.awayLogo;
  selectedMatch.status = data.status?.normalized || selectedMatch.status;

  const hg = data.score?.home_goals;
  const ag = data.score?.away_goals;

  if (hg !== null && hg !== undefined && ag !== null && ag !== undefined && selectedMatch.status === "done") {
    selectedMatch.score = `${hg} - ${ag}`;
  }

  selectedMatch.odds = [
    fmtOdd(data.odds?.result?.home),
    fmtOdd(data.odds?.result?.draw),
    fmtOdd(data.odds?.result?.away)
  ];

  selectedMatch.over25 = pct(data.potentials?.goals?.over25);
  selectedMatch.btts = pct(data.potentials?.btts?.full_time);
}

function updateMatchHeader(match) {
  const header = document.querySelector(".match-header");

  if (!header) return;

  header.innerHTML = `
    <div class="match-meta">
      <strong>Partida selecionada</strong><br>
      ${escapeHTML(formatFullDate(parseISODate(selectedDate)))} · ${escapeHTML(match.time)}<br>
      ${escapeHTML(getLeagueTitle())}
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

/* =========================
   ABAS
========================= */

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

function renderCompletas() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  return `
    ${aiHero(
      "Completas",
      "Resumo geral da partida com placar, xG, odds, escanteios, cartões, finalizações e contexto da tabela.",
      ["Placar", scoreText()],
      ["Over 2.5", pct(data.potentials?.goals?.over25)],
      ["BTTS", pct(data.potentials?.btts?.full_time)]
    )}

    <section class="ai-strip">
      <h2 class="section-title">✦ Insights rápidos</h2>

      <div class="ai-grid">
        ${aiCard("⚽", "Total de gols", val(data.score?.total_goals))}
        ${aiCard("📈", "xG total", val(data.xg?.actual?.total))}
        ${aiCard("🚩", "Escanteios", val(data.corners?.full_time?.total))}
        ${aiCard("🟨", "Cartões", val(data.cards?.full_time?.total))}
      </div>
    </section>

    <section class="grid-3">
      <article class="card">
        <h2>⚖️ Odds principais</h2>
        ${dataTable(
          ["Mercado", "Odd", "Estatística"],
          [
            [`${homeName()} vence`, fmtOdd(data.odds?.result?.home), "-"],
            ["Empate", fmtOdd(data.odds?.result?.draw), "-"],
            [`${awayName()} vence`, fmtOdd(data.odds?.result?.away), "-"],
            ["Over 2.5", fmtOdd(data.odds?.goals?.over25), pct(data.potentials?.goals?.over25)],
            ["BTTS Sim", fmtOdd(data.odds?.btts?.yes), pct(data.potentials?.btts?.full_time)]
          ]
        )}
      </article>

      <article class="card">
        <h2>⚽ Placar e xG</h2>
        ${statCards([
          { label: `${homeName()} gols`, value: val(data.score?.home_goals) },
          { label: `${awayName()} gols`, value: val(data.score?.away_goals) },
          { label: "Total gols", value: val(data.score?.total_goals) },
          { label: `${homeName()} xG`, value: val(data.xg?.actual?.home) },
          { label: `${awayName()} xG`, value: val(data.xg?.actual?.away) },
          { label: "xG total", value: val(data.xg?.actual?.total) }
        ])}
      </article>

      <article class="card">
        <h2>📌 Contexto da tabela</h2>
        ${statCards([
          { label: `${homeName()} posição`, value: val(data.league_table?.home?.position) },
          { label: `${awayName()} posição`, value: val(data.league_table?.away?.position) },
          { label: `${homeName()} pontos`, value: val(data.league_table?.home?.points) },
          { label: `${awayName()} pontos`, value: val(data.league_table?.away?.points) },
          { label: `${homeName()} PPG`, value: val(data.teams?.home?.ppg) },
          { label: `${awayName()} PPG`, value: val(data.teams?.away?.ppg) }
        ])}
      </article>
    </section>

    <section class="grid-2">
      ${twoTeamTable("📊 Comparativo geral", [
        ["Gols", val(data.score?.home_goals), val(data.score?.away_goals), val(data.score?.total_goals)],
        ["xG", val(data.xg?.actual?.home), val(data.xg?.actual?.away), val(data.xg?.actual?.total)],
        ["Escanteios", val(data.corners?.full_time?.home), val(data.corners?.full_time?.away), val(data.corners?.full_time?.total)],
        ["Cartões", val(data.cards?.full_time?.home_total), val(data.cards?.full_time?.away_total), val(data.cards?.full_time?.total)],
        ["Chutes", val(data.shots?.full_time?.home_total), val(data.shots?.full_time?.away_total), val(data.shots?.full_time?.total)]
      ])}

      <article class="card">
        <h2>🧠 Leitura automática</h2>
        <div class="summary-text">
          <p>
            <strong>${escapeHTML(homeName())}</strong> x <strong>${escapeHTML(awayName())}</strong>
            terminou com placar <strong>${escapeHTML(scoreText())}</strong>.
          </p>
          <p>
            O jogo teve <strong>${escapeHTML(val(data.score?.total_goals))}</strong> gols,
            <strong>${escapeHTML(val(data.corners?.full_time?.total))}</strong> escanteios,
            <strong>${escapeHTML(val(data.cards?.full_time?.total))}</strong> cartões e
            <strong>${escapeHTML(val(data.shots?.full_time?.total))}</strong> chutes.
          </p>
          <p>
            Over 2.5: <strong>${escapeHTML(pct(data.potentials?.goals?.over25))}</strong>.
            BTTS: <strong>${escapeHTML(pct(data.potentials?.btts?.full_time))}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderGols() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  return `
    ${aiHero(
      "Gols",
      "Placar, minutos dos gols, xG, Over/Under, BTTS e odds de gols.",
      ["Placar", scoreText()],
      ["xG total", val(data.xg?.actual?.total)],
      ["Over 2.5", pct(data.potentials?.goals?.over25)]
    )}

    <section class="grid-3">
      <article class="card">
        <h2>⚽ Gols marcados</h2>
        ${statCards([
          { label: `${homeName()}`, value: val(data.goals?.full_time?.home) },
          { label: `${awayName()}`, value: val(data.goals?.full_time?.away) },
          { label: "Total", value: val(data.goals?.full_time?.total) },
          { label: "1º tempo", value: val(data.goals?.first_half?.total) },
          { label: "2º tempo", value: val(data.goals?.second_half?.total) },
          { label: "BTTS", value: boolText(data.score?.btts) }
        ])}
      </article>

      <article class="card">
        <h2>⏱️ Minutos dos gols</h2>
        ${dataTable(
          ["Equipe", "Minutos"],
          [
            [homeName(), listValue(data.goals?.timings?.home)],
            [awayName(), listValue(data.goals?.timings?.away)]
          ]
        )}
      </article>

      <article class="card">
        <h2>📈 xG</h2>
        ${statCards([
          { label: `${homeName()} xG`, value: val(data.xg?.actual?.home) },
          { label: `${awayName()} xG`, value: val(data.xg?.actual?.away) },
          { label: "xG total", value: val(data.xg?.actual?.total) },
          { label: `${homeName()} xG pré`, value: val(data.xg?.prematch?.home) },
          { label: `${awayName()} xG pré`, value: val(data.xg?.prematch?.away) },
          { label: "xG pré total", value: val(data.xg?.prematch?.total) }
        ])}
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📊 Over / Under</h2>
        ${dataTable(
          ["Mercado", "Resultado", "Potencial", "Odd"],
          [
            ["Over 0.5", boolText(data.score?.over05), pct(data.potentials?.goals?.over05), fmtOdd(data.odds?.goals?.over05)],
            ["Over 1.5", boolText(data.score?.over15), pct(data.potentials?.goals?.over15), fmtOdd(data.odds?.goals?.over15)],
            ["Over 2.5", boolText(data.score?.over25), pct(data.potentials?.goals?.over25), fmtOdd(data.odds?.goals?.over25)],
            ["Over 3.5", boolText(data.score?.over35), pct(data.potentials?.goals?.over35), fmtOdd(data.odds?.goals?.over35)],
            ["Over 4.5", boolText(data.score?.over45), pct(data.potentials?.goals?.over45), fmtOdd(data.odds?.goals?.over45)],
            ["BTTS", boolText(data.score?.btts), pct(data.potentials?.btts?.full_time), fmtOdd(data.odds?.btts?.yes)]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight de gols</h2>
        <div class="summary-text">
          <p>
            O placar teve <strong>${escapeHTML(val(data.score?.total_goals))}</strong> gols.
            O xG total foi <strong>${escapeHTML(val(data.xg?.actual?.total))}</strong>.
          </p>
          <p>
            Potencial Over 2.5: <strong>${escapeHTML(pct(data.potentials?.goals?.over25))}</strong>.
            BTTS: <strong>${escapeHTML(pct(data.potentials?.btts?.full_time))}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderEscanteios() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  return `
    ${aiHero(
      "Escanteios",
      "Escanteios por equipe, por tempo, odds e potenciais de linhas.",
      ["Total", val(data.corners?.full_time?.total)],
      [homeName(), val(data.corners?.full_time?.home)],
      [awayName(), val(data.corners?.full_time?.away)]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🚩 Número de Escanteios</h2>
        <div class="corner-summary">
          <div class="corner-icon">⚑</div>
          <div>
            <strong class="corner-big">${escapeHTML(val(data.corners?.full_time?.total))}</strong>
            <b>Escanteios / Partida</b>
            <p class="small-note">
              ${escapeHTML(homeName())}: ${escapeHTML(val(data.corners?.full_time?.home))} ·
              ${escapeHTML(awayName())}: ${escapeHTML(val(data.corners?.full_time?.away))}
            </p>
          </div>
        </div>
      </article>

      ${twoTeamTable("📊 Escanteios por tempo", [
        ["Total", val(data.corners?.full_time?.home), val(data.corners?.full_time?.away), val(data.corners?.full_time?.total)],
        ["1º tempo", val(data.corners?.first_half?.home), val(data.corners?.first_half?.away), val(data.corners?.first_half?.total)],
        ["2º tempo", val(data.corners?.second_half?.home), val(data.corners?.second_half?.away), val(data.corners?.second_half?.total)],
        ["0-10 min", val(data.corners?.timings?.home_0_10), val(data.corners?.timings?.away_0_10), "-"]
      ])}
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📈 Odds de escanteios</h2>
        ${dataTable(
          ["Mercado", "Odd Over", "Odd Under", "Potencial"],
          [
            ["7.5", fmtOdd(data.odds?.corners?.over75), fmtOdd(data.odds?.corners?.under75), "-"],
            ["8.5", fmtOdd(data.odds?.corners?.over85), fmtOdd(data.odds?.corners?.under85), pct(data.potentials?.corners?.over85)],
            ["9.5", fmtOdd(data.odds?.corners?.over95), fmtOdd(data.odds?.corners?.under95), pct(data.potentials?.corners?.over95)],
            ["10.5", fmtOdd(data.odds?.corners?.over105), fmtOdd(data.odds?.corners?.under105), pct(data.potentials?.corners?.over105)],
            ["11.5", fmtOdd(data.odds?.corners?.over115), fmtOdd(data.odds?.corners?.under115), "-"]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight de escanteios</h2>
        <div class="summary-text">
          <p>
            O jogo teve <strong>${escapeHTML(val(data.corners?.full_time?.total))}</strong> escanteios.
          </p>
          <p>
            ${escapeHTML(homeName())}: <strong>${escapeHTML(val(data.corners?.full_time?.home))}</strong>.
            ${escapeHTML(awayName())}: <strong>${escapeHTML(val(data.corners?.full_time?.away))}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderCartoes() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  return `
    ${aiHero(
      "Cartões",
      "Cartões totais, amarelos, vermelhos, cartões por tempo, faltas e árbitro.",
      ["Total cartões", val(data.cards?.full_time?.total)],
      [homeName(), val(data.cards?.full_time?.home_total)],
      [awayName(), val(data.cards?.full_time?.away_total)]
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
            <strong class="cards-big">${escapeHTML(val(data.cards?.full_time?.total))}</strong>
            <b>Cartões / Partida</b>
            <p class="small-note">
              ${escapeHTML(homeName())}: ${escapeHTML(val(data.cards?.full_time?.home_total))} ·
              ${escapeHTML(awayName())}: ${escapeHTML(val(data.cards?.full_time?.away_total))}
            </p>
          </div>
        </div>
      </article>

      ${twoTeamTable("📊 Cartões por equipe", [
        ["Total", val(data.cards?.full_time?.home_total), val(data.cards?.full_time?.away_total), val(data.cards?.full_time?.total)],
        ["Amarelos", val(data.cards?.full_time?.home_yellow), val(data.cards?.full_time?.away_yellow), sumDisplay(data.cards?.full_time?.home_yellow, data.cards?.full_time?.away_yellow)],
        ["Vermelhos", val(data.cards?.full_time?.home_red), val(data.cards?.full_time?.away_red), sumDisplay(data.cards?.full_time?.home_red, data.cards?.full_time?.away_red)],
        ["1º tempo", val(data.cards?.first_half?.home), val(data.cards?.first_half?.away), val(data.cards?.first_half?.total)],
        ["2º tempo", val(data.cards?.second_half?.home), val(data.cards?.second_half?.away), val(data.cards?.second_half?.total)]
      ])}
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>👨‍⚖️ Árbitro</h2>
        ${statCards([
          { label: "Nome", value: data.referee?.raw?.known_as || data.referee?.raw?.full_name || "-" },
          { label: "Jogos", value: val(data.referee?.raw?.appearances_overall) },
          { label: "Cartões/jogo", value: val(data.referee?.raw?.cards_per_match_overall) },
          { label: "Amarelos", value: val(data.referee?.raw?.yellow_cards_overall) },
          { label: "Vermelhos", value: val(data.referee?.raw?.red_cards_overall) },
          { label: "Over 4.5 cartões", value: pct(data.referee?.raw?.over45_cards_percentage_overall) }
        ])}
      </article>

      <article class="card">
        <h2>📌 Faltas</h2>
        ${dataTable(
          ["Indicador", homeName(), awayName(), "Total"],
          [
            ["Faltas", val(data.discipline_and_flow?.fouls?.home), val(data.discipline_and_flow?.fouls?.away), val(data.discipline_and_flow?.fouls?.total)],
            ["Impedimentos", val(data.discipline_and_flow?.offsides?.home), val(data.discipline_and_flow?.offsides?.away), val(data.discipline_and_flow?.offsides?.total)],
            ["Potencial impedimentos", "-", "-", val(data.discipline_and_flow?.offsides?.potential)]
          ]
        )}
      </article>
    </section>
  `;
}

function renderChutes() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  return `
    ${aiHero(
      "Chutes",
      "Finalizações, chutes no alvo, posse, ataques perigosos e volume ofensivo.",
      ["Chutes totais", val(data.shots?.full_time?.total)],
      [homeName(), val(data.shots?.full_time?.home_total)],
      [awayName(), val(data.shots?.full_time?.away_total)]
    )}

    <section class="grid-2">
      ${twoTeamTable("🎯 Chutes e finalizações", [
        ["Chutes totais", val(data.shots?.full_time?.home_total), val(data.shots?.full_time?.away_total), val(data.shots?.full_time?.total)],
        ["Chutes no alvo", val(data.shots?.full_time?.home_on_target), val(data.shots?.full_time?.away_on_target), val(data.shots?.full_time?.total_on_target)],
        ["Chutes fora", val(data.shots?.full_time?.home_off_target), val(data.shots?.full_time?.away_off_target), val(data.shots?.full_time?.total_off_target)],
        ["Posse", pct(data.shots?.possession?.home), pct(data.shots?.possession?.away), "-"],
        ["Ataques", val(data.shots?.attacks?.home_attacks), val(data.shots?.attacks?.away_attacks), sumDisplay(data.shots?.attacks?.home_attacks, data.shots?.attacks?.away_attacks)],
        ["Ataques perigosos", val(data.shots?.attacks?.home_dangerous), val(data.shots?.attacks?.away_dangerous), sumDisplay(data.shots?.attacks?.home_dangerous, data.shots?.attacks?.away_dangerous)]
      ])}

      <article class="card">
        <h2>📌 Resumo ofensivo</h2>
        ${statCards([
          { label: `${homeName()} chutes`, value: val(data.shots?.full_time?.home_total) },
          { label: `${awayName()} chutes`, value: val(data.shots?.full_time?.away_total) },
          { label: "Total chutes", value: val(data.shots?.full_time?.total) },
          { label: `${homeName()} no alvo`, value: val(data.shots?.full_time?.home_on_target) },
          { label: `${awayName()} no alvo`, value: val(data.shots?.full_time?.away_on_target) },
          { label: "Total no alvo", value: val(data.shots?.full_time?.total_on_target) }
        ])}
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📎 Fluxo de jogo</h2>
        ${dataTable(
          ["Indicador", homeName(), awayName(), "Total"],
          [
            ["Laterais", val(data.discipline_and_flow?.throwins?.home), val(data.discipline_and_flow?.throwins?.away), val(data.discipline_and_flow?.throwins?.total)],
            ["Faltas cobradas", val(data.discipline_and_flow?.freekicks?.home), val(data.discipline_and_flow?.freekicks?.away), val(data.discipline_and_flow?.freekicks?.total)],
            ["Tiros de meta", val(data.discipline_and_flow?.goalkicks?.home), val(data.discipline_and_flow?.goalkicks?.away), val(data.discipline_and_flow?.goalkicks?.total)]
          ]
        )}
      </article>

      <article class="card">
        <h2>🧠 Insight de chutes</h2>
        <div class="summary-text">
          <p>
            O jogo teve <strong>${escapeHTML(val(data.shots?.full_time?.total))}</strong> chutes,
            sendo <strong>${escapeHTML(val(data.shots?.full_time?.total_on_target))}</strong> no alvo.
          </p>
          <p>
            Posse: ${escapeHTML(homeName())} <strong>${escapeHTML(pct(data.shots?.possession?.home))}</strong> ·
            ${escapeHTML(awayName())} <strong>${escapeHTML(pct(data.shots?.possession?.away))}</strong>.
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderIntervalo() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  return `
    ${aiHero(
      "Intervalo",
      "Dados do primeiro tempo, segundo tempo, gols, escanteios, cartões e odds por período.",
      ["HT", `${val(data.goals?.first_half?.home)} - ${val(data.goals?.first_half?.away)}`],
      ["Gols HT", val(data.goals?.first_half?.total)],
      ["FT", scoreText()]
    )}

    <section class="grid-2">
      ${twoTeamTable("⏱️ Primeiro tempo", [
        ["Gols", val(data.goals?.first_half?.home), val(data.goals?.first_half?.away), val(data.goals?.first_half?.total)],
        ["Escanteios", val(data.corners?.first_half?.home), val(data.corners?.first_half?.away), val(data.corners?.first_half?.total)],
        ["Cartões", val(data.cards?.first_half?.home), val(data.cards?.first_half?.away), val(data.cards?.first_half?.total)]
      ])}

      ${twoTeamTable("⏱️ Segundo tempo", [
        ["Gols", val(data.goals?.second_half?.home), val(data.goals?.second_half?.away), val(data.goals?.second_half?.total)],
        ["Escanteios", val(data.corners?.second_half?.home), val(data.corners?.second_half?.away), val(data.corners?.second_half?.total)],
        ["Cartões", val(data.cards?.second_half?.home), val(data.cards?.second_half?.away), val(data.cards?.second_half?.total)]
      ])}
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📈 Odds 1º tempo</h2>
        ${dataTable(
          ["Mercado", "Casa", "Empate/Under", "Fora/Over"],
          [
            ["Resultado HT", fmtOdd(data.odds?.half_time?.result_home), fmtOdd(data.odds?.half_time?.result_draw), fmtOdd(data.odds?.half_time?.result_away)],
            ["Over 0.5 HT", "-", fmtOdd(data.odds?.half_time?.under05), fmtOdd(data.odds?.half_time?.over05)],
            ["Over 1.5 HT", "-", fmtOdd(data.odds?.half_time?.under15), fmtOdd(data.odds?.half_time?.over15)],
            ["Over 2.5 HT", "-", fmtOdd(data.odds?.half_time?.under25), fmtOdd(data.odds?.half_time?.over25)]
          ]
        )}
      </article>

      <article class="card">
        <h2>📈 Odds 2º tempo</h2>
        ${dataTable(
          ["Mercado", "Casa", "Empate/Under", "Fora/Over"],
          [
            ["Resultado 2T", fmtOdd(data.odds?.second_half?.result_home), fmtOdd(data.odds?.second_half?.result_draw), fmtOdd(data.odds?.second_half?.result_away)],
            ["Over 0.5 2T", "-", fmtOdd(data.odds?.second_half?.under05), fmtOdd(data.odds?.second_half?.over05)],
            ["Over 1.5 2T", "-", fmtOdd(data.odds?.second_half?.under15), fmtOdd(data.odds?.second_half?.over15)],
            ["Over 2.5 2T", "-", fmtOdd(data.odds?.second_half?.under25), fmtOdd(data.odds?.second_half?.over25)]
          ]
        )}
      </article>
    </section>
  `;
}

function renderJogadores() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  const homePlayers = data.players?.home || [];
  const awayPlayers = data.players?.away || [];

  return `
    ${aiHero(
      "Jogadores",
      "Jogadores da temporada, gols, assistências, cartões e minutos quando disponíveis.",
      ["Mandante", homeName()],
      ["Visitante", awayName()],
      ["Jogadores", String(homePlayers.length + awayPlayers.length)]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>⚽ ${escapeHTML(homeName())}</h2>
        ${renderPlayersTable(homePlayers)}
      </article>

      <article class="card">
        <h2>⚽ ${escapeHTML(awayName())}</h2>
        ${renderPlayersTable(awayPlayers)}
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📌 Observação</h2>
        <p class="small-note">
          Se esta aba aparecer vazia, o endpoint league-players está funcionando, mas precisamos ajustar o filtro dos jogadores por time no backend.
        </p>
      </article>

      <article class="card">
        <h2>🏟️ Times</h2>
        ${statCards([
          { label: `${homeName()} fundação`, value: val(data.teams?.home?.raw?.founded) },
          { label: `${awayName()} fundação`, value: val(data.teams?.away?.raw?.founded) },
          { label: `${homeName()} risco`, value: val(data.teams?.home?.raw?.risk) },
          { label: `${awayName()} risco`, value: val(data.teams?.away?.raw?.risk) }
        ])}
      </article>
    </section>
  `;
}

function renderIA() {
  const data = complete();

  if (!data) return renderLoadingFallback();

  const homeXg = Number(data.xg?.actual?.home || 0);
  const awayXg = Number(data.xg?.actual?.away || 0);
  const totalShots = Number(data.shots?.full_time?.total || 0);
  const totalCorners = Number(data.corners?.full_time?.total || 0);
  const totalCards = Number(data.cards?.full_time?.total || 0);

  let tendencia = "Jogo equilibrado nos principais indicadores.";

  if (homeXg > awayXg + 0.5) {
    tendencia = `${homeName()} produziu mais xG e volume ofensivo.`;
  }

  if (awayXg > homeXg + 0.5) {
    tendencia = `${awayName()} produziu mais xG e volume ofensivo.`;
  }

  return `
    ${aiHero(
      "IA / Tendências",
      "Resumo automático com leitura dos dados reais da partida.",
      ["Placar", scoreText()],
      ["Over 2.5", pct(data.potentials?.goals?.over25)],
      ["BTTS", pct(data.potentials?.btts?.full_time)]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🧠 Resumo automático</h2>

        <div class="summary-text">
          <p>
            <strong>${escapeHTML(homeName())}</strong> x <strong>${escapeHTML(awayName())}</strong>
            terminou em <strong>${escapeHTML(scoreText())}</strong>.
          </p>

          <p>
            A partida teve <strong>${escapeHTML(String(totalShots))}</strong> chutes,
            <strong>${escapeHTML(String(totalCorners))}</strong> escanteios,
            <strong>${escapeHTML(String(totalCards))}</strong> cartões e
            xG total de <strong>${escapeHTML(val(data.xg?.actual?.total))}</strong>.
          </p>

          <p>
            <strong>Leitura:</strong> ${escapeHTML(tendencia)}
          </p>

          <p>
            Over 2.5: <strong>${escapeHTML(pct(data.potentials?.goals?.over25))}</strong>.
            BTTS: <strong>${escapeHTML(pct(data.potentials?.btts?.full_time))}</strong>.
          </p>
        </div>
      </article>

      <article class="card">
        <h2>🎯 Leitura de mercado</h2>
        ${statCards([
          { label: "Odd casa", value: fmtOdd(data.odds?.result?.home) },
          { label: "Odd empate", value: fmtOdd(data.odds?.result?.draw) },
          { label: "Odd fora", value: fmtOdd(data.odds?.result?.away) },
          { label: "Over 2.5 odd", value: fmtOdd(data.odds?.goals?.over25) },
          { label: "BTTS odd", value: fmtOdd(data.odds?.btts?.yes) },
          { label: "Corners 9.5 odd", value: fmtOdd(data.odds?.corners?.over95) }
        ])}
      </article>
    </section>
  `;
}

/* =========================
   COMPONENTES
========================= */

function aiHero(title, description, chip1, chip2, chip3) {
  return `
    <section class="hero">
      <div>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>

      <div class="hero-chip">
        <span>${escapeHTML(chip1[0])}</span>
        <strong>${escapeHTML(chip1[1])}</strong>
      </div>

      <div class="hero-chip">
        <span>${escapeHTML(chip2[0])}</span>
        <strong>${escapeHTML(chip2[1])}</strong>
      </div>

      <div class="hero-chip">
        <span>${escapeHTML(chip3[0])}</span>
        <strong>${escapeHTML(chip3[1])}</strong>
      </div>
    </section>
  `;
}

function aiCard(icon, label, value) {
  return `
    <article class="ai-card">
      <div class="ai-icon">${icon}</div>
      <div>
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>
    </article>
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

function twoTeamTable(title, rows) {
  return `
    <article class="card">
      <h2>${escapeHTML(title)}</h2>
      ${dataTable(
        ["Indicador", homeName(), awayName(), "Total/Média"],
        rows
      )}
    </article>
  `;
}

function renderPlayersTable(players) {
  if (!players || !players.length) {
    return `
      <div class="empty-data">
        Nenhum jogador vinculado a este time no retorno atual.
      </div>
    `;
  }

  return dataTable(
    ["Jogador", "Posição", "Min", "Gols", "Assist.", "Cartões"],
    players.slice(0, 12).map(function(player) {
      return [
        player.name || "-",
        player.position || "-",
        val(player.minutes),
        val(player.goals),
        val(player.assists),
        val(player.cards)
      ];
    })
  );
}

function renderLoadingFallback() {
  return `
    <article class="card">
      <h2>Carregando dados...</h2>
      <p class="small-note">Aguarde o carregamento da partida completa.</p>
    </article>
  `;
}

/* =========================
   HELPERS DADOS
========================= */

function complete() {
  return selectedMatch ? selectedMatch.complete : null;
}

function homeName() {
  return complete()?.teams?.home?.name || selectedMatch?.home || "Mandante";
}

function awayName() {
  return complete()?.teams?.away?.name || selectedMatch?.away || "Visitante";
}

function scoreText() {
  const data = complete();

  if (!data) return selectedMatch?.score || "-";

  const home = data.score?.home_goals;
  const away = data.score?.away_goals;

  if (home === null || home === undefined || away === null || away === undefined) {
    return selectedMatch?.status === "done" ? selectedMatch.score : "Pré-jogo";
  }

  return `${home} - ${away}`;
}

function getLeagueTitle() {
  const data = complete();

  if (data?.league?.competition_id) {
    return `Liga ${data.league.competition_id}`;
  }

  return "Dados via API";
}

function val(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === -1 ||
    value === "-1"
  ) {
    return "-";
  }

  if (typeof value === "number") {
    return value % 1 === 0 ? String(value) : value.toFixed(2);
  }

  return String(value);
}

function pct(value) {
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
    return text.includes("%") ? text : text;
  }

  if (number <= 1) {
    return `${Math.round(number * 100)}%`;
  }

  return `${Math.round(number)}%`;
}

function fmtOdd(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === -1 ||
    value === "-1" ||
    value === 0 ||
    value === "0"
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "-";
  }

  return number.toFixed(2);
}

function boolText(value) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  if (value === 1 || value === "1") return "Sim";
  if (value === 0 || value === "0") return "Não";
  return val(value);
}

function listValue(value) {
  if (!value) return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  return String(value);
}

function sumDisplay(a, b) {
  const first = Number(a || 0);
  const second = Number(b || 0);

  if (!Number.isFinite(first) && !Number.isFinite(second)) return "-";

  return String(first + second);
}

function classifyValue(value) {
  const text = String(value).replace("%", "").replace("-", "");
  const number = Number(text);

  if (!Number.isFinite(number)) return "heat-mid";
  if (number >= 60) return "heat-high";
  if (number >= 35) return "heat-mid";
  return "heat-low";
}

function cleanNumber() {
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

function formatOdd(value) {
  return fmtOdd(value);
}

function formatPercent(value) {
  return pct(value);
}

/* =========================
   IMAGENS / TEXTO / DATA
========================= */

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
