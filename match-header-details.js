(function() {
  function escape(value) {
    return typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? "");
  }

  function rawMatch() {
    return selectedMatch?.complete?.raw?.match_details || selectedMatch?.complete?.raw?.match || selectedMatch?.raw || {};
  }

  function hasValue(value) {
    return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1";
  }

  function pick() {
    for (const value of arguments) {
      if (hasValue(value)) return value;
    }

    return "";
  }

  function getLeagueLine(match) {
    const raw = rawMatch();
    const country = pick(
      raw.country,
      raw.country_name,
      raw.league_country,
      raw.resolved_league_country,
      selectedMatch?.raw?.country,
      selectedMatch?.raw?.country_name,
      selectedMatch?.raw?.resolved_league_country
    );
    const league = pick(
      raw.league_name,
      raw.competition_name,
      raw.season_name,
      raw.league,
      raw.resolved_league_name,
      selectedMatch?.raw?.league_name,
      selectedMatch?.raw?.competition_name,
      selectedMatch?.raw?.season_name,
      selectedMatch?.raw?.resolved_league_name
    );

    if (league && String(league).includes("›")) return String(league).replace(/›/g, ">");
    if (country && league) return `${country} > ${league}`;
    if (league) return league;
    return getLeagueTitle ? getLeagueTitle() : "Dados via API";
  }

  function formatMatchDate(match) {
    const raw = rawMatch();
    const unix = pick(raw.date_unix, selectedMatch?.raw?.date_unix);
    let date = null;

    if (unix && Number.isFinite(Number(unix))) {
      date = new Date(Number(unix) * 1000);
    }

    if (!date || Number.isNaN(date.getTime())) {
      date = typeof parseISODate === "function" ? parseISODate(selectedDate) : new Date(selectedDate);
    }

    const weekday = capitalize(date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", ""));
    const day = date.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" });
    const month = capitalize(date.toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }));
    const year = date.toLocaleDateString("pt-BR", { year: "numeric", timeZone: "America/Sao_Paulo" });
    const time = pick(match?.time, selectedMatch?.time, "--:--");

    return `${weekday}, ${day} de ${month} de ${year} · ${time}`;
  }

  function capitalize(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function getStadiumLine() {
    const raw = rawMatch();
    return pick(raw.stadium_name, raw.venue_name, raw.stadium, selectedMatch?.raw?.stadium_name, selectedMatch?.raw?.venue_name);
  }

  function getLocationLine() {
    const raw = rawMatch();
    const location = pick(raw.stadium_location, raw.venue_location, raw.city, selectedMatch?.raw?.stadium_location, selectedMatch?.raw?.venue_location);

    if (!location) return "";

    return String(location)
      .replace(/,\s*/g, " - ")
      .replace(/\s+-\s+([A-Z]{2})\b/, " - $1");
  }

  function oddValue(match, index) {
    const value = Array.isArray(match?.odds) ? match.odds[index] : "";
    if (value && value !== "-" && value !== "0.00") return value;

    const data = selectedMatch?.complete;
    const fallback = index === 0 ? data?.odds?.result?.home : index === 1 ? data?.odds?.result?.draw : data?.odds?.result?.away;

    if (typeof fmtOdd === "function") return fmtOdd(fallback);
    return fallback || "-";
  }

  function renderMeta(match) {
    const stadium = getStadiumLine();
    const location = getLocationLine();

    return `
      <div class="match-meta match-meta-compact">
        <div class="match-league-line"><span class="match-country-dot"></span><strong>${escape(getLeagueLine(match))}</strong></div>
        <div>${escape(formatMatchDate(match))}</div>
        ${stadium ? `<div>${escape(stadium)}</div>` : ""}
        ${location ? `<div>${escape(location)}</div>` : ""}
      </div>
    `;
  }

  function renderSidePanel(match) {
    return `
      <div class="match-side-panel">
        <div class="pre-badge">
          ${match.status === "done" ? "✅ FINALIZADO" : "📅 PRÉ-JOGO"}
        </div>
        <div class="sports-odds-row" aria-label="Odds 1 X 2">
          <div class="sports-odd-chip"><span>1</span><strong>${escape(oddValue(match, 0))}</strong></div>
          <div class="sports-odd-chip"><span>X</span><strong>${escape(oddValue(match, 1))}</strong></div>
          <div class="sports-odd-chip"><span>2</span><strong>${escape(oddValue(match, 2))}</strong></div>
        </div>
      </div>
    `;
  }

  updateMatchHeader = function updateMatchHeaderWithDetails(match) {
    const header = document.querySelector(".match-header");

    if (!header || !match) return;

    header.innerHTML = `
      ${renderMeta(match)}

      <div class="versus">
        <div>
          ${renderBigTeamIcon(match, "home")}
          <strong>${escape(match.home)}</strong>
        </div>

        <div class="vs">${escape(match.score)}</div>

        <div>
          ${renderBigTeamIcon(match, "away")}
          <strong>${escape(match.away)}</strong>
        </div>
      </div>

      ${renderSidePanel(match)}
    `;
  };
})();
