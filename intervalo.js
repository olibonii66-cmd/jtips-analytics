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
    return Boolean(data && ids.season && ids.home && ids.away && !data._intervaloLoading && !data._intervaloLoaded && !data._intervaloError);
  }

  async function loadIntervaloData(data) {
    if (!needsData(data)) return;

    const ids = getIds(data);
    data._intervaloLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        match_id: ids.match,
        home_id: ids.home,
        away_id: ids.away
      });

      if (ids.date) params.set("date_unix", ids.date);

      const response = await fetch(`/api/intervalo?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Dados de intervalo indisponíveis.");
      }

      data._intervaloData = payload.data;
      data._intervaloLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.intervalo = payload.diagnostics || null;
    } catch (error) {
      data._intervaloError = error.message;
    } finally {
      data._intervaloLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "intervalo") {
        renderTab("intervalo");
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

  function heat(value) {
    if (!exists(value)) return "interval-empty";
    const number = Number(value);
    if (!Number.isFinite(number)) return "interval-mid";
    if (number >= 45) return "interval-high";
    if (number >= 30) return "interval-mid";
    return "interval-low";
  }

  function teamLogo(side) {
    const data = selectedMatch?.complete;
    const logo = side === "home" ? data?.teams?.home?.image || selectedMatch?.homeLogo : data?.teams?.away?.image || selectedMatch?.awayLogo;
    const name = side === "home" ? homeName() : awayName();
    const short = String(name || "T").replace(/[^a-zA-ZÀ-ÿ\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).map(function(part) { return part[0]; }).join("").toUpperCase().slice(0, 3) || "T";

    if (logo) {
      return `<img class="interval-logo" src="${escape(logo)}" alt="${escape(name)}" onerror="this.outerHTML='<span class=&quot;interval-fallback&quot;>${escape(short)}</span>'">`;
    }

    return `<span class="interval-fallback">${escape(short)}</span>`;
  }

  function compareText(data) {
    const home = Number(data.home.ht_ppg || 0);
    const away = Number(data.away.ht_ppg || 0);
    const leader = home === away ? null : home > away ? homeName() : awayName();
    const base = Math.min(home, away);
    const diff = Math.abs(home - away);
    const percent = base > 0 ? Math.round((diff / base) * 100) : Math.round(diff * 100);

    if (!leader || percent === 0) return "Equilíbrio na forma do intervalo.";
    return `${leader} é +${percent}% melhor em forma de intervalo.`;
  }

  function row(label, homeValue, awayValue) {
    return `
      <tr>
        <td>${escape(label)}</td>
        <td class="${heat(homeValue)}">${escape(pct(homeValue))}</td>
        <td class="${heat(awayValue)}">${escape(pct(awayValue))}</td>
      </tr>
    `;
  }

  function balance(data) {
    const home = Number(data.home.ht_ppg || 0);
    const away = Number(data.away.ht_ppg || 0);
    const total = home + away;
    const homePercent = total > 0 ? Math.max(8, Math.round((home / total) * 100)) : 50;
    const awayPercent = Math.max(8, 100 - homePercent);

    return `
      <div class="interval-balance" style="--home:${homePercent}%; --away:${awayPercent}%">
        <span></span><i></i>
      </div>
    `;
  }

  function renderIntervaloView() {
    const completeData = selectedMatch?.complete;

    if (!completeData) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadIntervaloData(completeData);

    if (completeData._intervaloError) {
      return `<article class="card"><h2>Intervalo</h2><p class="small-note">${escape(completeData._intervaloError)}</p></article>`;
    }

    if (!completeData._intervaloLoaded || !completeData._intervaloData) {
      return `<article class="card"><h2>Carregando aba Intervalo...</h2><p class="small-note">Buscando forma de intervalo na FootyStats.</p></article>`;
    }

    const data = completeData._intervaloData;

    return `
      <section class="interval-card">
        <header class="interval-title"><span>Primeiro / Segundo Tempo WDL</span></header>
        <div class="interval-form-layout">
          <div class="interval-team">
            <h3>Forma HT</h3>
            <div class="interval-team-line">
              ${teamLogo("home")}
              <div><strong>${escape(avg(data.home.ht_ppg))}</strong><span>Intervalo</span></div>
            </div>
          </div>
          <div class="interval-center">
            ${balance(data)}
            <div class="interval-marker">${teamLogo("home")}</div>
            <p>${escape(compareText(data))}</p>
          </div>
          <div class="interval-team away">
            <h3>Forma HT</h3>
            <div class="interval-team-line reverse">
              <div><strong>${escape(avg(data.away.ht_ppg))}</strong><span>Intervalo</span></div>
              ${teamLogo("away")}
            </div>
          </div>
        </div>
        <table class="interval-table">
          <thead><tr><th>1º/2º tempo WDL</th><th>${escape(homeName())}</th><th>${escape(awayName())}</th></tr></thead>
          <tbody>
            ${row("Vitória % 1º tempo", data.home.wdl?.win_first, data.away.wdl?.win_first)}
            ${row("Vitória % 2º tempo", data.home.wdl?.win_second, data.away.wdl?.win_second)}
            ${row("Empate % 1º tempo", data.home.wdl?.draw_first, data.away.wdl?.draw_first)}
            ${row("Empate % 2º tempo", data.home.wdl?.draw_second, data.away.wdl?.draw_second)}
            ${row("Derrota % 1º tempo", data.home.wdl?.loss_first, data.away.wdl?.loss_first)}
            ${row("Derrota % 2º tempo", data.home.wdl?.loss_second, data.away.wdl?.loss_second)}
          </tbody>
        </table>
      </section>
    `;
  }

  if (typeof renderIntervalo === "function") {
    renderIntervalo = renderIntervaloView;
  }
})();
