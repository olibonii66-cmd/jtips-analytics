(() => {
  "use strict";

  const CONFIG = {
    minConfidence: 70,
    maxTicketSelections: 6,
    timezone: "America/Sao_Paulo",
    get apiUrl() {
      return window.JTIPS_API_URL || localStorage.getItem("JTIPS_API_URL") || "";
    },
  };

  const state = {
    rawPayload: null,
    matches: [],
    view: "best",
    status: "all",
  };

  const groups = [
    { id: "double_chance", label: "Chance dupla", aliases: ["chance dupla", "dupla chance", "double chance", "1x", "x2", "12"], priority: 10 },
    { id: "winner", label: "Vencedor", aliases: ["vencedor", "winner", "resultado", "resultado final", "1x2", "casa vence", "fora vence", "home win", "away win"], priority: 20 },
    { id: "goals", label: "Gols Mais/Menos", aliases: ["gols", "goals", "over", "under", "mais de gols", "menos de gols", "mais de 0.5", "mais de 1.5", "mais de 2.5", "menos de 0.5", "menos de 1.5", "menos de 2.5"], priority: 30 },
    { id: "btts", label: "Ambas marcam", aliases: ["ambas marcam", "btts", "both teams score", "both teams to score"], priority: 40 },
    { id: "corners", label: "Escanteios Mais/Menos", aliases: ["escanteios", "cantos", "corners", "corner", "mais de escanteios", "menos de escanteios"], priority: 50 },
    { id: "cards", label: "Cartões Mais/Menos", aliases: ["cartoes", "cartões", "cards", "yellow cards", "cartao", "cartão", "mais de cartões", "menos de cartões"], priority: 60 },
  ];

  const fields = {
    id: ["id", "fixture_id", "match_id", "game_id"],
    home: ["home", "home_name", "home_team", "homeTeam", "teams.home.name", "localteam.name"],
    away: ["away", "away_name", "away_team", "awayTeam", "teams.away.name", "visitorteam.name"],
    league: ["league", "league_name", "competition", "competition.name", "league.name"],
    country: ["country", "country_name", "league.country", "country.name"],
    date: ["date", "match_date", "fixture.date", "starting_at", "start_time", "kickoff"],
    time: ["time", "match_time", "fixture.time", "starting_at", "start_time", "kickoff"],
    status: ["status", "status.short", "fixture.status.short", "state"],
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function text(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.+-]+/g, " ").trim();
  }

  function path(object, keyPath) {
    return String(keyPath).split(".").reduce((current, key) => current == null ? undefined : current[key], object);
  }

  function pick(object, aliases, fallback = "") {
    for (const alias of aliases) {
      const value = alias.includes(".") ? path(object, alias) : object?.[alias];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
  }

  function toNumber(value) {
    if (typeof value === "string") value = value.replace("%", "").replace(",", ".");
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function toPercent(value) {
    const number = toNumber(value);
    if (number === null) return null;
    if (number > 0 && number <= 1) return Math.round(number * 100);
    if (number >= 0 && number <= 100) return Math.round(number);
    return null;
  }

  function toOdd(value) {
    const number = toNumber(value);
    if (number === null || number < 1 || number > 1000) return null;
    return Number(number.toFixed(2));
  }

  function normalizeDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    const match = String(value).match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : String(value);
  }

  function normalizeTime(value) {
    if (!value) return "--:--";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone }).format(date);
    }
    const match = String(value).match(/(\d{1,2}:\d{2})/);
    return match ? match[1].padStart(5, "0") : String(value);
  }

  function groupFor(label) {
    const value = normalize(label);
    return groups.find((group) => group.aliases.some((alias) => value.includes(normalize(alias))));
  }

  function findName(object, fallback = "") {
    for (const key of ["market", "mercado", "selection", "selecao", "seleção", "pick", "tip", "name", "nome", "label", "title", "titulo", "type", "tipo"]) {
      if (typeof object?.[key] === "string" && object[key].trim()) return object[key];
    }
    return fallback;
  }

  function findPercent(object) {
    for (const key of ["probability", "probabilidade", "chance", "confidence", "confianca", "confiança", "percent", "percentage", "pct", "value"]) {
      if (object && key in object) {
        const percent = toPercent(object[key]);
        if (percent !== null) return percent;
      }
    }
    return null;
  }

  function findOdd(object) {
    for (const key of ["odd", "odds", "price", "cotacao", "cotação", "bookmaker_odd"]) {
      if (object && key in object) {
        const odd = toOdd(object[key]);
        if (odd !== null) return odd;
      }
    }
    return null;
  }

  function selectionName(rawName, group, match) {
    const clean = String(rawName || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const value = normalize(clean);

    if (group.id === "btts") return "Ambas marcam";
    if (group.id === "winner") {
      if (value.includes("home") || value.includes("casa") || value === "1") return `${match.home} vence`;
      if (value.includes("away") || value.includes("fora") || value === "2") return `${match.away} vence`;
      return clean || group.label;
    }
    if (group.id === "double_chance") {
      if (/\b1x\b/i.test(clean)) return `${match.home} ou empate`;
      if (/\bx2\b/i.test(clean)) return `${match.away} ou empate`;
      if (/\b12\b/i.test(clean)) return `${match.home} ou ${match.away}`;
      return clean || group.label;
    }
    return clean.replace(/over/gi, "Mais de").replace(/under/gi, "Menos de") || group.label;
  }

  function collectObjects(value, output = []) {
    if (!value || output.length > 2500) return output;
    if (Array.isArray(value)) {
      value.forEach((item) => collectObjects(item, output));
      return output;
    }
    if (typeof value === "object") {
      output.push(value);
      Object.values(value).forEach((item) => collectObjects(item, output));
    }
    return output;
  }

  function extractMarkets(source, match) {
    const markets = [];

    function walk(value, key = "", parent = null, depth = 0) {
      if (!value || depth > 8) return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${key}.${index}`, value, depth + 1));
        return;
      }
      if (typeof value !== "object") return;

      const name = findName(value, String(key).replace(/[_-]+/g, " "));
      const group = groupFor(name);
      const percent = findPercent(value);
      const odd = findOdd(value) || findOdd(parent);

      if (group && percent !== null && percent >= CONFIG.minConfidence) {
        markets.push({ groupId: group.id, groupLabel: group.label, selection: selectionName(name, group, match), confidence: percent, odd, priority: group.priority });
      }

      Object.entries(value).forEach(([childKey, childValue]) => {
        if (typeof childValue === "number" || typeof childValue === "string") {
          const childGroup = groupFor(childKey);
          const childPercent = toPercent(childValue);
          if (childGroup && childPercent !== null && childPercent >= CONFIG.minConfidence) {
            markets.push({ groupId: childGroup.id, groupLabel: childGroup.label, selection: selectionName(childKey, childGroup, match), confidence: childPercent, odd: findOdd(value), priority: childGroup.priority });
          }
          return;
        }
        walk(childValue, childKey, value, depth + 1);
      });
    }

    walk(source);
    return dedupeMarkets(markets);
  }

  function dedupeMarkets(markets) {
    const seen = new Set();
    return markets
      .filter((market) => market.confidence >= CONFIG.minConfidence)
      .sort((a, b) => b.confidence - a.confidence || a.priority - b.priority)
      .filter((market) => {
        const key = `${market.groupId}:${normalize(market.selection)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function hasConflict(candidate, selected) {
    const sameGroup = selected.filter((item) => item.groupId === candidate.groupId);
    if (!sameGroup.length) return false;
    if (["goals", "corners", "cards"].includes(candidate.groupId)) {
      return sameGroup.some((item) => normalize(item.selection) === normalize(candidate.selection));
    }
    return true;
  }

  function buildTicket(markets) {
    const selected = [];
    for (const market of [...markets].sort((a, b) => b.confidence - a.confidence || a.priority - b.priority)) {
      if (selected.length >= CONFIG.maxTicketSelections) break;
      if (!hasConflict(market, selected)) selected.push(market);
    }
    return selected;
  }

  function normalizeMatch(raw) {
    const home = String(pick(raw, fields.home, "Casa")).trim();
    const away = String(pick(raw, fields.away, "Fora")).trim();
    const dateRaw = pick(raw, fields.date, "");
    const timeRaw = pick(raw, fields.time, dateRaw);
    const match = {
      id: String(pick(raw, fields.id, `${home}-${away}-${dateRaw}`)),
      home,
      away,
      league: String(pick(raw, fields.league, "Liga não informada")),
      country: String(pick(raw, fields.country, "")),
      date: normalizeDate(dateRaw),
      time: normalizeTime(timeRaw),
      status: String(pick(raw, fields.status, "pre")),
      raw,
      markets: [],
      ticket: [],
    };
    match.markets = extractMarkets(raw, match);
    match.ticket = buildTicket(match.markets);
    return match;
  }

  function extractRows(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["matches", "fixtures", "games", "data", "items", "results"]) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    const arrays = collectObjects(payload).flatMap((object) => Object.values(object).filter(Array.isArray)).sort((a, b) => b.length - a.length);
    return arrays[0] || [];
  }

  function normalizePayload(payload) {
    return extractRows(payload).map(normalizeMatch).filter((match) => match.home && match.away);
  }

  function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function statusLabel(status) {
    const value = normalize(status);
    if (["ft", "finished", "finalizado", "encerrado"].some((word) => value.includes(word))) return "Encerrado";
    if (["live", "ao vivo", "inplay", "1h", "2h", "ht"].some((word) => value.includes(word))) return "Ao vivo";
    return "Pré-jogo";
  }

  function renderMarketLine(market) {
    return `<div class="line"><span>${text(market.selection)}</span><div class="bar"><i style="width:${Math.min(100, market.confidence)}%"></i></div><strong>${market.confidence}%</strong></div>`;
  }

  function renderTicketRow(market) {
    return `<div class="ticket-row"><span>${text(market.selection)}</span><strong>${market.confidence}%</strong><em>${market.odd ? `Odd ${market.odd.toFixed(2)}` : "Sem odd"}</em></div>`;
  }

  function totalOdd(ticket) {
    const odds = ticket.map((item) => item.odd).filter(Boolean);
    return odds.length ? odds.reduce((total, odd) => total * odd, 1).toFixed(2) : "—";
  }

  function renderCard(match) {
    return `<article class="card" data-match-id="${text(match.id)}">
      <header class="card-header">
        <div class="match-title"><span class="crest">${text(initials(match.home))}</span><div><strong>${text(match.home)} x ${text(match.away)}</strong><small>${text(match.country ? `${match.country} • ${match.league}` : match.league)}</small></div></div>
        <span class="clock">${text(match.time)}</span>
      </header>
      <div class="teams"><div class="team-box"><span>Casa</span><strong>${text(match.home)}</strong></div><div class="team-box"><span>Fora</span><strong>${text(match.away)}</strong></div></div>
      <section class="block"><div class="block-heading"><span>Linhas de Conforto</span><strong>+${CONFIG.minConfidence}%</strong></div><div class="lines">${match.markets.map(renderMarketLine).join("") || `<p class="empty">Sem linhas acima de ${CONFIG.minConfidence}%.</p>`}</div></section>
      <section class="block"><div class="block-heading"><span>Bilhete</span><strong>${match.ticket.length} seleções</strong></div><div class="ticket">${match.ticket.map(renderTicketRow).join("") || `<p class="empty">Sem seleções para bilhete.</p>`}<div class="ticket-total"><span>Odd total</span><strong>${totalOdd(match.ticket)}</strong></div></div></section>
      <footer class="card-actions"><button type="button">Análise</button><button type="button">bet365</button></footer>
    </article>`;
  }

  function renderBest() {
    const grid = $("#bestGrid");
    if (!grid) return;
    const matches = state.matches
      .filter((match) => match.markets.length)
      .sort((a, b) => Math.max(...b.markets.map((m) => m.confidence)) - Math.max(...a.markets.map((m) => m.confidence)));
    grid.innerHTML = matches.length ? matches.map(renderCard).join("") : `<p class="empty">Nenhum mercado acima de ${CONFIG.minConfidence}% encontrado.</p>`;
  }

  function groupByLeague(matches) {
    return matches.reduce((groups, match) => {
      const key = match.country ? `${match.country} • ${match.league}` : match.league;
      groups[key] ||= [];
      groups[key].push(match);
      return groups;
    }, {});
  }

  function renderGameRow(match) {
    const top = match.markets[0];
    const market = top ? `${top.selection} • ${top.confidence}%` : `Sem linha acima de ${CONFIG.minConfidence}%`;
    return `<button class="game-row" type="button" data-match-id="${text(match.id)}"><time>${text(match.time)}</time><span><strong>${text(match.home)} x ${text(match.away)}</strong><small>${text(market)}</small></span><em>${text(statusLabel(match.status))}</em></button>`;
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
    list.innerHTML = Object.entries(grouped).map(([league, leagueMatches]) => `<article class="league-group"><div class="league-header"><h3>${text(league)}</h3><span>${leagueMatches.length} jogos</span></div>${leagueMatches.map(renderGameRow).join("")}</article>`).join("") || `<p class="empty">Nenhum jogo encontrado.</p>`;
  }

  function renderAll() {
    renderBest();
    renderGames();
  }

  function setStatus(title, detail, type = "loading") {
    const box = $("#apiStatus");
    if (!box) return;
    box.querySelector("strong").textContent = title;
    box.querySelector("small").textContent = detail;
    const dot = box.querySelector(".status-dot");
    dot.style.background = type === "ok" ? "var(--green)" : type === "error" ? "var(--red)" : "var(--amber)";
    dot.style.boxShadow = `0 0 16px ${type === "ok" ? "var(--green)" : type === "error" ? "var(--red)" : "var(--amber)"}`;
  }

  async function loadData() {
    if (!CONFIG.apiUrl) {
      state.matches = [];
      setStatus("API não configurada", "Configure a URL", "error");
      renderAll();
      return;
    }
    setStatus("API carregando", "Buscando jogos", "loading");
    const response = await fetch(CONFIG.apiUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro API ${response.status}`);
    state.rawPayload = await response.json();
    state.matches = normalizePayload(state.rawPayload);
    setStatus("API conectada", `${state.matches.length} jogos carregados`, "ok");
    renderAll();
  }

  function showView(view) {
    state.view = view;
    $$('[data-view-panel]').forEach((panel) => panel.classList.toggle("is-hidden", panel.id !== `${view}View`));
    $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#pageTitle").textContent = view === "games" ? "Jogos do Dia" : view === "settings" ? "Configurações" : "Melhores do Dia";
  }

  function openApp() {
    $("#loginView").classList.add("is-hidden");
    $("#appShell").classList.remove("is-hidden");
    showView("best");
    loadData().catch((error) => {
      console.error(error);
      setStatus("Erro na API", "Verifique o console", "error");
    });
  }

  function closeApp() {
    $("#appShell").classList.add("is-hidden");
    $("#loginView").classList.remove("is-hidden");
  }

  function bindEvents() {
    $("#loginForm")?.addEventListener("submit", (event) => { event.preventDefault(); openApp(); });
    $("#logoutButton")?.addEventListener("click", closeApp);
    $("#refreshButton")?.addEventListener("click", () => loadData().catch((error) => { console.error(error); setStatus("Erro na API", "Verifique o console", "error"); }));
    $$('[data-view]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
    $$('[data-status]').forEach((button) => button.addEventListener("click", () => {
      state.status = button.dataset.status;
      $$('[data-status]').forEach((item) => item.classList.toggle("active", item === button));
      renderGames();
    }));
    $("#apiForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const url = $("#apiUrlInput").value.trim();
      if (url) localStorage.setItem("JTIPS_API_URL", url);
      loadData().catch((error) => { console.error(error); setStatus("Erro na API", "Verifique o console", "error"); });
    });
  }

  function init() {
    $("#apiUrlInput") && ($("#apiUrlInput").value = CONFIG.apiUrl);
    bindEvents();
    setStatus("API aguardando", "Entre no painel", "loading");
  }

  window.JTIPS = { state, config: CONFIG, loadData, normalizePayload, normalizeMatch, extractMarkets, buildTicket, showView, openApp };
  document.addEventListener("DOMContentLoaded", init);
})();
