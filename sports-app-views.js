(function() {
  const previous = {
    completas: typeof renderCompletas === "function" ? renderCompletas : null,
    gols: typeof renderGols === "function" ? renderGols : null,
    escanteios: typeof renderEscanteios === "function" ? renderEscanteios : null,
    cartoes: typeof renderCartoes === "function" ? renderCartoes : null,
    chutes: typeof renderChutes === "function" ? renderChutes : null,
    intervalo: typeof renderIntervalo === "function" ? renderIntervalo : null,
    jogadores: typeof renderJogadores === "function" ? renderJogadores : null,
    ia: typeof renderIA === "function" ? renderIA : null
  };

  function safePrevious(fn) {
    if (!fn) return;
    try { fn(); } catch (error) { console.warn("Nao foi possivel preparar os dados da aba", error); }
  }

  function currentData() { return selectedMatch?.complete || null; }
  function rawData(data) { return data?.raw?.match_details || data?.raw?.match || selectedMatch?.raw || {}; }
  function exists(value) { return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1"; }
  function esc(value) { return typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? ""); }

  function num(value) {
    if (!exists(value)) return null;
    const parsed = Number(String(value).replace("%", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function get(source, path) {
    if (!source || !path) return undefined;
    return String(path).split(".").reduce(function(current, key) {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, source);
  }

  function pick(source, paths, fallback) {
    for (const path of paths) {
      const value = typeof path === "function" ? path(source) : get(source, path);
      if (exists(value)) return value;
    }
    return fallback;
  }

  function pctText(value) {
    const parsed = num(value);
    if (parsed === null) return "-";
    return `${Math.round(parsed <= 1 ? parsed * 100 : parsed)}%`;
  }

  function valueText(value, decimals) {
    const parsed = num(value);
    if (parsed === null) return exists(value) ? String(value) : "-";
    return String(Number(parsed.toFixed(decimals ?? 2)));
  }

  function percentWidth(value, fallback) {
    const parsed = num(value);
    if (parsed === null) return fallback ?? 50;
    return Math.max(6, Math.min(100, Math.round(parsed <= 1 ? parsed * 100 : parsed)));
  }

  function home() { return typeof homeName === "function" ? homeName() : selectedMatch?.home || "Mandante"; }
  function away() { return typeof awayName === "function" ? awayName() : selectedMatch?.away || "Visitante"; }

  function logo(side) {
    const data = currentData();
    const image = side === "home" ? data?.teams?.home?.image || selectedMatch?.homeLogo : data?.teams?.away?.image || selectedMatch?.awayLogo;
    const name = side === "home" ? home() : away();
    const initials = String(name || "T").split(/\s+/).filter(Boolean).slice(0, 2).map(function(part) { return part[0]; }).join("").toUpperCase() || "T";
    if (image) return `<img src="${esc(image)}" alt="${esc(name)}" onerror="this.outerHTML='<span>${esc(initials)}</span>'">`;
    return `<span>${esc(initials)}</span>`;
  }

  function page(content) { return `<div class="sa-page">${content}</div>`; }
  function chip(label, value) { return `<div class="sa-chip"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }

  function quickCard(eyebrow, title, text, chips) {
    return `<section class="sa-quick-card"><div><span class="sa-eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="sa-chip-grid">${chips.map(function(item) { return chip(item[0], item[1]); }).join("")}</div></section>`;
  }

  function metricCard(label, value, small, rawValue, tone) {
    return `<article class="sa-metric-card"><div class="sa-metric-top"><span>${esc(label)}</span><i class="sa-info-dot">i</i></div><strong>${esc(value)}</strong><small>${esc(small || "Dados FootyStats")}</small><div class="sa-progress ${tone === "risk" ? "risk" : ""}" style="--w:${percentWidth(rawValue, 50)}%"><i></i></div></article>`;
  }

  function metricSection(title, subtitle, cards) {
    return `<section class="sa-section"><header class="sa-section-header"><h3>${esc(title)}</h3><small>${esc(subtitle || "")}</small></header><div class="sa-card-grid">${cards.join("")}</div></section>`;
  }

  function panel(title, subtitle, body) {
    return `<section class="sa-section"><header class="sa-section-header"><h3>${esc(title)}</h3><small>${esc(subtitle || "")}</small></header><div class="sa-panel-body">${body}</div></section>`;
  }

  function trendRow(text, value, tone) {
    return `<div class="sa-trend-row ${tone === "down" ? "down" : ""}"><span>${tone === "down" ? "-" : "+"}</span><p>${esc(text)}</p><strong>${esc(value || "")}</strong></div>`;
  }

  function compareRows(rows) {
    return `<div class="sa-bars">${rows.map(function(row) {
      const homeValue = num(row.home) ?? 0;
      const awayValue = num(row.away) ?? 0;
      const max = Math.max(homeValue, awayValue, 1);
      const homeWidth = Math.max(8, Math.round((homeValue / max) * 100));
      const awayWidth = Math.max(8, Math.round((awayValue / max) * 100));
      return `<div class="sa-compare-row"><div class="sa-compare-label"><span>${esc(row.label)}</span><strong>${esc(row.format || "")}</strong></div><div class="sa-bar-pair"><div class="sa-bar home"><i style="--w:${homeWidth}%">${esc(row.homeText || valueText(row.home))}</i></div><div class="sa-bar away"><i style="--w:${awayWidth}%">${esc(row.awayText || valueText(row.away))}</i></div></div></div>`;
    }).join("")}</div>`;
  }

  function table(headers, rows) {
    return `<table class="sa-table"><thead><tr>${headers.map(function(header) { return `<th>${esc(header)}</th>`; }).join("")}</tr></thead><tbody>${rows.map(function(row) { return `<tr>${row.map(function(cell) { return `<td>${esc(cell)}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table>`;
  }

  function note(text) { return `<div class="sa-note">${esc(text)}</div>`; }

  function loadingPage(title, text) {
    return page(quickCard("Carregando dados", title, text, [["Origem", "FootyStats API"], ["Status", "Atualizando"], ["Aba", "Novo visual"]]));
  }

  function errorPage(title, error) {
    return page(panel(title, "Dados indisponiveis", `<div class="sa-empty">${esc(error || "Nao foi possivel carregar esta aba.")}</div>`));
  }

  function baseInsights(data) {
    const raw = rawData(data);
    const over25 = pick(data, ["potentials.goals.over25", function() { return selectedMatch?.over25; }, function() { return raw.o25_potential; }, function() { return raw.over_25_percentage; }], null);
    const over15 = pick(data, ["potentials.goals.over15", function() { return raw.o15_potential; }, function() { return raw.over_15_percentage; }], null);
    const btts = pick(data, ["potentials.btts.full_time", function() { return selectedMatch?.btts; }, function() { return raw.btts_potential; }, function() { return raw.btts_percentage; }], null);
    const corners = pick(data, ["corners.potential.total", "corners.full_time.total", function() { return raw.total_corner_avg; }, function() { return raw.corners_potential; }], null);
    const cards = pick(data, ["cards.potential.total", "cards.full_time.total", function() { return raw.total_cards_avg; }, function() { return raw.cards_potential; }], null);
    const goalsAvg = pick(data, ["goals.total.avg", function() { return raw.total_goals_avg; }, function() { return raw.average_goals; }, function() { return raw.league_avg_goals; }], null);
    return { raw, over25, over15, btts, corners, cards, goalsAvg };
  }

  function renderCompletasSports() {
    const data = currentData();
    safePrevious(previous.completas);
    if (!data) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : loadingPage("Preparando analise", "Buscando dados completos da partida.");
    const info = baseInsights(data);
    const h2h = data.h2h || info.raw.h2h || {};
    const h2hMatches = pick(h2h, ["total_matches", "totalMatches", "matches"], "-");
    const homePPG = pick(data, ["teams.home.ppg_home", "teams.home.ppg", function() { return info.raw.team_a_ppg; }, function() { return info.raw.home_ppg; }], null);
    const awayPPG = pick(data, ["teams.away.ppg_away", "teams.away.ppg", function() { return info.raw.team_b_ppg; }, function() { return info.raw.away_ppg; }], null);

    return page(
      quickCard("Central da partida", `${home()} x ${away()}`, `Leitura rapida com forma, mercado, confronto direto e sinais principais. O foco atual aponta ${pctText(info.over15)} em Mais de 1.5, ${pctText(info.over25)} em Mais de 2.5 e ${pctText(info.btts)} para Ambas Marcam.`, [["Mercado observado", `${pctText(info.over25)} Over 2.5`], ["Ambas marcam", pctText(info.btts)], ["H2H mapeado", `${h2hMatches} jogos`]]) +
      metricSection("Painel principal", "Dados reais da API", [
        metricCard("Over 2.5", pctText(info.over25), "Probabilidade pre-jogo", info.over25, percentWidth(info.over25) < 40 ? "risk" : "good"),
        metricCard("Over 1.5", pctText(info.over15), "Linha de seguranca", info.over15),
        metricCard("Ambas Marcam", pctText(info.btts), "BTTS", info.btts, percentWidth(info.btts) < 45 ? "risk" : "good"),
        metricCard("Gols / Jogo", valueText(info.goalsAvg), "Media projetada", (num(info.goalsAvg) || 0) * 25),
        metricCard("Escanteios", valueText(info.corners), "Media da partida", (num(info.corners) || 0) * 9),
        metricCard("Cartoes", valueText(info.cards), "Media da partida", (num(info.cards) || 0) * 18)
      ]) +
      `<div class="sa-panels">${panel("Tendencias", "Forma recente", [trendRow(`${home()} chega com PPG de mandante em ${valueText(homePPG)}.`, valueText(homePPG), "up"), trendRow(`${away()} chega com PPG de visitante em ${valueText(awayPPG)}.`, valueText(awayPPG), num(awayPPG) > num(homePPG) ? "up" : "down"), trendRow(`Linha de gols observada: Mais de 1.5 em ${pctText(info.over15)}.`, pctText(info.over15), "up")].join(""))}${panel("Comparativo", `${home()} vs ${away()}`, compareRows([{ label: "Forma PPG", home: homePPG, away: awayPPG }, { label: "Gols esperados", home: pick(data, ["xg.home", function() { return info.raw.team_a_xg; }], null), away: pick(data, ["xg.away", function() { return info.raw.team_b_xg; }], null) }, { label: "Escanteios", home: pick(data, ["corners.home", function() { return info.raw.team_a_corners_avg; }], null), away: pick(data, ["corners.away", function() { return info.raw.team_b_corners_avg; }], null) }]))}${panel("Resumo", "Para decisao", note("Use esta aba como mapa geral. Para aposta, confirme escalacoes, odd atual e se o mercado ainda tem valor antes de entrar."))}</div>`
    );
  }

  function ensurePrivateData(previousRender, key, loadingTitle, loadingText, errorKey) {
    const data = currentData();
    safePrevious(previousRender);
    if (!data) return { data: null, html: loadingPage(loadingTitle, loadingText) };
    if (data[errorKey]) return { data, html: errorPage(loadingTitle, data[errorKey]) };
    if (!data[key]) return { data, html: loadingPage(loadingTitle, loadingText) };
    return { data, privateData: data[key], html: null };
  }

  function renderGolsSports() {
    const prepared = ensurePrivateData(previous.gols, "_golsData", "Aba Gols", "Buscando gols marcados, sofridos e linhas Over/BTTS.", "_golsError");
    if (prepared.html) return prepared.html;
    const data = prepared.privateData;
    const h = data.home || {};
    const a = data.away || {};
    const scoredHome = pick(h, ["scored.avg", "goals_for_avg", "avg_scored"], null);
    const scoredAway = pick(a, ["scored.avg", "goals_for_avg", "avg_scored"], null);
    const concededHome = pick(h, ["conceded.avg", "goals_against_avg", "avg_conceded"], null);
    const concededAway = pick(a, ["conceded.avg", "goals_against_avg", "avg_conceded"], null);

    return page(
      quickCard("Analise de gols", "Quem tem mais forca para marcar?", `${home()} produz ${valueText(scoredHome)} gols por jogo no recorte usado, enquanto ${away()} aparece com ${valueText(scoredAway)}.`, [[home(), `${valueText(scoredHome)} gols/jogo`], [away(), `${valueText(scoredAway)} gols/jogo`], ["BTTS", pctText(pick(data, ["average.btts", "btts.average"], null))]]) +
      metricSection("Mercados de gols", "Linhas principais", [metricCard("Over 0.5", pctText(pick(data, ["average.over05", "average.over_0_5"], null)), "Media entre os times", pick(data, ["average.over05"], null)), metricCard("Over 1.5", pctText(pick(data, ["average.over15", "average.over_1_5"], null)), "Media entre os times", pick(data, ["average.over15"], null)), metricCard("Over 2.5", pctText(pick(data, ["average.over25", "average.over_2_5"], null)), "Media entre os times", pick(data, ["average.over25"], null), "risk"), metricCard("Ambas Marcam", pctText(pick(data, ["average.btts", "btts.average"], null)), "BTTS", pick(data, ["average.btts"], null), "risk"), metricCard("Mandante marca", valueText(scoredHome), home(), (num(scoredHome) || 0) * 45), metricCard("Visitante marca", valueText(scoredAway), away(), (num(scoredAway) || 0) * 45)]) +
      `<div class="sa-panels">${panel("Comparativo ofensivo", "Gols marcados e sofridos", compareRows([{ label: "Gols marcados", home: scoredHome, away: scoredAway }, { label: "Gols sofridos", home: concededHome, away: concededAway }, { label: "Over 1.5 time", home: pick(h, ["scored.over15", "scored.over_1_5"], null), away: pick(a, ["scored.over15", "scored.over_1_5"], null), homeText: pctText(pick(h, ["scored.over15", "scored.over_1_5"], null)), awayText: pctText(pick(a, ["scored.over15", "scored.over_1_5"], null)) }]))}${panel("1o e 2o tempo", "Distribuicao", table(["Mercado", home(), away()], [["Marca no 1o tempo", pctText(pick(h, ["halves.scored_1h", "scored.first_half"], null)), pctText(pick(a, ["halves.scored_1h", "scored.first_half"], null))], ["Marca no 2o tempo", pctText(pick(h, ["halves.scored_2h", "scored.second_half"], null)), pctText(pick(a, ["halves.scored_2h", "scored.second_half"], null))], ["Clean sheet", pctText(pick(h, ["conceded.clean_sheets", "clean_sheets"], null)), pctText(pick(a, ["conceded.clean_sheets", "clean_sheets"], null))]]))}${panel("Leitura", "Resumo", note("Linhas de gols precisam combinar volume ofensivo com fragilidade defensiva. Quando os dois sinais aparecem juntos, o mercado tende a ficar mais claro."))}</div>`
    );
  }

  function renderEscanteiosSports() {
    const prepared = ensurePrivateData(previous.escanteios, "_escanteiosData", "Aba Escanteios", "Buscando escanteios totais, a favor e contra.", "_escanteiosError");
    if (prepared.html) return prepared.html;
    const data = prepared.privateData;
    const h = data.home || {};
    const a = data.away || {};
    const matchAvg = pick(data, ["average.total", "match.avg_total", function() { return ((num(h.avg_total) || 0) + (num(a.avg_total) || 0)) / 2; }], null);
    const hEarned = pick(h, ["earned.avg", "earned_avg", "avg_for"], null);
    const aEarned = pick(a, ["earned.avg", "earned_avg", "avg_for"], null);

    return page(
      quickCard("Escanteios", "Pressao pelos lados e volume territorial", `A media projetada da partida esta em ${valueText(matchAvg)} escanteios. Compare forca a favor, contra e linhas totais antes de decidir.`, [["Total", `${valueText(matchAvg)} por jogo`], [home(), `${valueText(hEarned)} a favor`], [away(), `${valueText(aEarned)} a favor`]]) +
      metricSection("Mercados de escanteios", "Linhas principais", [metricCard("Over 6.5", pctText(pick(data, ["average.over6", "average.over65"], null)), "Media", pick(data, ["average.over6", "average.over65"], null)), metricCard("Over 7.5", pctText(pick(data, ["average.over7", "average.over75"], null)), "Media", pick(data, ["average.over7", "average.over75"], null)), metricCard("Over 8.5", pctText(pick(data, ["average.over8", "average.over85"], null)), "Media", pick(data, ["average.over8", "average.over85"], null)), metricCard("Over 9.5", pctText(pick(data, ["average.over9", "average.over95"], null)), "Media", pick(data, ["average.over9", "average.over95"], null), "risk"), metricCard("Mandante", valueText(hEarned), "Escanteios a favor", (num(hEarned) || 0) * 12), metricCard("Visitante", valueText(aEarned), "Escanteios a favor", (num(aEarned) || 0) * 12)]) +
      `<div class="sa-panels">${panel("Comparativo", "A favor / contra", compareRows([{ label: "Escanteios a favor", home: hEarned, away: aEarned }, { label: "Escanteios contra", home: pick(h, ["against.avg", "against_avg", "avg_against"], null), away: pick(a, ["against.avg", "against_avg", "avg_against"], null) }, { label: "Total no jogo", home: pick(h, ["avg_total", "total.avg"], null), away: pick(a, ["avg_total", "total.avg"], null) }]))}${panel("Linhas por equipe", "Probabilidades", table(["Linha", home(), away()], [["Over 2.5 a favor", pctText(pick(h, ["over25_for", "earned.over25"], null)), pctText(pick(a, ["over25_for", "earned.over25"], null))], ["Over 3.5 a favor", pctText(pick(h, ["over35_for", "earned.over35"], null)), pctText(pick(a, ["over35_for", "earned.over35"], null))], ["Over 4.5 contra", pctText(pick(h, ["over45_against", "against.over45"], null)), pctText(pick(a, ["over45_against", "against.over45"], null))]]))}${panel("Leitura", "Resumo", note("Escanteios ficam melhores quando um time cruza bastante e o adversario tambem concede volume. A linha total precisa refletir os dois lados, nao so um ataque forte."))}</div>`
    );
  }

  function renderCartoesSports() {
    const prepared = ensurePrivateData(previous.cartoes, "_cartoesData", "Aba Cartoes", "Buscando cartoes por jogo, por equipe e por tempo.", "_cartoesError");
    if (prepared.html) return prepared.html;
    const data = prepared.privateData;
    const h = data.home || {};
    const a = data.away || {};
    const total = pick(data, ["average.total", "match.avg_total", function() { return ((num(h.avg_total) || 0) + (num(a.avg_total) || 0)) / 2; }], null);
    const hFor = pick(h, ["for.avg", "for_avg", "avg_for"], null);
    const aFor = pick(a, ["for.avg", "for_avg", "avg_for"], null);

    return page(
      quickCard("Cartoes", "Ritmo disciplinar da partida", `Media projetada de ${valueText(total)} cartoes. Veja quem recebe mais, quem sofre mais faltas e como os cartoes se distribuem no jogo.`, [["Total", `${valueText(total)} por jogo`], [home(), `${valueText(hFor)} recebidos`], [away(), `${valueText(aFor)} recebidos`]]) +
      metricSection("Mercados de cartoes", "Linhas principais", [metricCard("Over 2.5", pctText(pick(data, ["average.over25", "match.over25"], null)), "Cartoes totais", pick(data, ["average.over25", "match.over25"], null)), metricCard("Over 3.5", pctText(pick(data, ["average.over35", "match.over35"], null)), "Cartoes totais", pick(data, ["average.over35", "match.over35"], null)), metricCard("Over 4.5", pctText(pick(data, ["average.over45", "match.over45"], null)), "Cartoes totais", pick(data, ["average.over45", "match.over45"], null), "risk"), metricCard("Mandante", valueText(hFor), "Cartoes recebidos", (num(hFor) || 0) * 35), metricCard("Visitante", valueText(aFor), "Cartoes recebidos", (num(aFor) || 0) * 35), metricCard("2o tempo", valueText(pick(data, ["average.second_half", "match.second_half_avg"], null)), "Cartoes finais", (num(pick(data, ["average.second_half", "match.second_half_avg"], null)) || 0) * 35)]) +
      `<div class="sa-panels">${panel("Comparativo", "Recebidos e contra", compareRows([{ label: "Cartoes recebidos", home: hFor, away: aFor }, { label: "Cartoes contra", home: pick(h, ["against.avg", "against_avg", "avg_against"], null), away: pick(a, ["against.avg", "against_avg", "avg_against"], null) }, { label: "1o tempo", home: pick(h, ["first_half.avg", "first_half_for_avg"], null), away: pick(a, ["first_half.avg", "first_half_for_avg"], null) }]))}${panel("Linhas de equipe", "Probabilidades", table(["Linha", home(), away()], [["Over 0.5 a favor", pctText(pick(h, ["for.over05", "over05_for"], null)), pctText(pick(a, ["for.over05", "over05_for"], null))], ["Over 1.5 a favor", pctText(pick(h, ["for.over15", "over15_for"], null)), pctText(pick(a, ["for.over15", "over15_for"], null))], ["Over 2.5 contra", pctText(pick(h, ["against.over25", "over25_against"], null)), pctText(pick(a, ["against.over25", "over25_against"], null))]]))}${panel("Leitura", "Resumo", note("Cartoes dependem muito do arbitro, rivalidade, placar e estilo de pressao. Use a media como base e confirme escala de risco antes da entrada."))}</div>`
    );
  }

  function renderChutesSports() {
    const prepared = ensurePrivateData(previous.chutes, "_chutesData", "Aba Chutes", "Buscando chutes, impedimentos, faltas e posse.", "_chutesError");
    if (prepared.html) return prepared.html;
    const data = prepared.privateData;
    const h = data.home || {};
    const a = data.away || {};
    const hShots = pick(h, ["shots.avg", "shots_avg", "shots_per_match"], null);
    const aShots = pick(a, ["shots.avg", "shots_avg", "shots_per_match"], null);

    return page(
      quickCard("Chutes e pressao", "Volume ofensivo alem dos gols", "Compare volume total, chutes no alvo e taxa de conversao para entender se o placar esperado tem sustentacao.", [[home(), `${valueText(hShots)} chutes`], [away(), `${valueText(aShots)} chutes`], ["No alvo", `${valueText(pick(data, ["average.shots_on_target", "match.shots_on_target"], null))} media`]]) +
      metricSection("Indicadores de finalizacao", "Ataque e eficiencia", [metricCard("Chutes mandante", valueText(hShots), "Por jogo", (num(hShots) || 0) * 6), metricCard("Chutes visitante", valueText(aShots), "Por jogo", (num(aShots) || 0) * 6), metricCard("No alvo", valueText(pick(data, ["average.shots_on_target", "match.shots_on_target"], null)), "Media total", (num(pick(data, ["average.shots_on_target", "match.shots_on_target"], null)) || 0) * 12), metricCard("Conversao", pctText(pick(data, ["average.conversion_rate", "match.conversion_rate"], null)), "Gols por chute", pick(data, ["average.conversion_rate", "match.conversion_rate"], null), "risk"), metricCard("Impedimentos", valueText(pick(data, ["average.offsides", "match.offsides"], null)), "Media total", (num(pick(data, ["average.offsides", "match.offsides"], null)) || 0) * 20), metricCard("Posse media", pctText(pick(data, ["average.possession", "match.possession"], null)), "Controle", pick(data, ["average.possession", "match.possession"], null))]) +
      `<div class="sa-panels">${panel("Comparativo", "Volume por equipe", compareRows([{ label: "Chutes", home: hShots, away: aShots }, { label: "No alvo", home: pick(h, ["shots_on_target.avg", "shots_on_target_avg", "sot_avg"], null), away: pick(a, ["shots_on_target.avg", "shots_on_target_avg", "sot_avg"], null) }, { label: "Faltas", home: pick(h, ["fouls.avg", "fouls_avg"], null), away: pick(a, ["fouls.avg", "fouls_avg"], null) }]))}${panel("Linhas de chutes", "Probabilidades", table(["Linha", home(), away()], [["Time over 10.5", pctText(pick(h, ["shots.over105", "over105"], null)), pctText(pick(a, ["shots.over105", "over105"], null))], ["Time over 12.5", pctText(pick(h, ["shots.over125", "over125"], null)), pctText(pick(a, ["shots.over125", "over125"], null))], ["No alvo over 4.5", pctText(pick(h, ["shots_on_target.over45", "sot_over45"], null)), pctText(pick(a, ["shots_on_target.over45", "sot_over45"], null))]]))}${panel("Leitura", "Resumo", note("Chutes ajudam a diferenciar dominio real de resultado ocasional. Alto volume com poucos gols pode indicar regressao positiva, mas confira qualidade das finalizacoes."))}</div>`
    );
  }

  function renderIntervaloSports() {
    const prepared = ensurePrivateData(previous.intervalo, "_intervaloData", "Aba Intervalo", "Buscando forma de 1o e 2o tempo.", "_intervaloError");
    if (prepared.html) return prepared.html;
    const data = prepared.privateData;
    const h = data.home || {};
    const a = data.away || {};

    return page(
      quickCard("Intervalo", "Como os times entram e voltam do vestiario", `${home()} tem PPG HT de ${valueText(h.ht_ppg)} e ${away()} tem ${valueText(a.ht_ppg)}. Use para mercados de 1o tempo, 2o tempo e empate HT.`, [[home(), `${valueText(h.ht_ppg)} HT PPG`], [away(), `${valueText(a.ht_ppg)} HT PPG`], ["Empate HT", pctText(pick(data, ["average.draw_1h", "match.draw_1h"], null))]]) +
      metricSection("1o / 2o tempo", "WDL e ritmo", [metricCard("Vence 1o tempo", pctText(pick(h, ["win_1h", "first_half.win"], null)), home(), pick(h, ["win_1h", "first_half.win"], null)), metricCard("Vence 2o tempo", pctText(pick(h, ["win_2h", "second_half.win"], null)), home(), pick(h, ["win_2h", "second_half.win"], null)), metricCard("Visitante 1oT", pctText(pick(a, ["win_1h", "first_half.win"], null)), away(), pick(a, ["win_1h", "first_half.win"], null)), metricCard("Visitante 2oT", pctText(pick(a, ["win_2h", "second_half.win"], null)), away(), pick(a, ["win_2h", "second_half.win"], null)), metricCard("Empate 1oT", pctText(pick(data, ["average.draw_1h", "match.draw_1h"], null)), "Mercado HT", pick(data, ["average.draw_1h", "match.draw_1h"], null)), metricCard("Empate 2oT", pctText(pick(data, ["average.draw_2h", "match.draw_2h"], null)), "Mercado 2T", pick(data, ["average.draw_2h", "match.draw_2h"], null))]) +
      `<div class="sa-panels">${panel("Comparativo HT", "Forma de intervalo", compareRows([{ label: "HT PPG", home: h.ht_ppg, away: a.ht_ppg }, { label: "Vitoria 1o tempo", home: pick(h, ["win_1h", "first_half.win"], null), away: pick(a, ["win_1h", "first_half.win"], null), homeText: pctText(pick(h, ["win_1h", "first_half.win"], null)), awayText: pctText(pick(a, ["win_1h", "first_half.win"], null)) }, { label: "Derrota 1o tempo", home: pick(h, ["loss_1h", "first_half.loss"], null), away: pick(a, ["loss_1h", "first_half.loss"], null), homeText: pctText(pick(h, ["loss_1h", "first_half.loss"], null)), awayText: pctText(pick(a, ["loss_1h", "first_half.loss"], null)) }]))}${panel("Tabela WDL", "Percentuais", table(["Mercado", home(), away()], [["Vence 1o tempo", pctText(pick(h, ["win_1h", "first_half.win"], null)), pctText(pick(a, ["win_1h", "first_half.win"], null))], ["Empata 1o tempo", pctText(pick(h, ["draw_1h", "first_half.draw"], null)), pctText(pick(a, ["draw_1h", "first_half.draw"], null))], ["Perde 2o tempo", pctText(pick(h, ["loss_2h", "second_half.loss"], null)), pctText(pick(a, ["loss_2h", "second_half.loss"], null))]]))}${panel("Leitura", "Resumo", note("A aba Intervalo serve para mercados HT/FT, gols por tempo e protecao de entradas ao vivo. O comportamento do 1o tempo costuma ser bem diferente do jogo inteiro."))}</div>`
    );
  }

  function playerRows(players, side) {
    if (!players || !players.length) return `<div class="sa-empty">Dados de jogadores indisponiveis no retorno atual da API.</div>`;
    const max = Math.max.apply(null, players.map(function(player) { return num(player.value) || 0; })) || 1;
    return players.slice(0, 6).map(function(player) {
      const value = num(player.value) || 0;
      const width = Math.max(12, Math.round((value / max) * 100));
      return `<div class="sa-player-row"><span class="sa-player-fill" style="background:${side === "home" ? "#d8efff" : "#dff5e7"};width:${width}%;height:28px;border-radius:8px"></span><p>${esc(player.name)}</p><strong>${esc(valueText(player.value, 2))}</strong></div>`;
    }).join("");
  }

  function teamCard(title, side, players) {
    return `<article class="sa-team-card"><header class="sa-team-title">${logo(side)}<h3>${esc(title)}</h3></header><div class="sa-panel-body">${playerRows(players, side)}</div></article>`;
  }

  function renderJogadoresSports() {
    const prepared = ensurePrivateData(previous.jogadores, "_jogadoresData", "Aba Jogadores", "Buscando artilheiros e jogadores com cartoes.", "_jogadoresError");
    if (prepared.html) return prepared.html;
    const data = prepared.privateData;
    const h = data.home || {};
    const a = data.away || {};

    return page(
      quickCard("Jogadores", "Quem pode decidir a partida?", "Ranking de artilheiros, cartoes recebidos e cartoes por 90 minutos usando os dados atuais da liga.", [["Artilheiro mandante", h.scorers?.[0]?.name || "-"], ["Artilheiro visitante", a.scorers?.[0]?.name || "-"], ["Risco de cartao", h.cards?.[0]?.name || a.cards?.[0]?.name || "-"]]) +
      panel("Quais jogadores podem marcar?", "Artilheiros", `<div class="sa-split">${teamCard(`Artilheiros - ${home()}`, "home", h.scorers)}${teamCard(`Artilheiros - ${away()}`, "away", a.scorers)}</div>`) +
      panel("Quem pode receber cartao?", "Cartoes recebidos", `<div class="sa-split">${teamCard(`Cartoes - ${home()}`, "home", h.cards)}${teamCard(`Cartoes - ${away()}`, "away", a.cards)}</div>`) +
      panel("Cartoes por 90 minutos", "Media individual", `<div class="sa-split">${teamCard(`Cartoes / 90 - ${home()}`, "home", h.cards_per_90)}${teamCard(`Cartoes / 90 - ${away()}`, "away", a.cards_per_90)}</div>`)
    );
  }

  function renderIASports() {
    const prepared = ensurePrivateData(previous.ia, "_iaData", "IA / Tendencias", "Buscando tendencias recentes por equipe.", "_iaError");
    const data = prepared.data || currentData();
    if (prepared.html && !data?._iaData) return prepared.html;
    const info = baseInsights(data || {});
    const iaData = data?._iaData || {};
    const homeRows = iaData.home?.all || [];
    const awayRows = iaData.away?.all || [];

    return page(
      quickCard("IA / Tendencias", "Resumo para todos os niveis", "A leitura combina forma recente, gols, BTTS, cantos e contexto de mercado. Comece pelo resumo e aprofunde nas abas especificas.", [["Over 1.5", pctText(info.over15)], ["Over 2.5", pctText(info.over25)], ["BTTS", pctText(info.btts)]]) +
      `<div class="sa-panels">${panel(`Tendencias - ${home()}`, "Mandante", [trendRow(`${home()} tem ${homeRows.length || 0} jogos recentes mapeados no retorno da API.`, `${homeRows.length || 0} jogos`, "up"), trendRow(`Mercado de gols para o jogo: Over 1.5 em ${pctText(info.over15)}.`, pctText(info.over15), "up"), trendRow(`BTTS aparece em ${pctText(info.btts)} nos dados da partida.`, pctText(info.btts), percentWidth(info.btts) >= 45 ? "up" : "down")].join(""))}${panel(`Tendencias - ${away()}`, "Visitante", [trendRow(`${away()} tem ${awayRows.length || 0} jogos recentes mapeados no retorno da API.`, `${awayRows.length || 0} jogos`, "up"), trendRow(`Escanteios projetados: ${valueText(info.corners)} de media.`, valueText(info.corners), "up"), trendRow(`Linha alta de gols exige cuidado quando Over 2.5 fica em ${pctText(info.over25)}.`, pctText(info.over25), percentWidth(info.over25) >= 45 ? "up" : "down")].join(""))}${panel("Resumo da IA", "Leitura operacional", note(`${home()} x ${away()}: partida com sinal principal em Mais de 1.5 (${pctText(info.over15)}), Over 2.5 em ${pctText(info.over25)} e Ambas Marcam em ${pctText(info.btts)}. Para iniciantes, priorize mercados com maior repeticao. Para intermediarios e avancados, compare odd atual, volume de chutes, cantos e confirmacao das escalacoes.`))}</div>`
    );
  }

  if (typeof renderCompletas === "function") renderCompletas = renderCompletasSports;
  if (typeof renderGols === "function") renderGols = renderGolsSports;
  if (typeof renderEscanteios === "function") renderEscanteios = renderEscanteiosSports;
  if (typeof renderCartoes === "function") renderCartoes = renderCartoesSports;
  if (typeof renderChutes === "function") renderChutes = renderChutesSports;
  if (typeof renderIntervalo === "function") renderIntervalo = renderIntervaloSports;
  if (typeof renderJogadores === "function") renderJogadores = renderJogadoresSports;
  if (typeof renderIA === "function") renderIA = renderIASports;
})();
