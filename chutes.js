(function() {
  function exists(value) {
    return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1";
  }

  function escape(value) {
    return typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? "");
  }

  function rawMatch(data) {
    return data?.raw?.match_details || data?.raw?.match || selectedMatch?.raw || {};
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

  function needsData(data) {
    const ids = getIds(data);
    return Boolean(data && ids.season && ids.home && ids.away && !data._chutesLoading && !data._chutesLoaded && !data._chutesError);
  }

  async function loadChutesData(data) {
    if (!needsData(data)) return;

    const ids = getIds(data);
    data._chutesLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        match_id: ids.match,
        home_id: ids.home,
        away_id: ids.away
      });

      if (ids.date) params.set("date_unix", ids.date);

      const response = await fetch(`/api/chutes?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Dados de chutes indisponíveis.");
      }

      data._chutesData = payload.data;
      data._chutesLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.chutes = payload.diagnostics || null;
    } catch (error) {
      data._chutesError = error.message;
    } finally {
      data._chutesLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "chutes") {
        renderTab("chutes");
      }
    }
  }

  function pct(value) {
    if (!exists(value)) return "-";
    return `${Math.round(Number(value))}%`;
  }

  function avg(value) {
    if (!exists(value)) return "-";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return String(Number(number.toFixed(2)));
  }

  function pctAvg(value) {
    if (!exists(value)) return "-";
    return `${Math.round(Number(value))}%`;
  }

  function average(values) {
    const valid = values.filter(exists).map(Number).filter(Number.isFinite);
    if (!valid.length) return null;
    return Math.round(valid.reduce(function(total, value) { return total + value; }, 0) / valid.length);
  }

  function averageNumber(values) {
    const valid = values.filter(exists).map(Number).filter(Number.isFinite);
    if (!valid.length) return null;
    return Number((valid.reduce(function(total, value) { return total + value; }, 0) / valid.length).toFixed(2));
  }

  function heat(value, scale) {
    if (!exists(value)) return "shots-empty";
    const number = Number(value) * (scale || 1);
    if (!Number.isFinite(number)) return "shots-mid";
    if (number >= 75) return "shots-high";
    if (number >= 45) return "shots-mid";
    return "shots-low";
  }

  function row(label, homeValue, awayValue, formatter) {
    const avgValue = average([homeValue, awayValue]);
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heat(homeValue)}">${escape(formatter(homeValue))}</td>
        <td class="${heat(awayValue)}">${escape(formatter(awayValue))}</td>
        <td class="${heat(avgValue)}">${escape(formatter(avgValue))}</td>
      </tr>
    `;
  }

  function numberRow(label, homeValue, awayValue, scale) {
    const avgValue = averageNumber([homeValue, awayValue]);
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heat(homeValue, scale || 8)}">${escape(avg(homeValue))}</td>
        <td class="${heat(awayValue, scale || 8)}">${escape(avg(awayValue))}</td>
        <td class="${heat(avgValue, scale || 8)}">${escape(avg(avgValue))}</td>
      </tr>
    `;
  }

  function percentRow(label, homeValue, awayValue) {
    const avgValue = averageNumber([homeValue, awayValue]);
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heat(homeValue)}">${escape(pctAvg(homeValue))}</td>
        <td class="${heat(awayValue)}">${escape(pctAvg(awayValue))}</td>
        <td class="${heat(avgValue)}">${escape(pctAvg(avgValue))}</td>
      </tr>
    `;
  }

  function table(title, rows) {
    return `
      <table class="shots-table">
        <thead><tr><th>${escape(title)}</th><th>${escape(homeName())}</th><th>${escape(awayName())}</th><th>Média</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  }

  function tabs(card, buttons) {
    return `
      <div class="shots-subtabs ${buttons.length === 3 ? "three" : ""}" data-card="${escape(card)}">
        ${buttons.map(function(button, index) {
          return `<button class="shots-tab-button ${index === 0 ? "active" : ""}" type="button" data-target="${escape(button.target)}">${escape(button.label)}</button>`;
        }).join("")}
      </div>
    `;
  }

  function repeatedStats(data) {
    return `
      ${table("Impedimentos", [
        numberRow("Impedimentos / jogo", data.home.offsides?.avg, data.away.offsides?.avg, 20),
        row("Mais de 2.5 impedimentos", data.home.offsides?.over25, data.away.offsides?.over25, pct),
        row("Mais de 3.5 impedimentos", data.home.offsides?.over35, data.away.offsides?.over35, pct)
      ])}
      ${table("Outras estatísticas", [
        numberRow("Faltas cometidas / jogo", data.home.misc?.fouls_committed_avg, data.away.misc?.fouls_committed_avg, 7),
        numberRow("Faltas sofridas / jogo", data.home.misc?.fouled_against_avg, data.away.misc?.fouled_against_avg, 7),
        percentRow("Posse média", data.home.misc?.possession_avg, data.away.misc?.possession_avg),
        row("Empate no FT", data.home.misc?.draw_ft, data.away.misc?.draw_ft, pct)
      ])}
    `;
  }

  function shotsSection(data) {
    return `
      <section class="shots-card" data-shots-card="shots-main">
        <header class="shots-title"><span>Chutes, Impedimentos, Faltas e mais</span></header>
        ${tabs("shots-main", [
          { target: "team", label: "Chutes da Equipe" },
          { target: "match", label: "Chutes da Partida" }
        ])}
        <div class="shots-panel active" data-panel="team">
          ${table("Chutes da equipe", [
            numberRow("Chutes / jogo", data.home.team_shots?.shots_avg, data.away.team_shots?.shots_avg, 6),
            percentRow("Taxa de conversão", data.home.team_shots?.conversion_rate, data.away.team_shots?.conversion_rate),
            numberRow("Chutes no alvo / jogo", data.home.team_shots?.shots_on_target_avg, data.away.team_shots?.shots_on_target_avg, 16),
            numberRow("Chutes fora / jogo", data.home.team_shots?.shots_off_target_avg, data.away.team_shots?.shots_off_target_avg, 8),
            numberRow("Chutes por gol marcado", data.home.team_shots?.shots_per_goal, data.away.team_shots?.shots_per_goal, 5),
            row("Chutes da equipe +10.5", data.home.team_shots?.over105, data.away.team_shots?.over105, pct),
            row("Chutes da equipe +11.5", data.home.team_shots?.over115, data.away.team_shots?.over115, pct),
            row("Chutes da equipe +12.5", data.home.team_shots?.over125, data.away.team_shots?.over125, pct),
            row("Chutes da equipe +13.5", data.home.team_shots?.over135, data.away.team_shots?.over135, pct),
            row("Chutes da equipe +14.5", data.home.team_shots?.over145, data.away.team_shots?.over145, pct),
            row("Chutes da equipe +15.5", data.home.team_shots?.over155, data.away.team_shots?.over155, pct),
            row("Chutes no alvo +3.5", data.home.team_shots?.on_target_over35, data.away.team_shots?.on_target_over35, pct),
            row("Chutes no alvo +4.5", data.home.team_shots?.on_target_over45, data.away.team_shots?.on_target_over45, pct),
            row("Chutes no alvo +5.5", data.home.team_shots?.on_target_over55, data.away.team_shots?.on_target_over55, pct),
            row("Chutes no alvo +6.5", data.home.team_shots?.on_target_over65, data.away.team_shots?.on_target_over65, pct)
          ])}
          ${repeatedStats(data)}
        </div>
        <div class="shots-panel" data-panel="match">
          ${table("Chutes da partida", [
            row("Chutes da partida +23.5", data.home.match_shots?.over235, data.away.match_shots?.over235, pct),
            row("Chutes da partida +24.5", data.home.match_shots?.over245, data.away.match_shots?.over245, pct),
            row("Chutes da partida +25.5", data.home.match_shots?.over255, data.away.match_shots?.over255, pct),
            row("Chutes da partida +26.5", data.home.match_shots?.over265, data.away.match_shots?.over265, pct),
            row("Chutes no alvo da partida +7.5", data.home.match_shots?.on_target_over75, data.away.match_shots?.on_target_over75, pct),
            row("Chutes no alvo da partida +8.5", data.home.match_shots?.on_target_over85, data.away.match_shots?.on_target_over85, pct),
            row("Chutes no alvo da partida +9.5", data.home.match_shots?.on_target_over95, data.away.match_shots?.on_target_over95, pct)
          ])}
          ${repeatedStats(data)}
          <p class="shots-note">Alguns dados podem ser arredondados para o percentual mais próximo.</p>
        </div>
      </section>
    `;
  }

  function flowSection(data) {
    return `
      <section class="shots-card" data-shots-card="flow-main">
        <header class="shots-title"><span>Faltas Cobradas, Tiros de Meta e Laterais</span></header>
        ${tabs("flow-main", [
          { target: "free", label: "Faltas cobradas" },
          { target: "goal", label: "Tiros de meta" },
          { target: "throw", label: "Laterais" }
        ])}
        <div class="shots-panel active" data-panel="free">
          ${table("Faltas cobradas", [
            numberRow("Média total de faltas cobradas", data.home.flow?.freekicks_avg, data.away.flow?.freekicks_avg, 3),
            row("Faltas cobradas +20.5", data.home.flow?.freekicks_over205, data.away.flow?.freekicks_over205, pct),
            row("Faltas cobradas +21.5", data.home.flow?.freekicks_over215, data.away.flow?.freekicks_over215, pct),
            row("Faltas cobradas +22.5", data.home.flow?.freekicks_over225, data.away.flow?.freekicks_over225, pct),
            row("Faltas cobradas +23.5", data.home.flow?.freekicks_over235, data.away.flow?.freekicks_over235, pct),
            row("Faltas cobradas +24.5", data.home.flow?.freekicks_over245, data.away.flow?.freekicks_over245, pct),
            row("Faltas cobradas +25.5", data.home.flow?.freekicks_over255, data.away.flow?.freekicks_over255, pct)
          ])}
        </div>
        <div class="shots-panel" data-panel="goal">
          ${table("Tiros de meta", [
            numberRow("Média total de tiros de meta", data.home.flow?.goalkicks_avg, data.away.flow?.goalkicks_avg, 5),
            row("Tiros de meta +8.5", data.home.flow?.goalkicks_over85, data.away.flow?.goalkicks_over85, pct),
            row("Tiros de meta +9.5", data.home.flow?.goalkicks_over95, data.away.flow?.goalkicks_over95, pct),
            row("Tiros de meta +10.5", data.home.flow?.goalkicks_over105, data.away.flow?.goalkicks_over105, pct),
            row("Tiros de meta +11.5", data.home.flow?.goalkicks_over115, data.away.flow?.goalkicks_over115, pct),
            row("Tiros de meta +12.5", data.home.flow?.goalkicks_over125, data.away.flow?.goalkicks_over125, pct),
            row("Tiros de meta +13.5", data.home.flow?.goalkicks_over135, data.away.flow?.goalkicks_over135, pct)
          ])}
        </div>
        <div class="shots-panel" data-panel="throw">
          ${table("Laterais", [
            numberRow("Média total de laterais", data.home.flow?.throwins_avg, data.away.flow?.throwins_avg, 2),
            row("Laterais +37.5", data.home.flow?.throwins_over375, data.away.flow?.throwins_over375, pct),
            row("Laterais +38.5", data.home.flow?.throwins_over385, data.away.flow?.throwins_over385, pct),
            row("Laterais +39.5", data.home.flow?.throwins_over395, data.away.flow?.throwins_over395, pct),
            row("Laterais +40.5", data.home.flow?.throwins_over405, data.away.flow?.throwins_over405, pct),
            row("Laterais +41.5", data.home.flow?.throwins_over415, data.away.flow?.throwins_over415, pct),
            row("Laterais +42.5", data.home.flow?.throwins_over425, data.away.flow?.throwins_over425, pct),
            row("Laterais +43.5", data.home.flow?.throwins_over435, data.away.flow?.throwins_over435, pct),
            row("Laterais +44.5", data.home.flow?.throwins_over445, data.away.flow?.throwins_over445, pct)
          ])}
        </div>
      </section>
    `;
  }

  function renderChutesView() {
    const data = selectedMatch?.complete;

    if (!data) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadChutesData(data);

    if (data._chutesError) {
      return `<article class="card"><h2>Chutes</h2><p class="small-note">${escape(data._chutesError)}</p></article>`;
    }

    if (!data._chutesLoaded || !data._chutesData) {
      return `<article class="card"><h2>Carregando aba Chutes...</h2><p class="small-note">Buscando histórico real de chutes, faltas e fluxo na FootyStats.</p></article>`;
    }

    return `
      <div class="shots-view">
        ${shotsSection(data._chutesData)}
        ${flowSection(data._chutesData)}
      </div>
    `;
  }

  document.addEventListener("click", function(event) {
    const button = event.target.closest(".shots-tab-button");
    if (!button) return;

    const card = button.closest(".shots-card");
    const target = button.dataset.target;
    if (!card || !target) return;

    card.querySelectorAll(".shots-tab-button").forEach(function(item) {
      item.classList.toggle("active", item === button);
    });

    card.querySelectorAll(".shots-panel").forEach(function(panel) {
      panel.classList.toggle("active", panel.dataset.panel === target);
    });
  });

  if (typeof renderChutes === "function") {
    renderChutes = renderChutesView;
  }
})();
