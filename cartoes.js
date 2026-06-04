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
    return Boolean(data && ids.season && ids.home && ids.away && !data._cartoesLoading && !data._cartoesLoaded && !data._cartoesError);
  }

  async function loadCartoesData(data) {
    if (!needsData(data)) return;

    const ids = getIds(data);
    data._cartoesLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        match_id: ids.match,
        home_id: ids.home,
        away_id: ids.away
      });

      if (ids.date) params.set("date_unix", ids.date);

      const response = await fetch(`/api/cartoes?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Dados de cartões indisponíveis.");
      }

      data._cartoesData = payload.data;
      data._cartoesLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.cartoes = payload.diagnostics || null;
    } catch (error) {
      data._cartoesError = error.message;
    } finally {
      data._cartoesLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "cartoes") {
        renderTab("cartoes");
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
    if (!exists(value)) return "cards-empty";
    const number = Number(value);
    if (!Number.isFinite(number)) return "cards-mid";
    if (number >= 75) return "cards-high";
    if (number >= 45) return "cards-mid";
    return "cards-low";
  }

  function teamLogo(side) {
    const data = selectedMatch?.complete;
    const logo = side === "home" ? data?.teams?.home?.image || selectedMatch?.homeLogo : data?.teams?.away?.image || selectedMatch?.awayLogo;
    const name = side === "home" ? homeName() : awayName();
    const short = String(name || "T").replace(/[^a-zA-ZÀ-ÿ\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).map(function(part) { return part[0]; }).join("").toUpperCase().slice(0, 3) || "T";

    if (logo) {
      return `<img class="cards-team-logo" src="${escape(logo)}" alt="${escape(name)}" onerror="this.outerHTML='<span class=&quot;cards-team-fallback&quot;>${escape(short)}</span>'">`;
    }

    return `<span class="cards-team-fallback">${escape(short)}</span>`;
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
        <td class="${heat(Number(homeValue) * 35)}">${escape(avg(homeValue))}</td>
        <td class="${heat(Number(awayValue) * 35)}">${escape(avg(awayValue))}</td>
        <td class="${heat(Number(avgValue) * 35)}">${escape(avg(avgValue))}</td>
      </tr>
    `;
  }

  function table(title, rows) {
    return `
      <table class="cards-table">
        <thead><tr><th>${escape(title)}</th><th>${escape(homeName())}</th><th>${escape(awayName())}</th><th>Média</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  }

  function tabs(card, first, second) {
    return `
      <div class="cards-subtabs" data-card="${escape(card)}">
        <button class="cards-tab-button active" type="button" data-target="first">${escape(first)}</button>
        <button class="cards-tab-button" type="button" data-target="second">${escape(second)}</button>
      </div>
    `;
  }

  function topSummary(data) {
    const matchAvg = averageNumber([data.home.avg_total, data.away.avg_total]);

    return `
      <section class="cards-card" data-cards-card="cards-total">
        <header class="cards-title"><span>Número de Cartões</span></header>
        <div class="cards-summary-grid">
          <div class="cards-icon-pair"><span></span><i></i></div>
          <div class="cards-average">
            <strong>${escape(avg(matchAvg))}</strong>
            <span>Total de cartões / jogo</span>
            <small>* Soma de cartões por jogo entre ${escape(homeName())} e ${escape(awayName())}</small>
          </div>
          <div class="cards-mini-card">
            <strong>${escape(avg(data.home.avg_for))} Cartões</strong>
            <span>Recebidos / jogo</span>
            ${teamLogo("home")}
          </div>
          <div class="cards-mini-card">
            <strong>${escape(avg(data.away.avg_for))} Cartões</strong>
            <span>Recebidos / jogo</span>
            ${teamLogo("away")}
          </div>
        </div>
        ${tabs("cards-total", "Total de Cartões", "Cartões por Equipe")}
        <div class="cards-panel active" data-panel="first">
          ${table("Cartões da partida", [
            row("Mais de 2.5", data.home.total?.over25, data.away.total?.over25, pct),
            row("Mais de 3.5", data.home.total?.over35, data.away.total?.over35, pct),
            row("Mais de 4.5", data.home.total?.over45, data.away.total?.over45, pct),
            row("Mais de 5.5", data.home.total?.over55, data.away.total?.over55, pct),
            row("Mais de 6.5", data.home.total?.over65, data.away.total?.over65, pct)
          ])}
        </div>
        <div class="cards-panel" data-panel="second">
          ${table("Cartões da equipe", [
            numberRow("Média de cartões a favor", data.home.avg_for, data.away.avg_for),
            row("Mais de 0.5 a favor", data.home.team?.for_over05, data.away.team?.for_over05, pct),
            row("Mais de 1.5 a favor", data.home.team?.for_over15, data.away.team?.for_over15, pct),
            row("Mais de 2.5 a favor", data.home.team?.for_over25, data.away.team?.for_over25, pct),
            row("Mais de 3.5 a favor", data.home.team?.for_over35, data.away.team?.for_over35, pct)
          ])}
          ${table("Cartões contra", [
            row("Mais de 0.5 contra", data.home.team?.against_over05, data.away.team?.against_over05, pct),
            row("Mais de 1.5 contra", data.home.team?.against_over15, data.away.team?.against_over15, pct),
            row("Mais de 2.5 contra", data.home.team?.against_over25, data.away.team?.against_over25, pct),
            row("Mais de 3.5 contra", data.home.team?.against_over35, data.away.team?.against_over35, pct)
          ])}
        </div>
        <p class="cards-note">Total de cartões para ${escape(homeName())} e ${escape(awayName())}, com média do recorte mandante/visitante da temporada.</p>
      </section>
    `;
  }

  function halfCards(data) {
    return `
      <section class="cards-card" data-cards-card="cards-half">
        <header class="cards-title"><span>Cartões 1º / 2º Tempo</span></header>
        <p class="cards-intro">Estatísticas de cartões no primeiro e segundo tempo para ${escape(homeName())} e ${escape(awayName())}.</p>
        ${tabs("cards-half", "Média 1º/2ºT", "Over 0.5 ~ 3 cartões")}
        <div class="cards-panel active" data-panel="first">
          ${table("Cartões por tempo", [
            numberRow("Média de cartões a favor 1ºT", data.home.half?.avg_first_for, data.away.half?.avg_first_for),
            numberRow("Média de cartões a favor 2ºT", data.home.half?.avg_second_for, data.away.half?.avg_second_for),
            numberRow("Total médio de cartões 1ºT", data.home.half?.avg_first_total, data.away.half?.avg_first_total),
            numberRow("Total médio de cartões 2ºT", data.home.half?.avg_second_total, data.away.half?.avg_second_total),
            row("Teve mais cartões no 1ºT", data.home.half?.first_had_more, data.away.half?.first_had_more, pct),
            row("Teve mais cartões no 2ºT", data.home.half?.second_had_more, data.away.half?.second_had_more, pct)
          ])}
        </div>
        <div class="cards-panel" data-panel="second">
          ${table("Over cartões 1º/2º tempo", [
            row("1ºT mais de 0.5 a favor", data.home.half?.first_for_over05, data.away.half?.first_for_over05, pct),
            row("2ºT mais de 0.5 a favor", data.home.half?.second_for_over05, data.away.half?.second_for_over05, pct),
            row("1ºT total abaixo de 2", data.home.half?.first_total_under2, data.away.half?.first_total_under2, pct),
            row("2ºT total abaixo de 2", data.home.half?.second_total_under2, data.away.half?.second_total_under2, pct),
            row("1ºT total entre 2 e 3", data.home.half?.first_total_2_3, data.away.half?.first_total_2_3, pct),
            row("2ºT total entre 2 e 3", data.home.half?.second_total_2_3, data.away.half?.second_total_2_3, pct),
            row("1ºT total acima de 3", data.home.half?.first_total_over3, data.away.half?.first_total_over3, pct),
            row("2ºT total acima de 3", data.home.half?.second_total_over3, data.away.half?.second_total_over3, pct)
          ])}
        </div>
      </section>
    `;
  }

  function renderCartoesView() {
    const data = selectedMatch?.complete;

    if (!data) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadCartoesData(data);

    if (data._cartoesError) {
      return `<article class="card"><h2>Cartões</h2><p class="small-note">${escape(data._cartoesError)}</p></article>`;
    }

    if (!data._cartoesLoaded || !data._cartoesData) {
      return `<article class="card"><h2>Carregando aba Cartões...</h2><p class="small-note">Buscando histórico real de cartões na FootyStats.</p></article>`;
    }

    return `
      <div class="cards-view">
        ${topSummary(data._cartoesData)}
        ${halfCards(data._cartoesData)}
      </div>
    `;
  }

  document.addEventListener("click", function(event) {
    const button = event.target.closest(".cards-tab-button");
    if (!button) return;

    const card = button.closest(".cards-card");
    const target = button.dataset.target;
    if (!card || !target) return;

    card.querySelectorAll(".cards-tab-button").forEach(function(item) {
      item.classList.toggle("active", item === button);
    });

    card.querySelectorAll(".cards-panel").forEach(function(panel) {
      panel.classList.toggle("active", panel.dataset.panel === target);
    });
  });

  if (typeof renderCartoes === "function") {
    renderCartoes = renderCartoesView;
  }
})();
