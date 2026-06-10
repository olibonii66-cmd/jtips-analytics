/*
 * JTIPS Analytics - Motor secundario limpo
 * ------------------------------------------------------------
 * Este arquivo NAO esta conectado ao index.html ainda.
 * Objetivo: preparar uma versao legivel para substituir o runtime compactado depois.
 *
 * Regras principais:
 * - Melhores do Dia renderiza cards completos com Linhas de Conforto e Bilhete.
 * - Jogos do Dia renderiza lista simples por liga/horario, sem cards de bilhete.
 * - A API fica centralizada em uma normalizacao unica.
 */

(() => {
  "use strict";

  const CONFIG = {
    minConfidence: 70,
    maxTicketSelections: 6,
    timezone: "America/Sao_Paulo",
    apiUrl: window.JTIPS_API_URL || "",
    selectors: {
      bestBoard: "#melhores-do-dia",
      dailyList: "#dailyLeagueList",
      apiStatus: ".api-status",
      refreshButton: "#refreshButton",
    },
  };

  const MARKET_GROUPS = [
    {
      id: "double_chance",
      label: "Chance dupla",
      aliases: ["chance dupla", "dupla chance", "double chance", "1x", "x2", "12"],
      priority: 10,
    },
    {
      id: "winner",
      label: "Vencedor",
      aliases: ["vencedor", "winner", "resultado", "resultado final", "1x2", "casa vence", "fora vence", "home win", "away win"],
      priority: 20,
    },
    {
      id: "goals_total",
      label: "Gols Mais/Menos",
      aliases: ["gols", "goals", "over goals", "under goals", "over", "under", "mais de gols", "menos de gols", "mais de 0.5", "mais de 1.5", "mais de 2.5", "menos de 0.5", "menos de 1.5", "menos de 2.5"],
      priority: 30,
    },
    {
      id: "btts",
      label: "Ambas marcam",
      aliases: ["ambas marcam", "btts", "both teams score", "both teams to score"],
      priority: 40,
    },
    {
      id: "corners_total",
      label: "Escanteios Mais/Menos",
      aliases: ["escanteios", "cantos", "corners", "corner", "over corners", "under corners", "mais de escanteios", "menos de escanteios"],
      priority: 50,
    },
    {
      id: "cards_total",
      label: "Cartões Mais/Menos",
      aliases: ["cartoes", "cartões", "cards", "yellow cards", "cartao", "cartão", "over cards", "under cards", "mais de cartões", "menos de cartões"],
      priority: 60,
    },
  ];

  const FIELD_ALIASES = {
    id: ["id", "fixture_id", "match_id", "game_id"],
    home: ["home", "home_name", "home_team", "homeTeam", "teams.home.name", "localteam.name"],
    away: ["away", "away_name", "away_team", "awayTeam", "teams.away.name", "visitorteam.name"],
    league: ["league", "league_name", "competition", "competition.name", "league.name"],
    country: ["country", "country_name", "league.country", "country.name"],
    date: ["date", "match_date", "fixture.date", "starting_at", "start_time", "kickoff"],
    time: ["time", "match_time", "fixture.time", "starting_at", "start_time", "kickoff"],
    status: ["status", "status.short", "fixture.status.short", "state"],
  };

  const state = {
    rawPayload: null,
    matches: [],
    selectedDate: null,
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.+-]+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getPath(object, path) {
    return String(path)
      .split(".")
      .reduce((current, key) => current == null ? undefined : current[key], object);
  }

  function pick(object, aliases, fallback = "") {
    for (const alias of aliases) {
      const value = alias.includes(".") ? getPath(object, alias) : object?.[alias];
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
    const raw = String(value).trim();
    const match = raw.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : raw;
  }

  function normalizeTime(value) {
    if (!value) return "--:--";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: CONFIG.timezone,
      }).format(date);
    }
    const raw = String(value).trim();
    const match = raw.match(/(\d{1,2}:\d{2})/);
    return match ? match[1].padStart(5, "0") : raw;
  }

  function getMarketGroup(label) {
    const normalized = normalizeText(label);
    return MARKET_GROUPS.find((group) =>
      group.aliases.some((alias) => normalized.includes(normalizeText(alias))),
    );
  }

  function friendlySelectionName(rawName, group, match) {
    const normalized = normalizeText(rawName);
    const name = String(rawName || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

    if (group.id === "btts") return "Ambas marcam";

    if (group.id === "winner") {
      if (normalized.includes("home") || normalized.includes("casa") || normalized === "1") return `${match.home} vence`;
      if (normalized.includes("away") || normalized.includes("fora") || normalized === "2") return `${match.away} vence`;
      return name || "Vencedor";
    }

    if (group.id === "double_chance") {
      if (/\b1x\b/i.test(name)) return `${match.home} ou empate`;
      if (/\bx2\b/i.test(name)) return `${match.away} ou empate`;
      if (/\b12\b/i.test(name)) return `${match.home} ou ${match.away}`;
      return name || "Chance dupla";
    }

    if (group.id === "goals_total") return name.replace(/over/gi, "Mais de").replace(/under/gi, "Menos de") || "Gols Mais/Menos";
    if (group.id === "corners_total") return name.replace(/over/gi, "Mais de").replace(/under/gi, "Menos de") || "Escanteios Mais/Menos";
    if (group.id === "cards_total") return name.replace(/over/gi, "Mais de").replace(/under/gi, "Menos de") || "Cartões Mais/Menos";

    return name || group.label;
  }

  function collectObjects(value, output = []) {
    if (!value || output.length > 2000) return output;
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

  function findPercentCandidate(object) {
    const percentKeys = ["probability", "probabilidade", "chance", "confidence", "confianca", "confiança", "percent", "percentage", "pct", "value"];
    for (const key of percentKeys) {
      if (object && key in object) {
        const percent = toPercent(object[key]);
        if (percent !== null) return percent;
      }
    }
    return null;
  }

  function findOddCandidate(object) {
    const oddKeys = ["odd", "odds", "price", "cotacao", "cotação", "bookmaker_odd"];
    for (const key of oddKeys) {
      if (object && key in object) {
        const odd = toOdd(object[key]);
        if (odd !== null) return odd;
      }
    }
    return null;
  }

  function findNameCandidate(object, fallback = "") {
    const nameKeys = ["market", "mercado", "selection", "selecao", "seleção", "pick", "tip", "name", "nome", "label", "title", "titulo", "type", "tipo"];
    for (const key of nameKeys) {
      if (typeof object?.[key] === "string" && object[key].trim()) return object[key];
    }
    return fallback;
  }

  function inferMarketNameFromKey(key, object) {
    return findNameCandidate(object, "") || String(key || "").replace(/[_-]+/g, " ");
  }

  function extractMarketsFromFlatObject(source, match) {
    const markets = [];

    function walk(value, key = "", parent = null, depth = 0) {
      if (!value || depth > 8) return;

      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${key}.${index}`, value, depth + 1));
        return;
      }

      if (typeof value !== "object") return;

      const name = inferMarketNameFromKey(key, value);
      const group = getMarketGroup(name);
      const percent = findPercentCandidate(value);
      const odd = findOddCandidate(value) || findOddCandidate(parent);

      if (group && percent !== null && percent >= CONFIG.minConfidence) {
        markets.push({
          groupId: group.id,
          groupLabel: group.label,
          selection: friendlySelectionName(name, group, match),
          confidence: percent,
          odd,
          sourceName: name,
          priority: group.priority,
        });
      }

      Object.entries(value).forEach(([childKey, childValue]) => {
        if (typeof childValue === "number" || typeof childValue === "string") {
          const childGroup = getMarketGroup(childKey);
          const childPercent = toPercent(childValue);
          if (childGroup && childPercent !== null && childPercent >= CONFIG.minConfidence) {
            markets.push({
              groupId: childGroup.id,
              groupLabel: childGroup.label,
              selection: friendlySelectionName(childKey, childGroup, match),
              confidence: childPercent,
              odd: findOddCandidate(value),
              sourceName: childKey,
              priority: childGroup.priority,
            });
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
      .filter((market) => market && market.confidence >= CONFIG.minConfidence)
      .sort((a, b) => b.confidence - a.confidence || a.priority - b.priority)
      .filter((market) => {
        const key = `${market.groupId}:${normalizeText(market.selection)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function hasConflict(candidate, selected) {
    const sameGroup = selected.filter((item) => item.groupId === candidate.groupId);
    if (!sameGroup.length) return false;
    if (["goals_total", "corners_total", "cards_total"].includes(candidate.groupId)) {
      return sameGroup.some((item) => normalizeText(item.selection) === normalizeText(candidate.selection));
    }
    return true;
  }

  function buildTicket(markets) {
    const selected = [];
    const ordered = [...markets].sort((a, b) => b.confidence - a.confidence || a.priority - b.priority);

    for (const market of ordered) {
      if (selected.length >= CONFIG.maxTicketSelections) break;
      if (hasConflict(market, selected)) continue;
      selected.push(market);
    }

    return selected;
  }

  function normalizeMatch(raw) {
    const home = String(pick(raw, FIELD_ALIASES.home, "Casa")).trim();
    const away = String(pick(raw, FIELD_ALIASES.away, "Fora")).trim();
    const dateRaw = pick(raw, FIELD_ALIASES.date, "");
    const timeRaw = pick(raw, FIELD_ALIASES.time, dateRaw);

    const match = {
      id: String(pick(raw, FIELD_ALIASES.id, `${home}-${away}-${dateRaw}`)),
      home,
      away,
      league: String(pick(raw, FIELD_ALIASES.league, "Liga não informada")),
      country: String(pick(raw, FIELD_ALIASES.country, "")),
      date: normalizeDate(dateRaw),
      time: normalizeTime(timeRaw),
      status: String(pick(raw, FIELD_ALIASES.status, "pre")),
      raw,
      markets: [],
      ticket: [],
    };

    match.markets = extractMarketsFromFlatObject(raw, match);
    match.ticket = buildTicket(match.markets);
    return match;
  }

  function extractMatchArray(payload) {
    if (Array.isArray(payload)) return payload;
    const likelyKeys = ["matches", "fixtures", "games", "data", "items", "results"];
    for (const key of likelyKeys) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    const arrays = collectObjects(payload)
      .flatMap((object) => Object.values(object).filter(Array.isArray))
      .sort((a, b) => b.length - a.length);
    return arrays[0] || [];
  }

  function normalizePayload(payload) {
    const rows = extractMatchArray(payload);
    return rows
      .map(normalizeMatch)
      .filter((match) => match.home && match.away);
  }

  function renderMarketLine(market) {
    return `
      <div class="signal-line" data-market-group="${escapeHtml(market.groupId)}">
        <span>${escapeHtml(market.selection)}</span>
        <div><i style="width: ${Math.min(100, market.confidence)}%"></i></div>
        <strong>${market.confidence}%</strong>
      </div>
    `;
  }

  function renderTicketRow(market) {
    return `
      <div class="ticket-row" data-market-group="${escapeHtml(market.groupId)}">
        <span class="ticket-pick">${escapeHtml(market.selection)}</span>
        <strong>${market.confidence}%</strong>
        <em>${market.odd ? `Odd ${market.odd.toFixed(2)}` : "Sem odd"}</em>
      </div>
    `;
  }

  function calculateTotalOdd(ticket) {
    const odds = ticket.map((item) => item.odd).filter(Boolean);
    if (!odds.length) return "—";
    return odds.reduce((total, odd) => total * odd, 1).toFixed(2);
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

  function renderBestCard(match) {
    const hasTicket = match.ticket.length > 0;
    return `
      <article class="market-card" data-match-id="${escapeHtml(match.id)}">
        <header class="market-card-header">
          <div class="match-identity">
            <span class="mini-crest">${escapeHtml(initials(match.home))}</span>
            <div>
              <strong>${escapeHtml(match.home)} <span>vs</span> ${escapeHtml(match.away)}</strong>
              <small>${escapeHtml(match.country ? `${match.country} • ${match.league}` : match.league)}</small>
            </div>
          </div>
          <button class="favorite-button" type="button" aria-label="Favoritar partida">★</button>
          <span class="match-clock">${escapeHtml(match.time)}</span>
        </header>

        <div class="score-panel pregame-panel">
          <div class="team-side">
            <span class="team-logo">${escapeHtml(initials(match.home))}</span>
            <span>Casa</span>
            <strong>${escapeHtml(match.home)}</strong>
          </div>
          <div class="team-side right">
            <span class="team-logo">${escapeHtml(initials(match.away))}</span>
            <span>Fora</span>
            <strong>${escapeHtml(match.away)}</strong>
          </div>
        </div>

        <div class="line-section">
          <div class="line-heading">
            <span>Linhas de Conforto</span>
            <strong>+${CONFIG.minConfidence}%</strong>
          </div>
          <div class="signal-lines">
            ${match.markets.map(renderMarketLine).join("")}
          </div>
        </div>

        <div class="line-section players">
          <div class="line-heading">
            <span>Bilhete</span>
            <strong>${match.ticket.length} seleções</strong>
          </div>
          <div class="ticket-slip">
            ${hasTicket ? match.ticket.map(renderTicketRow).join("") : "<p class='empty-state'>Sem seleções suficientes para bilhete.</p>"}
            <div class="ticket-total">
              <span>Odd total</span>
              <strong>${calculateTotalOdd(match.ticket)}</strong>
            </div>
          </div>
        </div>

        <footer class="market-actions">
          <button type="button" data-analysis-id="${escapeHtml(match.id)}">Análise</button>
          <button class="bet365-button" type="button"><span>bet</span>365</button>
        </footer>
      </article>
    `;
  }

  function renderBestMatches(matches) {
    const board = document.querySelector(CONFIG.selectors.bestBoard);
    if (!board) return;
    const best = matches
      .filter((match) => match.markets.some((market) => market.confidence >= CONFIG.minConfidence))
      .sort((a, b) => {
        const aTop = Math.max(...a.markets.map((market) => market.confidence));
        const bTop = Math.max(...b.markets.map((market) => market.confidence));
        return bTop - aTop;
      });
    board.innerHTML = best.length
      ? best.map(renderBestCard).join("")
      : `
        <article class="market-card featured">
          <div class="settings-shell">
            <p class="eyebrow">Melhores do dia</p>
            <h2>Nenhuma linha acima de ${CONFIG.minConfidence}%</h2>
            <p>Quando a API retornar mercados elegíveis, eles aparecerão aqui.</p>
          </div>
        </article>
      `;
  }

  function getStatusLabel(status) {
    const normalized = normalizeText(status);
    if (["ft", "finished", "finalizado", "encerrado"].some((word) => normalized.includes(word))) return "Encerrado";
    if (["live", "ao vivo", "inplay", "1h", "2h", "ht"].some((word) => normalized.includes(word))) return "Ao vivo";
    return "Pré-jogo";
  }

  function groupByLeague(matches) {
    return matches.reduce((groups, match) => {
      const key = match.country ? `${match.country} • ${match.league}` : match.league;
      if (!groups[key]) groups[key] = [];
      groups[key].push(match);
      return groups;
    }, {});
  }

  function renderDailyGameRow(match) {
    const topMarket = match.markets[0];
    const marketText = topMarket ? `${topMarket.selection} • ${topMarket.confidence}%` : "Sem linha acima de 70%";
    return `
      <button class="daily-game-row" type="button" data-match-id="${escapeHtml(match.id)}">
        <span class="daily-game-time">${escapeHtml(match.time)}</span>
        <span class="daily-game-main">
          <strong>${escapeHtml(match.home)} x ${escapeHtml(match.away)}</strong>
          <small>${escapeHtml(marketText)}</small>
        </span>
        <em class="daily-game-status">${escapeHtml(getStatusLabel(match.status))}</em>
      </button>
    `;
  }

  function renderDailyGames(matches) {
    const list = document.querySelector(CONFIG.selectors.dailyList);
    if (!list) return;

    const ordered = [...matches].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    const groups = groupByLeague(ordered);
    const html = Object.entries(groups)
      .map(([league, leagueMatches]) => `
        <article class="daily-league-group">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Liga</p>
              <h3>${escapeHtml(league)}</h3>
            </div>
            <span>${leagueMatches.length} jogos</span>
          </div>
          <div class="daily-game-list">
            ${leagueMatches.map(renderDailyGameRow).join("")}
          </div>
        </article>
      `)
      .join("");

    list.innerHTML = html || `<p class="empty-state">Nenhum jogo encontrado para o dia.</p>`;
  }

  function updateStatus(message, detail) {
    const status = document.querySelector(CONFIG.selectors.apiStatus);
    if (!status) return;
    const strong = status.querySelector("strong");
    const span = status.querySelector("span:last-child");
    if (strong) strong.textContent = message;
    if (span) span.textContent = detail;
  }

  async function loadApiData() {
    if (!CONFIG.apiUrl) {
      updateStatus("API não configurada", "Defina window.JTIPS_API_URL");
      return;
    }

    updateStatus("API carregando", "Buscando jogos");

    const response = await fetch(CONFIG.apiUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erro API ${response.status}`);

    const payload = await response.json();
    state.rawPayload = payload;
    state.matches = normalizePayload(payload);

    updateStatus("API conectada", `${state.matches.length} jogos carregados`);
    renderBestMatches(state.matches);
    renderDailyGames(state.matches);
  }

  function init() {
    document.querySelector(CONFIG.selectors.refreshButton)?.addEventListener("click", () => {
      loadApiData().catch((error) => {
        console.error(error);
        updateStatus("Erro na API", "Verifique o console");
      });
    });

    loadApiData().catch((error) => {
      console.error(error);
      updateStatus("Erro na API", "Verifique configuração");
    });
  }

  window.JTIPS_NEXT = {
    config: CONFIG,
    state,
    normalizePayload,
    normalizeMatch,
    extractMarketsFromFlatObject,
    buildTicket,
    renderBestMatches,
    renderDailyGames,
    loadApiData,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
