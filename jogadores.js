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
      home: data?.ids?.home_id || raw.homeID || raw.home_id || raw.team_a_id || selectedMatch?.raw?.homeID || "",
      away: data?.ids?.away_id || raw.awayID || raw.away_id || raw.team_b_id || selectedMatch?.raw?.awayID || ""
    };
  }

  function needsData(data) {
    const ids = getIds(data);
    return Boolean(data && ids.season && ids.home && ids.away && !data._jogadoresLoading && !data._jogadoresLoaded && !data._jogadoresError);
  }

  async function loadJogadoresData(data) {
    if (!needsData(data)) return;

    const ids = getIds(data);
    data._jogadoresLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        home_id: ids.home,
        away_id: ids.away
      });

      const response = await fetch(`/api/jogadores?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Dados de jogadores indisponíveis.");
      }

      data._jogadoresData = payload.data;
      data._jogadoresLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.jogadores = payload.diagnostics || null;
    } catch (error) {
      data._jogadoresError = error.message;
    } finally {
      data._jogadoresLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "jogadores") {
        renderTab("jogadores");
      }
    }
  }

  function teamLogo(side) {
    const data = selectedMatch?.complete;
    const logo = side === "home" ? data?.teams?.home?.image || selectedMatch?.homeLogo : data?.teams?.away?.image || selectedMatch?.awayLogo;
    const name = side === "home" ? homeName() : awayName();
    const short = String(name || "T").replace(/[^a-zA-Z\u00c0-\u00ff\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).map(function(part) { return part[0]; }).join("").toUpperCase().slice(0, 3) || "T";

    if (logo) {
      return `<img class="players-team-logo" src="${escape(logo)}" alt="${escape(name)}" onerror="this.outerHTML='<span class=&quot;players-logo-fallback&quot;>${escape(short)}</span>'">`;
    }

    return `<span class="players-logo-fallback">${escape(short)}</span>`;
  }

  function flag(country) {
    const value = String(country || "").toLowerCase();
    if (!value) return "";
    if (value.includes("brazil") || value.includes("brasil") || value === "bra" || value === "br") return "🇧🇷";
    if (value.includes("colombia") || value.includes("colômbia") || value === "col") return "🇨🇴";
    if (value.includes("portugal") || value === "por") return "🇵🇹";
    if (value.includes("argentina") || value === "arg") return "🇦🇷";
    if (value.includes("uruguay") || value.includes("uruguai") || value === "uru") return "🇺🇾";
    if (value.includes("paraguay") || value.includes("paraguai") || value === "par") return "🇵🇾";
    if (value.includes("chile") || value === "chi") return "🇨🇱";
    if (value.includes("peru") || value === "per") return "🇵🇪";
    if (value.includes("bolivia") || value === "bol") return "🇧🇴";
    if (value.includes("venezuela") || value === "ven") return "🇻🇪";
    if (value.includes("ecuador") || value === "ecu") return "🇪🇨";
    return "";
  }

  function valueText(value, mode) {
    if (!exists(value)) return "-";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (mode === "decimal") return String(Number(number.toFixed(2)));
    return String(Math.round(number));
  }

  function emptyList() {
    return `<div class="players-empty">Dados de jogadores indisponíveis no retorno atual da API.</div>`;
  }

  function playerRows(players, side, mode) {
    if (!players || !players.length) return emptyList();

    const max = Math.max.apply(null, players.map(function(player) { return Number(player.value || 0); }));

    return `
      <div class="players-bars ${side === "home" ? "players-home" : "players-away"}">
        ${players.map(function(player) {
          const value = Number(player.value || 0);
          const width = max > 0 ? Math.max(14, Math.round((value / max) * 100)) : 0;
          const playerFlag = flag(player.nationality);

          return `
            <div class="players-bar-row">
              <div class="players-bar-track">
                <span class="players-bar-fill" style="width:${width}%"></span>
                <span class="players-name">${playerFlag ? `<b>${playerFlag}</b>` : ""}${escape(player.name)}</span>
                <strong>${escape(valueText(player.value, mode))}</strong>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function playersCard(title, side, players, mode) {
    return `
      <article class="players-team-card">
        <header class="players-team-title">
          ${teamLogo(side)}
          <h3>${escape(title)}</h3>
        </header>
        ${playerRows(players, side, mode)}
        <p class="players-note">* Estatísticas da temporada atual da liga</p>
      </article>
    `;
  }

  function playersSection(title, homeTitle, awayTitle, homePlayers, awayPlayers, mode) {
    return `
      <section class="players-section">
        <header class="players-section-title"><span>${escape(title)}</span></header>
        <div class="players-grid">
          ${playersCard(homeTitle, "home", homePlayers, mode)}
          ${playersCard(awayTitle, "away", awayPlayers, mode)}
        </div>
      </section>
    `;
  }

  function renderJogadoresView() {
    const completeData = selectedMatch?.complete;

    if (!completeData) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadJogadoresData(completeData);

    if (completeData._jogadoresError) {
      return `<article class="card"><h2>Jogadores</h2><p class="small-note">${escape(completeData._jogadoresError)}</p></article>`;
    }

    if (!completeData._jogadoresLoaded || !completeData._jogadoresData) {
      return `<article class="card"><h2>Carregando aba Jogadores...</h2><p class="small-note">Buscando jogadores da liga na FootyStats.</p></article>`;
    }

    const data = completeData._jogadoresData;
    const home = data.home || {};
    const away = data.away || {};

    return `
      ${playersSection(
        "Quais jogadores podem marcar?",
        `Artilheiros - ${homeName()}`,
        `Artilheiros - ${awayName()}`,
        home.scorers,
        away.scorers,
        "integer"
      )}
      ${playersSection(
        "Quem pode receber cartão?",
        `Cartões recebidos - ${homeName()}`,
        `Cartões recebidos - ${awayName()}`,
        home.cards,
        away.cards,
        "integer"
      )}
      ${playersSection(
        "Cartões por 90 minutos",
        `Cartões / 90 - ${homeName()}`,
        `Cartões / 90 - ${awayName()}`,
        home.cards_per_90,
        away.cards_per_90,
        "decimal"
      )}
    `;
  }

  if (typeof renderJogadores === "function") {
    renderJogadores = renderJogadoresView;
  }
})();
