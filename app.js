let leagues = [
  {
    name: "🇦🇷 Argentina › Liga Profissional",
    matches: [
      {
        id: "demo-1",
        time: "18:00",
        status: "pre",
        home: "San Lorenzo",
        away: "Deportivo Riestra",
        homeShort: "SLO",
        awayShort: "RIE",
        score: "vs",
        odds: ["2.07", "2.99", "4.03"],
        over25: "30%",
        btts: "35%",
        form: ["w", "d", "l", "d", "l"],
        raw: null
      }
    ]
  }
];

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

async function loadRealMatches() {
  const container = document.getElementById("matchesContainer");

  container.innerHTML = `
    <article class="card">
      <h2>Carregando jogos reais...</h2>
      <p class="small-note">Buscando partidas na API da FootyStats.</p>
    </article>
  `;

  try {
    const response = await fetch("/api/jogos");
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Erro ao carregar jogos reais.");
    }

    const matches = extractMatchesFromApi(payload.raw || payload.data || payload);

    if (!matches.length) {
      renderMatches();

      container.insertAdjacentHTML("afterbegin", `
        <article class="card" style="margin-bottom: 14px;">
          <h2>⚠️ Nenhum jogo real retornado hoje</h2>
          <p class="small-note">
            A API respondeu corretamente, mas retornou lista vazia.
            Por enquanto estamos mostrando jogos de demonstração.
          </p>
        </article>
      `);

      return;
    }

    leagues = groupMatchesByLeague(matches);
    renderMatches();
  } catch (error) {
    renderMatches();

    container.insertAdjacentHTML("afterbegin", `
      <article class="card" style="margin-bottom: 14px;">
        <h2>⚠️ Não foi possível carregar os jogos reais</h2>
        <p class="small-note">
          ${escapeHTML(error.message)}
          Mostrando jogos de demonstração por enquanto.
        </p>
      </article>
    `);
  }
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

  const status = normalizeStatus(match.status, match.game_status);

  return {
    id: String(match.id || match.match_id || `${homeName}-${awayName}`),
    time: getMatchTime(match),
    status,
    home: homeName,
    away: awayName,
    homeShort: makeShort(homeName),
    awayShort: makeShort(awayName),
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

function getLeagueName(match) {
  const country =
    match.country ||
    match.country_name ||
    match.league_country ||
    "";

  const league =
    match.league_name ||
    match.competition_name ||
    match.season_name ||
    match.league ||
    `Liga ${match.competition_id || match.league_id || match.season_id || ""}`.trim();

  if (country) {
    return `${country} › ${league}`;
  }

  return league;
}

function normalizeStatus(status, gameStatus) {
  const value = String(status || gameStatus || "").toLowerCase();

  if (
    value.includes("complete") ||
    value.includes("finished") ||
    value.includes("final") ||
    value === "ft"
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

function renderMatches() {
  const container = document.getElementById("matchesContainer");

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
                <span class="team-badge">${escapeHTML(match.homeShort)}</span>
                <span class="team-name">${escapeHTML(match.home)}</span>
              </div>

              <div class="score">${escapeHTML(match.score)}</div>

              <div class="team">
                <span class="team-badge">${escapeHTML(match.awayShort)}</span>
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

              <button class="stats-btn" type="button" onclick="showStats('${escapeHTML(match.id)}')">
                Estatísticas
              </button>
            </div>
          `;
        }).join("")}
      </article>
    `;
  }).join("");
}

function showStats(matchId) {
  const selectedMatch = findMatchById(matchId);

  if (selectedMatch) {
    updateMatchHeader(selectedMatch);
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
      ${escapeHTML(match.time)} · ${match.status === "done" ? "Finalizado" : "Pré-jogo"}<br>
      Dados via API
    </div>

    <div class="versus">
      <div>
        <div class="big-badge">${escapeHTML(match.homeShort)}</div>
        <strong>${escapeHTML(match.home)}</strong>
      </div>

      <div class="vs">${escapeHTML(match.score)}</div>

      <div>
        <div class="big-badge">${escapeHTML(match.awayShort)}</div>
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
          <th>San Lorenzo</th>
          <th>Riestra</th>
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
          <th>San Lorenzo</th>
          <th>Riestra</th>
        </tr>
      </thead>
      <tbody>${simpleHeatRows(rows)}</tbody>
    </table>
  `;
}

function teamProgress(short, name, value, width, red) {
  return `
    <div class="team-row">
      <div class="small-badge">${short}</div>

      <div>
        <strong>${name}</strong>
        <div class="progress ${red ? "red" : ""}">
          <span style="width:${width}%;"></span>
        </div>
        <p class="small-note">${value}</p>
      </div>

      <b class="${red ? "red" : ""}">${value.includes("%") ? value : width + "%"}</b>
    </div>
  `;
}

function renderCompletas() {
  return `
    <section class="ai-strip">
      <h2 class="section-title">✦ Insights da IA</h2>

      <div class="ai-grid">
        <article class="ai-card">
          <div class="ai-icon">🎯</div>
          <div>
            <span>Mercado com mais valor</span>
            <strong>Over 1.5 Gols · 55%</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">📈</div>
          <div>
            <span>Tendência do jogo</span>
            <strong>Jogo aberto com chances para ambos</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">⚠️</div>
          <div>
            <span>Atenção</span>
            <strong>Riestra concede muitos chutes</strong>
          </div>
        </article>

        <article class="ai-card">
          <div class="ai-icon">🛡️</div>
          <div>
            <span>Confiança da IA</span>
            <strong>Alta · 73%</strong>
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
            <tr><td>San Lorenzo Vence</td><td>2.07</td><td>20%</td></tr>
            <tr><td>Deportivo Riestra Vence</td><td>4.03</td><td>20%</td></tr>
            <tr><td>Empate</td><td>2.99</td><td>45%</td></tr>
            <tr><td>Over 0.5</td><td>1.08</td><td>75%</td></tr>
            <tr><td>Over 1.5</td><td>1.56</td><td>55%</td></tr>
            <tr><td>Over 2.5</td><td>2.70</td><td>30%</td></tr>
            <tr><td>Over 3.5</td><td>4.35</td><td>15%</td></tr>
            <tr><td>BTTS</td><td>2.20</td><td>35%</td></tr>
          </tbody>
        </table>
      </article>

      <article class="card form-compare">
        <h2>📈 Forma Atual — Quem vence?</h2>

        <div class="form-top">
          <div>
            <div class="big-badge">SLO</div>
            <strong>San Lorenzo</strong><br>
            <span class="rating">1.20</span>
            <div class="form">
              <span class="w">V</span>
              <span class="d">E</span>
              <span class="l">D</span>
              <span class="d">E</span>
              <span class="l">D</span>
            </div>
          </div>

          <div>
            <div class="power-bar">
              <span></span>
              <span></span>
            </div>

            <p class="summary-text">
              <strong>San Lorenzo é +33% melhor</strong><br>
              em termos de Pontos por Jogo.
            </p>
          </div>

          <div>
            <div class="big-badge">RIE</div>
            <strong>Deportivo Riestra</strong><br>
            <span class="rating red">0.90</span>

            <div class="form">
              <span class="d">E</span>
              <span class="l">D</span>
              <span class="l">D</span>
              <span class="d">E</span>
              <span class="w">V</span>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>🤝 Head to Head</h2>

        <p style="text-align:center; color: var(--muted);">
          <strong style="color: var(--text); font-size: 1.4rem;">4</strong><br>
          partidas disputadas
        </p>

        <div class="h2h-bar">
          <span>25%</span>
          <span>50%</span>
          <span>25%</span>
        </div>

        <div class="tile-grid">
          <div class="tile">
            <strong>25%</strong>
            <span>Over 1.5</span>
            <small>1 de 4</small>
          </div>

          <div class="tile">
            <strong>0%</strong>
            <span>Over 2.5</span>
            <small>0 de 4</small>
          </div>

          <div class="tile">
            <strong>25%</strong>
            <span>BTTS</span>
            <small>1 de 4</small>
          </div>
        </div>
      </article>
    </section>

    <section class="grid-3">
      <article class="card">
        <h2>◎ Prediction Stats</h2>

        <div class="stat-cards">
          <div class="stat-card"><strong>30%</strong><span>Over 2.5</span><small>Liga: 47%</small></div>
          <div class="stat-card"><strong>55%</strong><span>Over 1.5</span><small>Liga: 77%</small></div>
          <div class="stat-card"><strong>35%</strong><span>BTTS</span><small>Liga: 33%</small></div>
          <div class="stat-card"><strong>2.0</strong><span>Gols por jogo</span><small>Liga: 2.51</small></div>
          <div class="stat-card"><strong>4.8</strong><span>Cartões</span><small>Liga: 4.29</small></div>
          <div class="stat-card"><strong>9.9</strong><span>Escanteios</span><small>Liga: 7.26</small></div>
        </div>
      </article>

      <article class="card">
        <h2>🏃 Quem marca primeiro?</h2>
        ${teamProgress("SLO", "San Lorenzo", "40%", "40")}
        ${teamProgress("RIE", "Deportivo Riestra", "20%", "20", true)}
      </article>

      <article class="card">
        <h2>⏱️ Gols por minuto</h2>
        ${goalsMinuteTable()}
      </article>
    </section>
  `;
}

function renderGols() {
  return `
    ${aiHero(
      "Análise de Gols",
      "Leitura focada em gols marcados, gols sofridos, Over/Under, BTTS e distribuição por tempo.",
      ["Mercado sugerido", "Over 1.5 Gols"],
      ["Confiança da IA", "Moderada · 73%"],
      ["Atenção", "Over 2.5 ainda fraco"]
    )}

    <section class="grid-3">
      <article class="card">
        <h2>⚽ Gols Marcados</h2>
        ${teamProgress("SLO", "San Lorenzo", "0.9 gols / jogo", "90")}
        ${teamProgress("RIE", "Deportivo Riestra", "0.6 gols / jogo", "60", true)}
        <div class="conclusion">San Lorenzo é <strong>+50% melhor</strong> em gols marcados.</div>
      </article>

      <article class="card">
        <h2>🛡️ Gols Sofridos</h2>
        ${teamProgress("SLO", "San Lorenzo", "0.8 sofridos / jogo", "44")}
        ${teamProgress("RIE", "Deportivo Riestra", "1.3 sofridos / jogo", "72", true)}
        <div class="warning">Riestra sofre mais gols fora. Isso reforça leitura para linhas baixas de gols.</div>
      </article>

      <article class="card">
        <h2>🧠 Insight da IA</h2>
        <div class="conclusion">
          O melhor encaixe da aba Gols é o mercado <strong>Over 1.5</strong>.
          O modelo não recomenda agressividade em Over 2.5 ou superior.
        </div>
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📊 Over 2.5 & BTTS Predictions</h2>

        ${marketTable([
          ["Over 0.5", "70%", "heat-high", "80%", "heat-high", "75%", "heat-high"],
          ["Over 1.5", "50%", "heat-mid", "60%", "heat-high", "55%", "heat-mid"],
          ["Over 2.5", "30%", "heat-low", "30%", "heat-low", "30%", "heat-low"],
          ["Over 3.5", "20%", "heat-low", "10%", "heat-low", "15%", "heat-low"],
          ["BTTS", "40%", "heat-mid", "30%", "heat-low", "35%", "heat-mid"]
        ])}
      </article>

      <article class="card">
        <h2>🕒 Gols por minuto</h2>
        ${goalsMinuteTable()}
      </article>
    </section>
  `;
}

function renderEscanteios() {
  return `
    ${aiHero(
      "Análise de Escanteios",
      "Leitura focada em escanteios totais, escanteios por equipe, linhas Over e comportamento por tempo.",
      ["Média esperada", "9.9 escanteios / jogo"],
      ["Mercado sugerido", "Over 7.5 escanteios"],
      ["Confiança da IA", "Moderada · 71%"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>🚩 Número de Escanteios</h2>

        <div class="corner-summary">
          <div class="corner-icon">⚑</div>

          <div>
            <strong class="corner-big">9.9</strong>
            <b>Escanteios / Partida</b>
            <p class="small-note">Média combinada entre San Lorenzo e Deportivo Riestra.</p>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>🧠 Insight da IA</h2>
        <div class="conclusion">
          O jogo tem boa base para escanteios em linhas baixas e médias.
          A melhor leitura está entre <strong>Over 6.5</strong> e <strong>Over 7.5</strong>.
        </div>
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📊 Escanteios Totais</h2>

        ${marketTable([
          ["Over 6", "70%", "heat-high", "90%", "heat-high", "80%", "heat-high"],
          ["Over 7", "60%", "heat-mid", "90%", "heat-high", "75%", "heat-high"],
          ["Over 8", "30%", "heat-low", "80%", "heat-high", "55%", "heat-mid"],
          ["Over 9", "30%", "heat-low", "60%", "heat-mid", "45%", "heat-mid"],
          ["Over 10", "30%", "heat-low", "40%", "heat-low", "35%", "heat-low"]
        ])}
      </article>

      <article class="card">
        <h2>🏳️ Team Corners</h2>

        ${marketTable([
          ["Corners Earned / Match", "4.40", "heat-mid", "5.50", "heat-high", "4.95", "heat-mid"],
          ["Corners Against / Match", "3.60", "heat-mid", "4.70", "heat-mid", "4.15", "heat-mid"],
          ["Over 2.5 Corners For", "80%", "heat-high", "90%", "heat-high", "85%", "heat-high"]
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
      ["Média esperada", "4.80 cartões / jogo"],
      ["Mercado sugerido", "Over 3.5 cartões"],
      ["Confiança da IA", "Alta · 80%"]
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
            <strong class="cards-big">4.80</strong>
            <b>Cartões / Partida</b>
            <p class="small-note">Média combinada entre as equipes.</p>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>🧠 Insight da IA</h2>
        <div class="conclusion">
          O mercado de cartões tem leitura forte.
          A melhor base está em <strong>Over 3.5 cartões</strong> e <strong>Over 4.5 cartões</strong>.
        </div>
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📊 Cartões Totais</h2>

        ${marketTable([
          ["Over 2.5", "100%", "heat-high", "100%", "heat-high", "100%", "heat-high"],
          ["Over 3.5", "70%", "heat-high", "90%", "heat-high", "80%", "heat-high"],
          ["Over 4.5", "70%", "heat-high", "70%", "heat-high", "70%", "heat-high"],
          ["Over 5.5", "40%", "heat-low", "50%", "heat-mid", "45%", "heat-low"]
        ])}
      </article>

      <article class="card">
        <h2>⏱️ 1º Tempo / 2º Tempo</h2>

        ${marketTable([
          ["1H Cards AVG", "0.8", "heat-high", "0.8", "heat-high", "0.8", "heat-high"],
          ["2H Cards AVG", "1.4", "heat-high", "1.7", "heat-high", "1.55", "heat-high"],
          ["2H Had More Cards %", "70%", "heat-high", "70%", "heat-high", "70%", "heat-high"]
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
      ["Volume médio", "26 chutes / jogo"],
      ["Mercado sugerido", "Chutes Over 23.5"],
      ["Confiança da IA", "Boa · 76%"]
    )}

    <section class="grid-3">
      <article class="card">
        <h2>🎯 Volume por equipe</h2>
        ${teamProgress("SLO", "San Lorenzo", "15.20 chutes / jogo", "76")}
        ${teamProgress("RIE", "Deportivo Riestra", "10.80 chutes / jogo", "54")}
        <div class="conclusion">San Lorenzo apresenta maior volume ofensivo e maior frequência de finalizações.</div>
      </article>

      <article class="card">
        <h2>🧠 Insight da IA</h2>
        <div class="conclusion">
          A IA identifica vantagem ofensiva do San Lorenzo em chutes totais e chutes no alvo.
          O mercado de <strong>chutes totais Over 23.5</strong> tem boa leitura.
        </div>
      </article>

      <article class="card">
        <h2>📌 Resumo rápido</h2>

        <div class="stat-cards">
          <div class="stat-card"><strong>70%</strong><span>Team Shots +10.5</span><small>San Lorenzo</small></div>
          <div class="stat-card"><strong>90%</strong><span>On Target 3.5+</span><small>San Lorenzo</small></div>
          <div class="stat-card"><strong>65%</strong><span>Match Shots +23.5</span><small>média geral</small></div>
        </div>
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>📊 Chutes por equipe</h2>

        ${marketTable([
          ["Chutes / Jogo", "15.20", "heat-high", "10.80", "heat-high", "13.00", "heat-high"],
          ["Chutes no Alvo / Jogo", "5.00", "heat-high", "2.40", "heat-low", "4.00", "heat-mid"],
          ["Team Shots Over 10.5", "70%", "heat-high", "50%", "heat-mid", "60%", "heat-high"]
        ])}
      </article>

      <article class="card">
        <h2>🚩 Impedimentos e faltas</h2>

        ${marketTable([
          ["Impedimentos / Jogo", "3.38", "heat-high", "3.20", "heat-high", "3.00", "heat-high"],
          ["Over 2.5 Impedimentos", "75%", "heat-high", "70%", "heat-high", "73%", "heat-high"],
          ["Faltas cometidas / jogo", "13.00", "heat-high", "14.70", "heat-high", "14.00", "heat-high"]
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
      ["Forma HT", "Equilibrada"],
      ["Melhor tempo", "2º Tempo"],
      ["Insight da IA", "Mais eventos após o intervalo"]
    )}

    <section class="grid-2">
      <article class="card form-compare">
        <h2>⏱️ First / Second Half WDL</h2>

        <div class="form-top">
          <div>
            <div class="big-badge">SLO</div>
            <strong>San Lorenzo</strong><br>
            <span class="rating">1.10</span>
            <p class="summary-text">Half-Time</p>
          </div>

          <div>
            <div class="power-bar equal">
              <span></span>
              <span></span>
            </div>

            <p class="summary-text">
              <strong>Ambas as equipes estão iguais</strong><br>
              em termos de forma no intervalo.
            </p>
          </div>

          <div>
            <div class="big-badge">RIE</div>
            <strong>Deportivo Riestra</strong><br>
            <span class="rating">1.10</span>
            <p class="summary-text">Half-Time</p>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>📊 Resultado por Tempo</h2>

        ${simpleMarketTable([
          ["Win % 1st Half", "20%", "heat-low", "20%", "heat-low"],
          ["Draw % 1st Half", "50%", "heat-high", "50%", "heat-high"],
          ["Draw % 2nd Half", "70%", "heat-high", "50%", "heat-high"]
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
      ["Principal goleador", "Alexis Ricardo Cuello"],
      ["Maior risco de cartão", "Mateo Ramírez"],
      ["Insight da IA", "Buscar titulares confirmados"]
    )}

    <section class="grid-2">
      <article class="card">
        <h2>⚽ Quem pode marcar? — San Lorenzo</h2>

        ${playerList([
          ["🇦🇷 Alexis Ricardo Cuello", "1", "86"],
          ["🇦🇷 Guzmán Corujo", "1", "76"],
          ["🇦🇷 Luciano Vietto", "1", "68"],
          ["🇦🇷 Matías Reali", "1", "62"],
          ["🇵🇾 Jhohan Romaña", "0", "18"]
        ])}
      </article>

      <article class="card">
        <h2>🟨 Cartões / 90 — Deportivo Riestra</h2>

        ${playerList([
          ["Mateo Ramírez Montenegro", "1.3", "92"],
          ["Facundo Miño", "1.0", "72"],
          ["Ángel Mario Stringa", "0", "18"],
          ["Nicolás Caro Torres", "0", "16"]
        ])}
      </article>
    </section>
  `;
}

function renderIA() {
  return `
    ${aiHero(
      "IA / Tendências",
      "Resumo inteligente da partida, análise complementar, leitura de mercado e tendências individuais das equipes quando disponíveis.",
      ["Aposta principal", "1X San Lorenzo"],
      ["Mercado secundário", "Menos de 3.5 gols"],
      ["Confiança da IA", "Boa · 78%"]
    )}

    <section id="iaRoot">
      <section class="toggle-card">
        <div>
          <strong>Modo de teste da aba</strong>
          <p>
            Alguns jogos trazem resumo, análise complementar e tendências.
            Outros jogos trazem apenas os dois primeiros blocos.
          </p>
        </div>

        <div class="toggle-actions">
          <button id="fullModeBtn" class="active" type="button" onclick="setIAMode('full')">Com tendências</button>
          <button id="compactModeBtn" type="button" onclick="setIAMode('compact')">Só resumo + análise</button>
        </div>
      </section>

      <section class="ia-layout">
        <div class="stack">
          <article class="card">
            <div class="card-header">
              <div>
                <h2>🧠 Resumo das estatísticas da IA</h2>
                <p class="card-subtitle">
                  Leitura geral da partida com mercados, cenário provável, gols, escanteios e resultado.
                </p>
              </div>

              <span class="badge">GPT-5 · Resumo IA</span>
            </div>

            <div class="summary-text">
              <p>
                <strong>San Lorenzo x Deportivo Riestra.</strong> Status: incompleto.
                A partida tem início previsto para 4 de junho. O mercado aponta San Lorenzo próximo de
                <strong>2.00</strong>, empate em <strong>2.85</strong> e Deportivo Riestra em <strong>4.01</strong>.
              </p>

              <p>
                A expectativa de gols está em uma faixa moderada. A média total de xG entre as equipes gira em torno de
                <strong>3.25</strong>, com San Lorenzo apresentando vantagem no xG em casa.
              </p>

              <p>
                Nos mercados de gols, o cenário mais seguro parece estar nas linhas conservadoras:
                <strong>Mais de 0.5</strong> e <strong>Menos de 3.5</strong>.
              </p>

              <p>
                Em escanteios, o modelo projeta uma partida próxima de <strong>8 a 9 cantos</strong>.
                Para leitura mais segura, linhas próximas de 7.5 fazem mais sentido.
              </p>

              <p>
                O resultado provável favorece levemente o San Lorenzo.
                A opção mais segura é <strong>vitória ou empate do San Lorenzo</strong>.
                Placar provável entre <strong>1-0, 1-1 ou 2-1</strong>.
              </p>
            </div>

            <div class="key-grid">
              <div class="key-card"><strong>1X</strong><span>Mercado principal</span><small>San Lorenzo ou empate</small></div>
              <div class="key-card"><strong>3.5</strong><span>Under gols</span><small>linha conservadora</small></div>
              <div class="key-card"><strong>8-9</strong><span>Escanteios</span><small>projeção total</small></div>
              <div class="key-card"><strong>78%</strong><span>Confiança IA</span><small>boa leitura</small></div>
            </div>
          </article>

          <article class="card">
            <div class="card-header">
              <div>
                <h2>📋 Análise de acessórios</h2>
                <p class="card-subtitle">
                  Resumo complementar com histórico, confronto direto, gols e desempenho casa/fora.
                </p>
              </div>

              <span class="badge">Análise complementar</span>
            </div>

            <div class="accessory-list">
              <div class="accessory-item">
                <div class="accessory-icon">🏆</div>
                <p>
                  No dia 3 de junho de 2026, <strong>San Lorenzo</strong> e
                  <strong>Deportivo Riestra</strong> se enfrentam pela Copa Argentina.
                  O último encontro terminou com vitória do San Lorenzo por <strong>1 x 0</strong>.
                </p>
              </div>

              <div class="accessory-item">
                <div class="accessory-icon">🤝</div>
                <p>
                  As equipes se enfrentaram <strong>4 vezes</strong>. San Lorenzo venceu <strong>1</strong>,
                  Deportivo Riestra venceu <strong>1</strong> e <strong>2 partidas terminaram empatadas</strong>.
                </p>
              </div>

              <div class="accessory-item">
                <div class="accessory-icon">⚽</div>
                <p>
                  Os confrontos anteriores tiveram média de <strong>1 gol por jogo</strong>,
                  com ambas as equipes marcando em apenas <strong>25%</strong> das partidas.
                </p>
              </div>

              <div class="accessory-item">
                <div class="accessory-icon">📈</div>
                <p>
                  San Lorenzo tem média de <strong>1 ponto por jogo</strong> em casa,
                  enquanto Deportivo Riestra possui <strong>0.4 ponto por jogo</strong> fora.
                </p>
              </div>
            </div>
          </article>
        </div>

        <aside class="stack">
          <article class="card">
            <div class="card-header">
              <div>
                <h2>🎯 Opções de aposta</h2>
                <p class="card-subtitle">Resumo objetivo do que a IA considera mais interessante.</p>
              </div>
            </div>

            <div class="recommendation">
              <div class="rec-item">
                <div class="rec-icon">🛡️</div>
                <div>
                  <span>Aposta principal</span>
                  <strong>Vitória ou empate do San Lorenzo</strong>
                </div>
                <div class="rec-value">1X</div>
              </div>

              <div class="rec-item">
                <div class="rec-icon">⚽</div>
                <div>
                  <span>Aposta secundária</span>
                  <strong>Menos de 3.5 gols</strong>
                </div>
                <div class="rec-value">Under</div>
              </div>

              <div class="rec-item">
                <div class="rec-icon">🚩</div>
                <div>
                  <span>Escanteios</span>
                  <strong>Aproximadamente 8 no total</strong>
                </div>
                <div class="rec-value">8</div>
              </div>

              <div class="rec-item">
                <div class="rec-icon">⚠️</div>
                <div>
                  <span>Atenção</span>
                  <strong>Mais de 2.5 exige cautela</strong>
                </div>
                <div class="rec-value">Risco</div>
              </div>
            </div>
          </article>

          <article class="card">
            <h2>📌 Perspectiva prevista</h2>

            <div class="summary-text">
              <p>
                O jogo deve ser equilibrado, com leve vantagem para o San Lorenzo.
                A tendência é de placar baixo ou moderado.
              </p>

              <p>
                O Deportivo Riestra pode oferecer resistência defensiva,
                mas o desempenho fora de casa pesa contra a equipe visitante.
              </p>

              <p>
                A linha de escanteios pode ficar em torno de 8,
                com maior valor apenas se a odd compensar.
              </p>
            </div>
          </article>
        </aside>
      </section>

      <section class="empty-state">
        <strong>Este jogo não possui tendências das equipes.</strong><br>
        Para este tipo de partida, a API ou o banco de dados retornou apenas o
        <strong>Resumo da IA</strong> e a <strong>Análise de acessórios</strong>.
        O layout remove automaticamente os blocos de tendências.
      </section>

      <section class="team-trends">
        ${trendCard("SLO", "San Lorenzo", "Mandante", [
          "Chegando a este jogo, o San Lorenzo soma <strong>10 pontos nos últimos 5 jogos</strong>, tanto em casa quanto fora.",
          "O San Lorenzo estará confiante para marcar hoje e buscará manter seu histórico de marcar gols em casa.",
          "É possível vermos gols aqui, já que os últimos jogos indicam boa presença ofensiva.",
          "O time tentará manter o bom momento hoje contra o Deportivo Riestra.",
          "Nos últimos 5 jogos, em 3 deles ambas as equipes marcaram."
        ])}

        ${trendCard("RIE", "Deportivo Riestra", "Visitante", [
          "Chegando a este jogo, o Deportivo Riestra soma <strong>13 pontos nos últimos 5 jogos</strong>, tanto em casa quanto fora.",
          "O Deportivo Riestra tem se saído bem recentemente, estando invicto nos últimos jogos.",
          "A equipe chega para este confronto contra o San Lorenzo invicta nos últimos 5 jogos.",
          "Nos últimos jogos do Deportivo Riestra, em boa parte deles ambas as equipes marcaram.",
          "É provável que o Deportivo Riestra marque hoje, já que balançou as redes com frequência."
        ])}
      </section>
    </section>
  `;
}

function setIAMode(mode) {
  const root = document.getElementById("iaRoot");
  const fullModeBtn = document.getElementById("fullModeBtn");
  const compactModeBtn = document.getElementById("compactModeBtn");

  if (!root || !fullModeBtn || !compactModeBtn) return;

  if (mode === "compact") {
    root.classList.add("ia-compact");
    fullModeBtn.classList.remove("active");
    compactModeBtn.classList.add("active");
    return;
  }

  root.classList.remove("ia-compact");
  compactModeBtn.classList.remove("active");
  fullModeBtn.classList.add("active");
}

function trendCard(short, team, type, items) {
  return `
    <article class="trend-card">
      <div class="trend-top">
        <div class="team-title">
          <span class="team-mini">${short}</span>
          <div>
            ${team}
            <div class="card-subtitle">Tendências da equipe</div>
          </div>
        </div>

        <span class="badge">${type}</span>
      </div>

      <div class="trend-tabs">
        <button class="active" type="button">Fortaleza</button>
        <button type="button">Vitória</button>
      </div>

      <div class="trend-list">
        ${items.map(function(item) {
          return `
            <div class="trend-item">
              <div class="trend-icon">↑</div>
              <p>${item}</p>
            </div>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

function goalsMinuteTable() {
  return `
    <table class="heat-table">
      <thead>
        <tr>
          <th>Intervalo</th>
          <th>San Lorenzo</th>
          <th>Riestra</th>
        </tr>
      </thead>

      <tbody>
        <tr><td>0 - 15</td><td class="heat-low">6%</td><td class="heat-mid">16%</td></tr>
        <tr><td>16 - 30</td><td class="heat-high">18%</td><td class="heat-high">32%</td></tr>
        <tr><td>31 - 45</td><td class="heat-high">24%</td><td class="heat-mid">11%</td></tr>
        <tr><td>46 - 60</td><td class="heat-mid">12%</td><td class="heat-mid">16%</td></tr>
        <tr><td>61 - 75</td><td class="heat-high">24%</td><td class="heat-mid">11%</td></tr>
        <tr><td>76 - 90+</td><td class="heat-low">6%</td><td class="heat-mid">16%</td></tr>
      </tbody>
    </table>
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

loadRealMatches();
