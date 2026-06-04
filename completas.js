(function() {
  function hasValue(value) {
    return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1";
  }

  function getPath(source, path) {
    return String(path).split(".").reduce(function(current, key) {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, source);
  }

  function pickValue(source, paths, fallback) {
    for (const path of paths) {
      const value = typeof path === "function" ? path(source) : getPath(source, path);
      if (hasValue(value)) return value;
    }

    return fallback;
  }

  function numberValue(value) {
    if (!hasValue(value)) return null;
    const number = Number(String(value).replace("%", "").replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }

  function displayPct(value) {
    return hasValue(value) ? pct(value) : "-";
  }

  function displayDecimal(value, suffix) {
    const number = numberValue(value);
    if (number === null) return "-";
    return `${number.toFixed(2)}${suffix || ""}`;
  }

  function metricTone(value) {
    const number = numberValue(value);
    if (number === null) return "neutral";
    if (number >= 55) return "good";
    if (number >= 40) return "mid";
    return "bad";
  }

  function getRawMatch(data) {
    return data.raw?.match_details || data.raw?.match || selectedMatch?.raw || {};
  }

  function needsDetails(data) {
    const raw = getRawMatch(data);
    return !raw.h2h && !raw.trends && !data._completasDetailsLoading && !data._completasDetailsLoaded && !data._completasDetailsError;
  }

  async function loadFootyStatsDetails(data) {
    if (!selectedMatch?.matchId || !needsDetails(data)) return;

    data._completasDetailsLoading = true;

    try {
      const response = await fetch(`/api/match-details?match_id=${encodeURIComponent(selectedMatch.matchId)}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Detalhes indisponíveis.");
      }

      data.raw = data.raw || {};
      data.raw.match_details = payload.data;
      data.raw.match = Object.assign({}, data.raw.match || {}, payload.data);
      data._completasDetailsLoaded = true;
    } catch (error) {
      data._completasDetailsError = error.message;
    } finally {
      data._completasDetailsLoading = false;
      if (selectedMatch?.complete === data) renderTab("completas");
    }
  }

  function getLeagueNameFromData(data) {
    const raw = getRawMatch(data);

    return pickValue(data, [
      "raw.match.league_name",
      "raw.match.competition_name",
      "raw.match.resolved_league_name",
      "raw.match.season_name",
      "raw.match.league",
      function() { return selectedMatch?.league; }
    ], raw.league || "Liga");
  }

  function teamLogo(side) {
    const data = complete();
    const team = side === "home" ? data?.teams?.home : data?.teams?.away;
    const matchLogo = side === "home" ? selectedMatch?.homeLogo : selectedMatch?.awayLogo;
    return team?.image || matchLogo || "";
  }

  function renderLogo(side) {
    const logo = teamLogo(side);
    const initials = makeShort(side === "home" ? homeName() : awayName());

    if (logo) {
      return `
        <img src="${escapeHTML(logo)}" alt="${escapeHTML(initials)}" class="complete-team-logo"
          onerror="this.outerHTML='<span class=&quot;complete-team-fallback&quot;>${escapeHTML(initials)}</span>'">
      `;
    }

    return `<span class="complete-team-fallback">${escapeHTML(initials)}</span>`;
  }

  function normalizeFormItem(item) {
    const text = String(item || "").trim().toUpperCase();
    if (!text) return "-";
    if (["W", "V", "WIN", "VITORIA", "VITÓRIA"].includes(text)) return "V";
    if (["D", "E", "DRAW", "EMPATE"].includes(text)) return "E";
    if (["L", "P", "LOSS", "DERROTA"].includes(text)) return "D";
    return text[0] || "-";
  }

  function getFormSequence(data, side) {
    const raw = getRawMatch(data);
    const teamRaw = side === "home" ? data.teams?.home?.raw : data.teams?.away?.raw;
    const paths = side === "home" ? [
      function() { return raw.team_a_home_form; },
      function() { return raw.home_form; },
      function() { return raw.team_a_form; },
      function() { return raw.homeForm; },
      function() { return teamRaw?.home_form; },
      function() { return teamRaw?.form; },
      function() { return teamRaw?.recent_form; }
    ] : [
      function() { return raw.team_b_away_form; },
      function() { return raw.away_form; },
      function() { return raw.team_b_form; },
      function() { return raw.awayForm; },
      function() { return teamRaw?.away_form; },
      function() { return teamRaw?.form; },
      function() { return teamRaw?.recent_form; }
    ];

    const value = pickValue(data, paths, "");
    if (Array.isArray(value)) return value.slice(0, 5).map(normalizeFormItem);

    const clean = String(value || "").replace(/[^A-Za-zVvEePp]/g, "");
    return clean ? clean.slice(0, 5).split("").map(normalizeFormItem) : [];
  }

  function renderFormBadges(items) {
    if (!items.length) return `<span class="form-empty">Sem forma</span>`;

    return items.map(function(item) {
      const klass = item === "V" ? "w" : item === "E" ? "d" : item === "D" ? "l" : "d";
      return `<span class="${klass}">${escapeHTML(item)}</span>`;
    }).join("");
  }

  function readTeamNameFromMatch(match, side, currentName) {
    if (!match || typeof match !== "object") return currentName;
    const home = match.home_name || match.homeName || match.team_a_name || match.home || match.home_team_name;
    const away = match.away_name || match.awayName || match.team_b_name || match.away || match.away_team_name;
    const picked = side === "home" ? home : away;
    return picked || currentName;
  }

  function readScoreFromMatch(match) {
    if (!match || typeof match !== "object") return "-";
    const home = pickValue(match, ["homeGoalCount", "home_goals", "homeGoals", "team_a_goals"], null);
    const away = pickValue(match, ["awayGoalCount", "away_goals", "awayGoals", "team_b_goals"], null);
    if (home !== null && away !== null) return `${home} - ${away}`;
    return match.score || match.result || "-";
  }

  function findRecentMatches(data, side) {
    const raw = getRawMatch(data);
    const trends = side === "home" ? raw.trends?.team_a : raw.trends?.team_b;
    const teamRaw = side === "home" ? data.teams?.home?.raw : data.teams?.away?.raw;
    const candidates = side === "home" ? [
      raw.team_a_home_matches,
      raw.home_recent_matches,
      raw.team_a_last_matches,
      trends?.recent_matches,
      teamRaw?.home_matches,
      teamRaw?.recent_matches,
      teamRaw?.last_matches
    ] : [
      raw.team_b_away_matches,
      raw.away_recent_matches,
      raw.team_b_last_matches,
      trends?.recent_matches,
      teamRaw?.away_matches,
      teamRaw?.recent_matches,
      teamRaw?.last_matches
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) return candidate.slice(0, 5);
    }

    return [];
  }

  function renderRecentRows(data, side) {
    const rows = findRecentMatches(data, side);

    if (!rows.length) return `<div class="complete-empty-mini">Últimos jogos não disponíveis na API.</div>`;

    return rows.map(function(row) {
      const team = readTeamNameFromMatch(row, side, side === "home" ? homeName() : awayName());
      const opponent = side === "home"
        ? readTeamNameFromMatch(row, "away", "Adversário")
        : readTeamNameFromMatch(row, "home", "Adversário");

      return `
        <div class="complete-form-row">
          <strong>${escapeHTML(team)}</strong>
          <span>${escapeHTML(readScoreFromMatch(row))}</span>
          <em>${escapeHTML(opponent)}</em>
        </div>
      `;
    }).join("");
  }

  function getPpg(data, side) {
    const raw = getRawMatch(data);

    return side === "home"
      ? pickValue(data, ["teams.home.ppg", "teams.home.pre_match_ppg", "teams.home.overall_pre_match_ppg", function() { return raw.home_ppg; }, function() { return raw.pre_match_home_ppg; }], null)
      : pickValue(data, ["teams.away.ppg", "teams.away.pre_match_ppg", "teams.away.overall_pre_match_ppg", function() { return raw.away_ppg; }, function() { return raw.pre_match_away_ppg; }], null);
  }

  function getBalance(data) {
    const homeNumber = numberValue(getPpg(data, "home")) || 0;
    const awayNumber = numberValue(getPpg(data, "away")) || 0;
    const homeWidth = numberValue(getPpg(data, "home")) === null && numberValue(getPpg(data, "away")) === null
      ? 50
      : Math.max(8, Math.min(92, (homeNumber / Math.max(homeNumber + awayNumber, 0.01)) * 100));

    return {
      homeNumber,
      awayNumber,
      homeWidth,
      awayWidth: 100 - homeWidth,
      diff: Math.abs(homeNumber - awayNumber),
      better: homeNumber >= awayNumber ? homeName() : awayName()
    };
  }

  function renderCurrentForm(data) {
    const balance = getBalance(data);
    const homePpg = getPpg(data, "home");
    const awayPpg = getPpg(data, "away");
    const betterText = balance.diff
      ? `${balance.better} está ${displayDecimal(balance.diff, " PPG")} melhor em pontos por jogo.`
      : "Equilíbrio nos pontos por jogo.";

    return `
      <div class="complete-section-title"><span>Forma Atual</span><strong>Quem Vai Vencer?</strong></div>
      <div class="complete-form-layout">
        <div class="complete-form-team">
          <h3>Forma - Mandante</h3>
          <div class="complete-team-line">
            ${renderLogo("home")}
            <div><strong>${escapeHTML(displayDecimal(homePpg))}</strong><div class="form">${renderFormBadges(getFormSequence(data, "home"))}</div></div>
          </div>
          <div class="complete-form-tabs"><span>Todos</span><b>Mandante</b><span>Visitante</span></div>
          <div class="complete-form-list">${renderRecentRows(data, "home")}</div>
        </div>
        <div class="complete-form-center">
          <div class="complete-balance-bar" style="--home:${balance.homeWidth}%; --away:${balance.awayWidth}%"><span></span><i></i></div>
          <p>${escapeHTML(betterText)}</p>
        </div>
        <div class="complete-form-team away">
          <h3>Forma - Visitante</h3>
          <div class="complete-team-line reverse">
            <div><strong>${escapeHTML(displayDecimal(awayPpg))}</strong><div class="form">${renderFormBadges(getFormSequence(data, "away"))}</div></div>
            ${renderLogo("away")}
          </div>
          <div class="complete-form-tabs"><span>Todos</span><span>Mandante</span><b>Visitante</b></div>
          <div class="complete-form-list">${renderRecentRows(data, "away")}</div>
        </div>
      </div>
    `;
  }

  function renderPredictionCard(data, label, value, average, tone, suffix) {
    const display = suffix === "decimal" ? displayDecimal(value) : displayPct(value);
    const avg = suffix === "decimal" ? displayDecimal(average) : displayPct(average);

    return `
      <article class="complete-pred-card ${tone || metricTone(value)}">
        <strong>${escapeHTML(display)}</strong><span>${escapeHTML(label)}</span>
        <small>Média da ${escapeHTML(getLeagueNameFromData(data))}: ${escapeHTML(avg)}</small>
      </article>
    `;
  }

  function renderPredictionStats(data) {
    const raw = getRawMatch(data);

    return `
      <div class="complete-unified-divider"></div>
      <div class="complete-section-title compact"><span>Estatísticas de Previsão</span><strong>${escapeHTML(homeName())} x ${escapeHTML(awayName())}</strong></div>
      <div class="complete-pred-grid">
        ${renderPredictionCard(data, "Mais de 2.5", data.potentials?.goals?.over25, raw.league_o25 || raw.over_25_league_average, metricTone(data.potentials?.goals?.over25))}
        ${renderPredictionCard(data, "Mais de 1.5", data.potentials?.goals?.over15, raw.league_o15 || raw.over_15_league_average, metricTone(data.potentials?.goals?.over15))}
        ${renderPredictionCard(data, "Ambas Marcam", data.potentials?.btts?.full_time, raw.league_btts || raw.btts_league_average, metricTone(data.potentials?.btts?.full_time))}
        ${renderPredictionCard(data, "Gols / Jogo", data.potentials?.goals?.avg || data.score?.total_goals, raw.league_avg_goals || raw.average_goals, "mid", "decimal")}
        ${renderPredictionCard(data, "Cartões", data.potentials?.cards?.total || data.cards?.full_time?.total, raw.league_cards_avg || raw.cards_potential, "mid", "decimal")}
        ${renderPredictionCard(data, "Escanteios", data.potentials?.corners?.total || data.corners?.full_time?.total, raw.league_corners_avg || raw.corners_potential, "good", "decimal")}
      </div>
    `;
  }

  function getH2HRows(data) {
    const raw = getRawMatch(data);
    const h2h = raw.h2h || data.h2h;
    const candidates = [h2h?.previous_matches, h2h?.matches, h2h?.fixtures, raw.h2h_matches, raw.previous_matches, raw.previous_matches_results];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) return candidate;
    }

    return [];
  }

  function getH2HSummary(data) {
    const raw = getRawMatch(data);
    return raw.h2h || data.h2h || {};
  }

  function h2hScore(row) {
    const home = pickValue(row, ["homeGoalCount", "home_goals", "homeGoals", "team_a_goals"], null);
    const away = pickValue(row, ["awayGoalCount", "away_goals", "awayGoals", "team_b_goals"], null);
    return home !== null && away !== null ? `${home}-${away}` : readScoreFromMatch(row);
  }

  function getH2HStats(data) {
    const rows = getH2HRows(data);
    const summary = getH2HSummary(data);
    let homeWins = numberValue(summary.team_a_wins || summary.home_wins) || 0;
    let awayWins = numberValue(summary.team_b_wins || summary.away_wins) || 0;
    let draws = numberValue(summary.draws) || 0;
    let over15 = numberValue(summary.over15 || summary.o15 || summary.over_15) || 0;
    let over25 = numberValue(summary.over25 || summary.o25 || summary.over_25) || 0;
    let over35 = numberValue(summary.over35 || summary.o35 || summary.over_35) || 0;
    let btts = numberValue(summary.btts) || 0;
    let homeClean = numberValue(summary.team_a_clean_sheets || summary.home_clean_sheets) || 0;
    let awayClean = numberValue(summary.team_b_clean_sheets || summary.away_clean_sheets) || 0;

    if (rows.length) {
      homeWins = 0; awayWins = 0; draws = 0; over15 = 0; over25 = 0; over35 = 0; btts = 0; homeClean = 0; awayClean = 0;
      rows.forEach(function(row) {
        const homeGoals = numberValue(pickValue(row, ["homeGoalCount", "home_goals", "homeGoals", "team_a_goals"], null));
        const awayGoals = numberValue(pickValue(row, ["awayGoalCount", "away_goals", "awayGoals", "team_b_goals"], null));
        if (homeGoals === null || awayGoals === null) return;
        const totalGoals = homeGoals + awayGoals;
        if (homeGoals > awayGoals) homeWins += 1;
        else if (awayGoals > homeGoals) awayWins += 1;
        else draws += 1;
        if (totalGoals > 1.5) over15 += 1;
        if (totalGoals > 2.5) over25 += 1;
        if (totalGoals > 3.5) over35 += 1;
        if (homeGoals > 0 && awayGoals > 0) btts += 1;
        if (awayGoals === 0) homeClean += 1;
        if (homeGoals === 0) awayClean += 1;
      });
    }

    const total = rows.length || numberValue(summary.total_matches || summary.matches || summary.total) || 0;
    return { rows, total, homeWins, awayWins, draws, over15, over25, over35, btts, homeClean, awayClean };
  }

  function percentFromCount(count, total) {
    if (!total) return "-";
    return `${Math.round((count / total) * 100)}%`;
  }

  function renderH2HMetric(label, count, total, sublabel) {
    return `
      <article class="complete-h2h-metric ${metricTone(total ? (count / total) * 100 : null)}">
        <strong>${escapeHTML(percentFromCount(count, total))}</strong><span>${escapeHTML(label)}</span>
        <small>${escapeHTML(total ? `${count} / ${total} partidas${sublabel ? ` - ${sublabel}` : ""}` : "Dados indisponíveis")}</small>
      </article>
    `;
  }

  function renderH2HFixtures(rows) {
    if (!rows.length) return `<div class="complete-empty-mini">Histórico direto não disponível no retorno atual da API.</div>`;

    return rows.slice(0, 8).map(function(row) {
      const dateRaw = row.date || row.match_date || row.date_unix || row.timestamp || "";
      const date = Number.isFinite(Number(dateRaw))
        ? new Date(Number(dateRaw) * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
        : String(dateRaw || "-").slice(0, 12);
      const home = readTeamNameFromMatch(row, "home", homeName());
      const away = readTeamNameFromMatch(row, "away", awayName());
      return `<article class="complete-h2h-fixture"><span>${escapeHTML(date)}</span><strong>${escapeHTML(home)} <b>${escapeHTML(h2hScore(row))}</b></strong><em>${escapeHTML(away)}</em></article>`;
    }).join("");
  }

  function renderH2H(data) {
    const stats = getH2HStats(data);
    const total = stats.total;
    const homePct = total ? Math.round((stats.homeWins / total) * 100) : 33;
    const drawPct = total ? Math.round((stats.draws / total) * 100) : 34;
    const awayPct = total ? Math.max(0, 100 - homePct - drawPct) : 33;

    return `
      <section class="card complete-h2h-card">
        <div class="complete-section-title"><span>Estatísticas do Confronto Direto</span><strong>${escapeHTML(homeName())} x ${escapeHTML(awayName())}</strong></div>
        <div class="complete-h2h-top">
          <div class="complete-h2h-team">${renderLogo("home")}<strong>${escapeHTML(homeName())}</strong><span>${stats.homeWins} vitórias (${escapeHTML(percentFromCount(stats.homeWins, total))})</span></div>
          <div class="complete-h2h-center">
            <strong>${escapeHTML(total || "-")}</strong><span>Partidas</span>
            <div class="complete-h2h-bar" style="--home:${homePct}%; --draw:${drawPct}%; --away:${awayPct}%"><span>${homePct}%</span><i>${drawPct}%</i><b>${awayPct}%</b></div>
            <div class="complete-h2h-labels"><span>${stats.homeWins} vitórias</span><span>${stats.draws} empates</span><span>${stats.awayWins} vitórias</span></div>
          </div>
          <div class="complete-h2h-team">${renderLogo("away")}<strong>${escapeHTML(awayName())}</strong><span>${stats.awayWins} vitórias (${escapeHTML(percentFromCount(stats.awayWins, total))})</span></div>
        </div>
        <p class="complete-h2h-copy">O histórico direto mostra ${escapeHTML(total || "-")} partidas entre ${escapeHTML(homeName())} e ${escapeHTML(awayName())}. ${escapeHTML(homeName())} venceu ${stats.homeWins}, houve ${stats.draws} empates e ${escapeHTML(awayName())} venceu ${stats.awayWins}.</p>
        <div class="complete-h2h-metrics">
          ${renderH2HMetric("Mais de 1.5", stats.over15, total)}
          ${renderH2HMetric("Mais de 2.5", stats.over25, total)}
          ${renderH2HMetric("Mais de 3.5", stats.over35, total)}
          ${renderH2HMetric("Ambas Marcam", stats.btts, total)}
          ${renderH2HMetric("Sem Sofrer Gol", stats.homeClean, total, homeName())}
          ${renderH2HMetric("Sem Sofrer Gol", stats.awayClean, total, awayName())}
        </div>
        <div class="complete-h2h-strip"><div class="complete-strip-title">Resultados e jogos anteriores do confronto direto</div><div class="complete-h2h-scroll">${renderH2HFixtures(stats.rows)}</div></div>
      </section>
    `;
  }

  function renderAiInsight(data) {
    const over15 = numberValue(data.potentials?.goals?.over15);
    const over25 = numberValue(data.potentials?.goals?.over25);
    const btts = numberValue(data.potentials?.btts?.full_time);
    const corners = numberValue(data.potentials?.corners?.total || data.corners?.full_time?.total);
    const h2hTotal = getH2HStats(data).total;
    const balance = getBalance(data);
    const bestMarket = over25 !== null && over25 >= 55 ? "Mais de 2.5 gols" : btts !== null && btts >= 55 ? "Ambas Marcam" : over15 !== null ? "Mais de 1.5 gols" : "mercado principal";
    const tendency = over15 !== null && over15 >= 55 ? "Tendência ofensiva" : "Tendência moderada";
    const alertText = h2hTotal ? `${h2hTotal} confrontos diretos mapeados.` : "Histórico direto limitado no retorno da API.";
    const lead = balance.diff
      ? `${balance.better} chega melhor no recorte de forma, com diferença de ${displayDecimal(balance.diff, " PPG")}.`
      : "A forma atual aparece equilibrada entre as equipes.";

    return `
      <section class="complete-ai-card">
        <div class="complete-ai-copy">
          <span>Insight da IA</span>
          <p>${escapeHTML(lead)} Para pré-jogo, o mercado observado é ${escapeHTML(bestMarket)}, com atenção ao ritmo ofensivo e à confirmação das escalações.</p>
        </div>
        <div class="complete-ai-metrics">
          <article><span>⚙</span><strong>${escapeHTML(tendency)}</strong><small>${escapeHTML(over15 !== null ? `Probabilidade de ${displayPct(over15)} para Mais de 1.5` : "Dados ofensivos em análise")}</small></article>
          <article><span>↗</span><strong>Mercado observado</strong><small>${escapeHTML(bestMarket)}${over25 !== null ? ` em ${displayPct(over25)}` : ""}</small></article>
          <article><span>⚠</span><strong>Alerta</strong><small>${escapeHTML(alertText)}${corners !== null ? ` Média de escanteios: ${displayDecimal(corners)}.` : ""}</small></article>
        </div>
      </section>
    `;
  }

  function renderUnifiedCard(data) {
    return `
      <section class="card complete-unified-card">
        ${renderCurrentForm(data)}
        ${renderPredictionStats(data)}
      </section>
    `;
  }

  renderCompletas = function renderCompletasFootyStats() {
    const data = complete();
    if (!data) return renderLoadingFallback();

    loadFootyStatsDetails(data);

    return `
      ${renderAiInsight(data)}
      ${renderUnifiedCard(data)}
      ${renderH2H(data)}
    `;
  };
})();
