(() => {
  "use strict";

  const CONFIG = {
    minConfidence: 70,
    maxTicketSelections: 2,
    apiUrl: window.JTIPS_API_URL || "/api/jtips/auto-matches",
  };

  const state = {
    matches: [],
    rawPayload: null,
    view: "best",
    status: "all",
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function initials(name) {
    return String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function statusLabel(status) {
    const value = normalize(status);
    if (["finalizado", "complete", "finished", "ft", "encerrado"].some((item) => value.includes(item))) return "Encerrado";
    if (["em_andamento", "live", "in-play", "playing", "1h", "2h", "ht", "ao vivo"].some((item) => value.includes(item))) return "Ao vivo";
    if (["cancelado", "cancelled", "canceled"].some((item) => value.includes(item))) return "Cancelado";
    if (["adiado", "postponed"].some((item) => value.includes(item))) return "Adiado";
    return "Pré-jogo";
  }

  function setStatus(title, detail, type = "loading") {
    const box = $("#apiStatus");
    if (!box) return;

    const strong = box.querySelector("strong");
    const small = box.querySelector("small, span:last-child");
    const dot = box.querySelector(".status-dot");

    if (strong) strong.textContent = title;
    if (small) small.textContent = detail;
    if (dot) {
      const color = type === "ok" ? "var(--green)" : type === "error" ? "var(--red)" : "var(--amber)";
      dot.style.background = color;
      dot.style.boxShadow = `0 0 16px ${color}`;
    }
  }

  function toPercent(value) {
    if (typeof value === "string") value = value.replace("%", "").replace(",", ".");
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    if (number > 0 && number <= 1) return Math.round(number * 100);
    if (number >= 0 && number <= 100) return Math.round(number);
    return null;
  }

  function toOdd(value) {
    if (typeof value === "string") value = value.replace(",", ".");
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 1) return null;
    return Number(number.toFixed(2));
  }

  function normalizeMarket(raw) {
    const probability = toPercent(raw.confidence ?? raw.probability ?? raw.score ?? raw.value);
    const odd = toOdd(raw.odd ?? raw.odds ?? raw.price);
    const selection = raw.selection || raw.market || raw.name || raw.label || "Mercado";
    const group = raw.group || raw.groupId || raw.market_group || "mercado";

    return {
      selection,
      group,
      confidence: probability ?? 0,
      probability: probability ?? 0,
      odd,
    };
  }

  function antiConflict(candidate, selected) {
    const sameGroup = selected.some((item) => item.group === candidate.group);
    if (!sameGroup) return false;

    if (["goals", "gols", "corners", "escanteios", "cards", "cartoes", "cartões"].includes(candidate.group)) {
      return selected.some((item) => item.group === candidate.group && normalize(item.selection) === normalize(candidate.selection));
    }

    return true;
  }

  function buildTicket(markets) {
    const selected = [];
    const ordered = [...markets].sort((a, b) => b.confidence - a.confidence);

    for (const market of ordered) {
      if (selected.length >= CONFIG.maxTicketSelections) break;
      if (market.confidence < CONFIG.minConfidence) continue;
      if (antiConflict(market, selected)) continue;
      selected.push(market);
    }

    return selected;
  }

  function normalizeMatch(raw) {
    const markets = Array.isArray(raw.markets)
      ? raw.markets.map(normalizeMarket).filter((market) => market.confidence >= CONFIG.minConfidence)
      : [];

    return {
      id: String(raw.id || raw.match_id || `${raw.home || raw.home_team_name}-${raw.away || raw.away_team_name}-${raw.date || raw.date_brazil}`),
      home: raw.home || raw.home_team_name || raw.homeTeam || raw.localteam?.name || "Casa",
      away: raw.away || raw.away_team_name || raw.awayTeam || raw.visitorteam?.name || "Fora",
      league: raw.league || raw.league_name || raw.competition || "Liga não informada",
      country: raw.country || "",
      date: raw.date || raw.date_brazil || "",
      time: raw.time || raw.time_brazil || "--:--",
      status: raw.status_jtips || raw.status || "pre_jogo",
      markets,
      ticket: buildTicket(markets),
      raw,
    };
  }

  function extractRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.matches)) return payload.matches;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  function normalizePayload(payload) {
    return extractRows(payload).map(normalizeMatch).filter((match) => match.home && match.away);
  }

  function renderMarketLine(market) {
    return `
      <div class="line">
        <span>${escapeHtml(market.selection)}</span>
        <div class="bar"><i style="width:${Math.min(100, market.confidence)}%"></i></div>
        <strong>${market.confidence}%</strong>
      </div>
    `;
  }

  function renderTicketRow(market) {
    return `
      <div class="ticket-row">
        <span>${escapeHtml(market.selection)}</span>
        <strong>${market.confidence}%</strong>
        <em>${market.odd ? `Odd ${market.odd.toFixed(2)}` : "Sem odd"}</em>
      </div>
    `;
  }

  function totalOdd(ticket) {
    const odds = ticket.map((item) => item.odd).filter(Boolean);
    return odds.length ? odds.reduce((total, odd) => total * odd, 1).toFixed(2) : "—";
  }

  function renderCard(match) {
    return `
      <article class="card" data-match-id="${escapeHtml(match.id)}">
        <header class="card-header">
          <div class="match-title">
            <span class="crest">${escapeHtml(initials(match.home))}</span>
            <div>
              <strong>${escapeHtml(match.home)} x ${escapeHtml(match.away)}</strong>
              <small>${escapeHtml(match.country ? `${match.country} • ${match.league}` : match.league)}</small>
            </div>
          </div>
          <span class="clock">${escapeHtml(match.time)}</span>
        </header>

        <div class="teams">
          <div class="team-box"><span>Casa</span><strong>${escapeHtml(match.home)}</strong></div>
          <div class="team-box"><span>Fora</span><strong>${escapeHtml(match.away)}</strong></div>
        </div>

        <section class="block">
          <div class="block-heading"><span>Linhas de Conforto</span><strong>+${CONFIG.minConfidence}%</strong></div>
          <div class="lines">
            ${match.markets.length ? match.markets.map(renderMarketLine).join("") : `<p class="empty">Sem linhas acima de ${CONFIG.minConfidence}%.</p>`}
          </div>
        </section>

        <section class="block">
          <div class="block-heading"><span>Bilhete</span><strong>${match.ticket.length} seleções</strong></div>
          <div class="ticket">
            ${match.ticket.length ? match.ticket.map(renderTicketRow).join("") : `<p class="empty">Sem seleções para bilhete.</p>`}
            <div class="ticket-total"><span>Odd total</span><strong>${totalOdd(match.ticket)}</strong></div>
          </div>
        </section>

        <footer class="card-actions">
          <button type="button">Análise</button>
          <button type="button">bet365</button>
        </footer>
      </article>
    `;
  }

  function renderBest() {
    const grid = $("#bestGrid");
    if (!grid) return;

    const matches = state.matches
      .filter((match) => match.markets.length > 0)
      .sort((a, b) => (b.markets[0]?.confidence || 0) - (a.markets[0]?.confidence || 0));

    grid.innerHTML = matches.length
      ? matches.map(renderCard).join("")
      : `<p class="empty">Nenhum mercado acima de ${CONFIG.minConfidence}% encontrado.</p>`;
  }

  function groupByLeague(matches) {
    return matches.reduce((output, match) => {
      const key = match.country ? `${match.country} • ${match.league}` : match.league;
      output[key] ||= [];
      output[key].push(match);
      return output;
    }, {});
  }

  function renderGameRow(match) {
    const top = match.markets[0];
    const marketText = top ? `${top.selection} • ${top.confidence}%` : `Sem linha acima de ${CONFIG.minConfidence}%`;

    return `
      <button class="game-row" type="button" data-match-id="${escapeHtml(match.id)}">
        <time>${escapeHtml(match.time)}</time>
        <span>
          <strong>${escapeHtml(match.home)} x ${escapeHtml(match.away)}</strong>
          <small>${escapeHtml(marketText)}</small>
        </span>
        <em>${escapeHtml(statusLabel(match.status))}</em>
      </button>
    `;
  }

  function renderGames() {
    const list = $("#dailyList");
    if (!list) return;

    const matches = state.matches.filter((match) => {
      const status = statusLabel(match.status);
      if (state.status === "upcoming") return status === "Pré-jogo";
      if (state.status === "live") return status === "Ao vivo";
      if (state.status === "finished") return status === "Encerrado";
      return true;
    }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const grouped = groupByLeague(matches);

    list.innerHTML = Object.entries(grouped)
      .map(([league, leagueMatches]) => `
        <article class="league-group">
          <div class="league-header">
            <h3>${escapeHtml(league)}</h3>
            <span>${leagueMatches.length} jogos</span>
          </div>
          ${leagueMatches.map(renderGameRow).join("")}
        </article>
      `)
      .join("") || `<p class="empty">Nenhum jogo encontrado.</p>`;
  }

  function renderAll() {
    renderBest();
    renderGames();
  }

  async function loadData() {
    setStatus("API carregando", "Buscando ligas automáticas", "loading");

    const response = await fetch(CONFIG.apiUrl, { cache: "no-store" });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.message || payload?.error || `Erro API ${response.status}`);
    }

    state.rawPayload = payload;
    state.matches = normalizePayload(payload);

    const leagueText = payload?.total_leagues_available
      ? `${payload.total_leagues_available} ligas encontradas`
      : `${state.matches.length} jogos carregados`;

    setStatus("API conectada", leagueText, "ok");
    renderAll();
  }

  function showView(view) {
    state.view = view;

    $$('[data-view-panel]').forEach((panel) => {
      panel.classList.toggle("is-hidden", panel.dataset.viewPanel !== view);
    });

    $$('[data-view]').forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    const title = $("#pageTitle");
    if (title) title.textContent = view === "games" ? "Jogos do Dia" : view === "settings" ? "Configurações" : "Melhores do Dia";
  }

  function openApp() {
    $("#loginView")?.classList.add("is-hidden");
    $("#appShell")?.classList.remove("is-hidden");
    showView("best");
    loadData().catch((error) => {
      console.error(error);
      setStatus("Erro na API", error.message || "Verifique o console", "error");
      renderAll();
    });
  }

  function closeApp() {
    $("#appShell")?.classList.add("is-hidden");
    $("#loginView")?.classList.remove("is-hidden");
  }

  function bindEvents() {
    $("#loginForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      openApp();
    });

    $(".football-access-card")?.addEventListener("click", openApp);
    $("#logoutButton")?.addEventListener("click", closeApp);

    $("#refreshButton")?.addEventListener("click", () => {
      loadData().catch((error) => {
        console.error(error);
        setStatus("Erro na API", error.message || "Verifique o console", "error");
      });
    });

    $$('[data-view]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        showView(button.dataset.view);
      });
    });

    $$('[data-status]').forEach((button) => {
      button.addEventListener("click", () => {
        state.status = button.dataset.status;
        $$('[data-status]').forEach((item) => item.classList.toggle("active", item === button));
        renderGames();
      });
    });

    $("#apiForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadData().catch((error) => {
        console.error(error);
        setStatus("Erro na API", error.message || "Verifique o console", "error");
      });
    });
  }

  function init() {
    const input = $("#apiUrlInput");
    if (input) input.value = CONFIG.apiUrl;
    bindEvents();
    setStatus("API aguardando", "Entre no painel", "loading");
  }

  window.JTIPS = {
    state,
    config: CONFIG,
    loadData,
    showView,
    openApp,
    normalizePayload,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
