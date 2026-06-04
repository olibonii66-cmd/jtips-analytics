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
    return Boolean(data && ids.season && ids.home && ids.away && !data._escanteiosLoading && !data._escanteiosLoaded && !data._escanteiosError);
  }

  async function loadEscanteiosData(data) {
    if (!needsData(data)) return;

    const ids = getIds(data);
    data._escanteiosLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        match_id: ids.match,
        home_id: ids.home,
        away_id: ids.away
      });

      if (ids.date) params.set("date_unix", ids.date);

      const response = await fetch(`/api/escanteios?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Dados de escanteios indisponíveis.");
      }

      data._escanteiosData = payload.data;
      data._escanteiosLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.escanteios = payload.diagnostics || null;
    } catch (error) {
      data._escanteiosError = error.message;
    } finally {
      data._escanteiosLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "escanteios") {
        renderTab("escanteios");
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

  function heat(value) {
    if (!exists(value)) return "corner-empty";
    const number = Number(value);
    if (!Number.isFinite(number)) return "corner-mid";
    if (number >= 75) return "corner-high";
    if (number >= 45) return "corner-mid";
    return "corner-low";
  }

  function teamLogo(side) {
    const data = selectedMatch?.complete;
    const logo = side === "home" ? data?.teams?.home?.image || selectedMatch?.homeLogo : data?.teams?.away?.image || selectedMatch?.awayLogo;
    const name = side === "home" ? homeName() : awayName();
    const short = String(name || "T").replace(/[^a-zA-ZÀ-ÿ\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).map(function(part) { return part[0]; }).join("").toUpperCase().slice(0, 3) || "T";

    if (logo) {
      return `<img class="corner-team-logo" src="${escape(logo)}" alt="${escape(name)}" onerror="this.outerHTML='<span class=&quot;corner-team-fallback&quot;>${escape(short)}</span>'">`;
    }

    return `<span class="corner-team-fallback">${escape(short)}</span>`;
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

  function numberRow(label, homeValue, awayValue) {
    const avgValue = averageNumber([homeValue, awayValue]);
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heat(Number(homeValue) * 15)}">${escape(avg(homeValue))}</td>
        <td class="${heat(Number(awayValue) * 15)}">${escape(avg(awayValue))}</td>
        <td class="${heat(Number(avgValue) * 15)}">${escape(avg(avgValue))}</td>
      </tr>
    `;
  }

  function table(title, rows) {
    return `
      <table class="corner-table">
        <thead><tr><th>${escape(title)}</th><th>${escape(homeName())}</th><th>${escape(awayName())}</th><th>Média</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  }

  function tabs() {
    return `
      <div class="corner-subtabs" data-card="corners-total">
        <button class="corner-tab-button active" type="button" data-target="total">Total de Escanteios</button>
        <button class="corner-tab-button" type="button" data-target="half">1º / 2º Tempo</button>
      </div>
    `;
  }

  function topSummary(data) {
    const matchAvg = averageNumber([data.home.avg_total, data.away.avg_total]);

    return `
      <section class="corner-card corner-main-card" data-corner-card="corners-total">
        <header class="corner-title"><span>Número de Escanteios</span><em>Quantos escanteios terá?</em></header>
        <div class="corner-summary-grid">
          <div class="corner-flag" aria-hidden="true">⚑</div>
          <div class="corner-average">
            <strong>${escape(avg(matchAvg))}</strong>
            <span>Escanteios / Jogo</span>
            <small>* Média de escanteios entre ${escape(homeName())} em casa e ${escape(awayName())} fora</small>
          </div>
          <div class="corner-mini-card">
            <strong>${escape(avg(data.home.avg_for))} / Jogo</strong>
            <span>Escanteios a favor</span>
            ${teamLogo("home")}
          </div>
          <div class="corner-mini-card">
            <strong>${escape(avg(data.away.avg_for))} / Jogo</strong>
            <span>Escanteios a favor</span>
            ${teamLogo("away")}
          </div>
        </div>
        ${tabs()}
        <div class="corner-panel active" data-panel="total">
          ${table("Escanteios da partida", [
            row("Mais de 6", data.home.match?.over6, data.away.match?.over6, pct),
            row("Mais de 7", data.home.match?.over7, data.away.match?.over7, pct),
            row("Mais de 8", data.home.match?.over8, data.away.match?.over8, pct),
            row("Mais de 9", data.home.match?.over9, data.away.match?.over9, pct),
            row("Mais de 10", data.home.match?.over10, data.away.match?.over10, pct),
            row("Mais de 11", data.home.match?.over11, data.away.match?.over11, pct),
            row("Mais de 12", data.home.match?.over12, data.away.match?.over12, pct),
            row("Mais de 13", data.home.match?.over13, data.away.match?.over13, pct)
          ])}
        </div>
        <div class="corner-panel" data-panel="half">
          ${table("Escanteios 1º tempo", [
            row("Mais de 2 no 1ºT", data.home.half?.first_over2, data.away.half?.first_over2, pct),
            row("Mais de 3 no 1ºT", data.home.half?.first_over3, data.away.half?.first_over3, pct),
            row("Mais de 4 no 1ºT", data.home.half?.first_over4, data.away.half?.first_over4, pct)
          ])}
          ${table("Escanteios 2º tempo", [
            row("Mais de 2 no 2ºT", data.home.half?.second_over2, data.away.half?.second_over2, pct),
            row("Mais de 3 no 2ºT", data.home.half?.second_over3, data.away.half?.second_over3, pct),
            row("Mais de 4 no 2ºT", data.home.half?.second_over4, data.away.half?.second_over4, pct),
            numberRow("Média 1ºT", data.home.half?.avg_first, data.away.half?.avg_first),
            numberRow("Média 2ºT", data.home.half?.avg_second, data.away.half?.avg_second)
          ])}
        </div>
        <p class="corner-note">Total de escanteios para ${escape(homeName())} e ${escape(awayName())}, com média do recorte mandante/visitante da temporada.</p>
      </section>
    `;
  }

  function teamCorners(data) {
    return `
      <section class="corner-card">
        <header class="corner-title"><span>Escanteios por Equipe</span><em>A favor / contra</em></header>
        <p class="corner-intro">Dados individuais de escanteios de ${escape(homeName())} e ${escape(awayName())}.</p>
        ${table("Escanteios da equipe", [
          numberRow("Escanteios a favor / jogo", data.home.avg_for, data.away.avg_for),
          numberRow("Escanteios contra / jogo", data.home.avg_against, data.away.avg_against),
          row("Mais de 2.5 a favor", data.home.team?.for_over25, data.away.team?.for_over25, pct),
          row("Mais de 3.5 a favor", data.home.team?.for_over35, data.away.team?.for_over35, pct),
          row("Mais de 4.5 a favor", data.home.team?.for_over45, data.away.team?.for_over45, pct),
          row("Mais de 2.5 contra", data.home.team?.against_over25, data.away.team?.against_over25, pct),
          row("Mais de 3.5 contra", data.home.team?.against_over35, data.away.team?.against_over35, pct),
          row("Mais de 4.5 contra", data.home.team?.against_over45, data.away.team?.against_over45, pct)
        ])}
      </section>
    `;
  }

  function renderEscanteiosView() {
    const data = selectedMatch?.complete;

    if (!data) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadEscanteiosData(data);

    if (data._escanteiosError) {
      return `<article class="card"><h2>Escanteios</h2><p class="small-note">${escape(data._escanteiosError)}</p></article>`;
    }

    if (!data._escanteiosLoaded || !data._escanteiosData) {
      return `<article class="card"><h2>Carregando aba Escanteios...</h2><p class="small-note">Buscando histórico real de escanteios na FootyStats.</p></article>`;
    }

    return `
      <div class="corner-view">
        ${topSummary(data._escanteiosData)}
        ${teamCorners(data._escanteiosData)}
      </div>
    `;
  }

  document.addEventListener("click", function(event) {
    const button = event.target.closest(".corner-tab-button");
    if (!button) return;

    const card = button.closest(".corner-card");
    const target = button.dataset.target;
    if (!card || !target) return;

    card.querySelectorAll(".corner-tab-button").forEach(function(item) {
      item.classList.toggle("active", item === button);
    });

    card.querySelectorAll(".corner-panel").forEach(function(panel) {
      panel.classList.toggle("active", panel.dataset.panel === target);
    });
  });

  if (typeof renderEscanteios === "function") {
    renderEscanteios = renderEscanteiosView;
  }
})();
