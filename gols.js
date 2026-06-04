(function() {
  function valueExists(value) {
    return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1";
  }

  function rawMatch(data) {
    return data?.raw?.match_details || data?.raw?.match || selectedMatch?.raw || {};
  }

  function escape(value) {
    return typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? "");
  }

  function teamLogo(side) {
    const data = selectedMatch?.complete;
    const logo = side === "home"
      ? data?.teams?.home?.image || selectedMatch?.homeLogo
      : data?.teams?.away?.image || selectedMatch?.awayLogo;

    const name = side === "home" ? homeName() : awayName();
    const short = makeShortName(name);

    if (logo) {
      return `<img class="gols-team-logo" src="${escape(logo)}" alt="${escape(name)}" onerror="this.outerHTML='<span class=&quot;gols-team-fallback&quot;>${escape(short)}</span>'">`;
    }

    return `<span class="gols-team-fallback">${escape(short)}</span>`;
  }

  function makeShortName(name) {
    return String(name || "T")
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(function(part) { return part[0]; })
      .join("")
      .toUpperCase()
      .slice(0, 3) || "T";
  }

  function getIds(data) {
    const raw = rawMatch(data);
    return {
      season: data?.ids?.season_id || selectedMatch?.seasonId || raw.competition_id || raw.league_id || raw.season_id || "",
      match: data?.ids?.match_id || selectedMatch?.matchId || raw.id || raw.match_id || "",
      home: data?.ids?.home_id || raw.homeID || raw.home_id || raw.team_a_id || selectedMatch?.raw?.homeID || "",
      away: data?.ids?.away_id || raw.awayID || raw.away_id || raw.team_b_id || selectedMatch?.raw?.awayID || "",
      date: data?.status?.date_unix || raw.date_unix || ""
    };
  }

  function needsGolsData(data) {
    const ids = getIds(data);
    return Boolean(data && ids.season && ids.home && ids.away && !data._golsLoading && !data._golsLoaded && !data._golsError);
  }

  async function loadGolsData(data) {
    if (!needsGolsData(data)) return;

    const ids = getIds(data);
    data._golsLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        match_id: ids.match,
        home_id: ids.home,
        away_id: ids.away
      });

      if (ids.date) params.set("date_unix", ids.date);

      const response = await fetch(`/api/gols?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Dados de gols indisponíveis.");
      }

      data._golsData = payload.data;
      data._golsLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.gols = payload.diagnostics || null;
    } catch (error) {
      data._golsError = error.message;
    } finally {
      data._golsLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "gols") {
        renderTab("gols");
      }
    }
  }

  function pct(value) {
    if (!valueExists(value)) return "-";
    return `${Math.round(Number(value))}%`;
  }

  function avg(value) {
    if (!valueExists(value)) return "-";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return String(Number(number.toFixed(2)));
  }

  function averagePercent(homeValue, awayValue) {
    if (!valueExists(homeValue) && !valueExists(awayValue)) return null;
    const values = [homeValue, awayValue].filter(valueExists).map(Number);
    return Math.round(values.reduce(function(total, value) { return total + value; }, 0) / values.length);
  }

  function betterText(metric, type) {
    const data = selectedMatch?.complete?._golsData;
    if (!data) return "Dados de gols carregando.";

    const homeValue = Number(metric(data.home));
    const awayValue = Number(metric(data.away));

    if (!Number.isFinite(homeValue) || !Number.isFinite(awayValue)) return "Histórico insuficiente para comparar.";

    const homeBetter = type === "conceded" ? homeValue < awayValue : homeValue > awayValue;
    const leader = homeValue === awayValue ? null : homeBetter ? homeName() : awayName();
    const base = type === "conceded" ? Math.max(homeValue, awayValue) : Math.min(homeValue, awayValue);
    const diff = Math.abs(homeValue - awayValue);
    const percent = base > 0 ? Math.round((diff / base) * 100) : Math.round(diff * 100);
    const label = type === "conceded" ? "gols sofridos" : "gols marcados";

    if (!leader || percent === 0) return `Equilíbrio em ${label}.`;
    return `${leader} é +${percent}% melhor em ${label}.`;
  }

  function row(label, homeValue, awayValue, formatter) {
    const home = formatter(homeValue);
    const away = formatter(awayValue);
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heatClass(homeValue)}">${escape(home)}</td>
        <td class="${heatClass(awayValue)}">${escape(away)}</td>
      </tr>
    `;
  }

  function avgRow(label, homeValue, awayValue, formatter) {
    const average = averagePercent(homeValue, awayValue);
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heatClass(homeValue)}">${escape(formatter(homeValue))}</td>
        <td class="${heatClass(awayValue)}">${escape(formatter(awayValue))}</td>
        <td class="${heatClass(average)}">${escape(formatter(average))}</td>
      </tr>
    `;
  }

  function heatClass(value) {
    if (!valueExists(value)) return "gols-heat-empty";
    const number = Number(value);
    if (!Number.isFinite(number)) return "gols-heat-mid";
    if (number >= 75) return "gols-heat-high";
    if (number >= 45) return "gols-heat-mid";
    return "gols-heat-low";
  }

  function comparisonBars(kind) {
    const goals = selectedMatch?.complete?._golsData;
    const homeStats = goals?.home;
    const awayStats = goals?.away;
    const homeValue = kind === "scored" ? homeStats?.scored?.avg : homeStats?.conceded?.avg;
    const awayValue = kind === "scored" ? awayStats?.scored?.avg : awayStats?.conceded?.avg;
    const max = Math.max(Number(homeValue || 0), Number(awayValue || 0), 1);
    const homeWidth = Math.max(10, Math.round((Number(homeValue || 0) / max) * 100));
    const awayWidth = Math.max(10, Math.round((Number(awayValue || 0) / max) * 100));
    const label = kind === "scored" ? "Gols / Jogo" : "Sofridos / Jogo";
    const homeContext = kind === "scored" ? `${homeName()} em casa` : `${homeName()} em casa`;
    const awayContext = kind === "scored" ? `${awayName()} fora` : `${awayName()} fora`;

    return `
      <div class="gols-bars">
        <div class="gols-bar-row home">
          ${teamLogo("home")}
          <div>
            <div class="gols-bar-fill" style="width: ${homeWidth}%"><strong>${escape(avg(homeValue))} ${escape(label)}</strong></div>
            <small>${escape(homeContext)}</small>
          </div>
        </div>
        <div class="gols-bar-row away">
          ${teamLogo("away")}
          <div>
            <div class="gols-bar-fill" style="width: ${awayWidth}%"><strong>${escape(avg(awayValue))} ${escape(label)}</strong></div>
            <small>${escape(awayContext)}</small>
          </div>
        </div>
      </div>
    `;
  }

  function tabs(cardId, active) {
    return `
      <div class="gols-subtabs" data-card="${escape(cardId)}">
        <button class="gols-tab-button ${active === "full" ? "active" : ""}" type="button" data-target="full">Tempo Todo</button>
        <button class="gols-tab-button ${active === "half" ? "active" : ""}" type="button" data-target="half">1º / 2º Tempo</button>
      </div>
    `;
  }

  function predictionTabs() {
    return `
      <div class="gols-subtabs three" data-card="predictions">
        <button class="gols-tab-button active" type="button" data-target="over">⚽ Over X Gols</button>
        <button class="gols-tab-button" type="button" data-target="half">1º / 2º Tempo</button>
        <button class="gols-tab-button" type="button" data-target="under">Under X Gols</button>
      </div>
    `;
  }

  function scoredCard(data) {
    return `
      <section class="gols-card" data-gols-card="scored">
        <header class="gols-title"><span>⚽ Gols Marcados</span><em>Quem vai marcar mais?</em></header>
        <p class="gols-comparison">${escape(betterText(function(team) { return team.scored?.avg; }, "scored"))}</p>
        ${comparisonBars("scored")}
        ${tabs("scored", "full")}
        <div class="gols-panel active" data-panel="full">
          ${golsTable("Marcados por jogo", [
            row("Mais de 0.5", data.home.scored?.over05, data.away.scored?.over05, pct),
            row("Mais de 1.5", data.home.scored?.over15, data.away.scored?.over15, pct),
            row("Mais de 2.5", data.home.scored?.over25, data.away.scored?.over25, pct),
            row("Mais de 3.5", data.home.scored?.over35, data.away.scored?.over35, pct),
            row("Não marcou", data.home.scored?.failed, data.away.scored?.failed, pct)
          ])}
        </div>
        <div class="gols-panel" data-panel="half">
          ${golsTable("Marcados 1º/2º tempo", [
            row("Marcou no 1ºT", data.home.scored?.first, data.away.scored?.first, pct),
            row("Marcou no 2ºT", data.home.scored?.second, data.away.scored?.second, pct),
            row("Marcou nos dois tempos", data.home.scored?.both_halves, data.away.scored?.both_halves, pct),
            row("Média marcada 1ºT", data.home.scored?.avg_first, data.away.scored?.avg_first, avg),
            row("Média marcada 2ºT", data.home.scored?.avg_second, data.away.scored?.avg_second, avg)
          ])}
        </div>
        <p class="gols-note">* Estatísticas do mando de ${escape(homeName())} e dos jogos fora de ${escape(awayName())}.</p>
      </section>
    `;
  }

  function concededCard(data) {
    return `
      <section class="gols-card" data-gols-card="conceded">
        <header class="gols-title conceded"><span>⚽ Gols Sofridos</span><em>Quem vai sofrer menos?</em></header>
        <p class="gols-comparison">${escape(betterText(function(team) { return team.conceded?.avg; }, "conceded"))}</p>
        ${comparisonBars("conceded")}
        ${tabs("conceded", "full")}
        <div class="gols-panel active" data-panel="full">
          ${golsTable("Sofridos por jogo", [
            row("Mais de 0.5", data.home.conceded?.over05, data.away.conceded?.over05, pct),
            row("Mais de 1.5", data.home.conceded?.over15, data.away.conceded?.over15, pct),
            row("Mais de 2.5", data.home.conceded?.over25, data.away.conceded?.over25, pct),
            row("Mais de 3.5", data.home.conceded?.over35, data.away.conceded?.over35, pct),
            row("Sem sofrer gol", data.home.conceded?.clean_sheets, data.away.conceded?.clean_sheets, pct)
          ])}
        </div>
        <div class="gols-panel" data-panel="half">
          ${golsTable("Sofridos 1º/2º tempo", [
            row("1ºT sem sofrer gol", data.home.conceded?.clean_first, data.away.conceded?.clean_first, pct),
            row("2ºT sem sofrer gol", data.home.conceded?.clean_second, data.away.conceded?.clean_second, pct),
            row("Média sofrida 1ºT", data.home.conceded?.avg_first, data.away.conceded?.avg_first, avg),
            row("Média sofrida 2ºT", data.home.conceded?.avg_second, data.away.conceded?.avg_second, avg)
          ])}
        </div>
        <p class="gols-note">* Estatísticas defensivas do mando de ${escape(homeName())} e dos jogos fora de ${escape(awayName())}.</p>
      </section>
    `;
  }

  function predictionsCard(data) {
    return `
      <section class="gols-card" data-gols-card="predictions">
        <header class="gols-title"><span>Previsões Over 2.5 e Ambas Marcam</span><em>Quantos gols nesta partida?</em></header>
        <p class="gols-intro">Dados de Over 0.5 até 4.5 e Ambas Marcam para ${escape(homeName())} em casa e ${escape(awayName())} fora.</p>
        ${predictionTabs()}
        <div class="gols-panel active" data-panel="over">
          ${golsAverageTable("Gols da partida", [
            avgRow("Mais de 0.5", data.home.match_goals?.over05, data.away.match_goals?.over05, pct),
            avgRow("Mais de 1.5", data.home.match_goals?.over15, data.away.match_goals?.over15, pct),
            avgRow("Mais de 2.5", data.home.match_goals?.over25, data.away.match_goals?.over25, pct),
            avgRow("Mais de 3.5", data.home.match_goals?.over35, data.away.match_goals?.over35, pct),
            avgRow("Mais de 4.5", data.home.match_goals?.over45, data.away.match_goals?.over45, pct),
            avgRow("Ambas marcam", data.home.match_goals?.btts, data.away.match_goals?.btts, pct),
            avgRow("Ambas marcam e vence", data.home.match_goals?.btts_win, data.away.match_goals?.btts_win, pct),
            avgRow("Ambas marcam e empate", data.home.match_goals?.btts_draw, data.away.match_goals?.btts_draw, pct),
            avgRow("Ambas marcam e +2.5", data.home.match_goals?.btts_over25, data.away.match_goals?.btts_over25, pct),
            avgRow("Não ambas e +2.5", data.home.match_goals?.btts_no_over25, data.away.match_goals?.btts_no_over25, pct)
          ])}
        </div>
        <div class="gols-panel" data-panel="half">
          ${golsAverageTable("Gols 1º tempo", [
            avgRow("Ambas marcam 1ºT", data.home.halves?.btts_first, data.away.halves?.btts_first, pct),
            avgRow("Mais de 0.5 1ºT", data.home.halves?.over05_first, data.away.halves?.over05_first, pct),
            avgRow("Mais de 1.5 1ºT", data.home.halves?.over15_first, data.away.halves?.over15_first, pct),
            avgRow("Mais de 2.5 1ºT", data.home.halves?.over25_first, data.away.halves?.over25_first, pct)
          ])}
          ${golsAverageTable("Gols 2º tempo", [
            avgRow("Ambas marcam 2ºT", data.home.halves?.btts_second, data.away.halves?.btts_second, pct),
            avgRow("Ambas nos dois tempos", data.home.halves?.btts_both_halves, data.away.halves?.btts_both_halves, pct),
            avgRow("Mais de 0.5 2ºT", data.home.halves?.over05_second, data.away.halves?.over05_second, pct),
            avgRow("Mais de 1.5 2ºT", data.home.halves?.over15_second, data.away.halves?.over15_second, pct),
            avgRow("Mais de 2.5 2ºT", data.home.halves?.over25_second, data.away.halves?.over25_second, pct)
          ])}
        </div>
        <div class="gols-panel" data-panel="under">
          ${golsAverageTable("Under X Gols", [
            avgRow("Menos de 0.5", data.home.match_goals?.under05, data.away.match_goals?.under05, pct),
            avgRow("Menos de 1.5", data.home.match_goals?.under15, data.away.match_goals?.under15, pct),
            avgRow("Menos de 2.5", data.home.match_goals?.under25, data.away.match_goals?.under25, pct),
            avgRow("Menos de 3.5", data.home.match_goals?.under35, data.away.match_goals?.under35, pct),
            avgRow("Menos de 4.5", data.home.match_goals?.under45, data.away.match_goals?.under45, pct)
          ])}
          ${golsAverageTable("Under 1º/2º tempo", [
            avgRow("Menos de 0.5 1ºT", data.home.halves?.under05_first, data.away.halves?.under05_first, pct),
            avgRow("Menos de 1.5 1ºT", data.home.halves?.under15_first, data.away.halves?.under15_first, pct),
            avgRow("Menos de 2.5 1ºT", data.home.halves?.under25_first, data.away.halves?.under25_first, pct),
            avgRow("Menos de 0.5 2ºT", data.home.halves?.under05_second, data.away.halves?.under05_second, pct),
            avgRow("Menos de 1.5 2ºT", data.home.halves?.under15_second, data.away.halves?.under15_second, pct),
            avgRow("Menos de 2.5 2ºT", data.home.halves?.under25_second, data.away.halves?.under25_second, pct)
          ])}
        </div>
      </section>
    `;
  }

  function golsTable(title, rows) {
    return `
      <table class="gols-table">
        <thead><tr><th>${escape(title)}</th><th>${escape(homeName())}</th><th>${escape(awayName())}</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  }

  function golsAverageTable(title, rows) {
    return `
      <table class="gols-table">
        <thead><tr><th>${escape(title)}</th><th>${escape(homeName())}</th><th>${escape(awayName())}</th><th>Média</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  }

  function renderGolsView() {
    const data = selectedMatch?.complete;

    if (!data) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadGolsData(data);

    if (data._golsError) {
      return `<article class="card"><h2>Gols</h2><p class="small-note">${escape(data._golsError)}</p></article>`;
    }

    if (!data._golsLoaded || !data._golsData) {
      return `<article class="card"><h2>Carregando aba Gols...</h2><p class="small-note">Buscando histórico real de gols na FootyStats.</p></article>`;
    }

    return `
      <div class="gols-view">
        ${scoredCard(data._golsData)}
        ${concededCard(data._golsData)}
        ${predictionsCard(data._golsData)}
      </div>
    `;
  }

  document.addEventListener("click", function(event) {
    const button = event.target.closest(".gols-tab-button");
    if (!button) return;

    const card = button.closest(".gols-card");
    const target = button.dataset.target;
    if (!card || !target) return;

    card.querySelectorAll(".gols-tab-button").forEach(function(item) {
      item.classList.toggle("active", item === button);
    });

    card.querySelectorAll(".gols-panel").forEach(function(panel) {
      panel.classList.toggle("active", panel.dataset.panel === target);
    });
  });

  if (typeof renderGols === "function") {
    renderGols = renderGolsView;
  }
})();
