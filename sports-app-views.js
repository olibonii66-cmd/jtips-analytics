(function() {
  function data() { return selectedMatch ? selectedMatch.complete : null; }
  function e(value) { return typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? ""); }
  function has(value) { return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1"; }
  function n(value) {
    if (!has(value)) return null;
    const parsed = Number(String(value).replace("%", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function val(value, fallback) {
    if (typeof window.val === "function") return window.val(value);
    if (!has(value)) return fallback || "-";
    const parsed = n(value);
    if (parsed === null) return String(value);
    return parsed % 1 === 0 ? String(parsed) : String(Number(parsed.toFixed(2)));
  }
  function pct(value) {
    if (typeof window.pct === "function") return window.pct(value);
    const parsed = n(value);
    if (parsed === null) return "-";
    return `${Math.round(parsed <= 1 ? parsed * 100 : parsed)}%`;
  }
  function odd(value) {
    if (typeof window.fmtOdd === "function") return window.fmtOdd(value);
    const parsed = n(value);
    return parsed && parsed > 0 ? parsed.toFixed(2) : "-";
  }
  function width(value) {
    const parsed = n(value);
    if (parsed === null) return "45%";
    const clean = parsed <= 1 ? parsed * 100 : parsed;
    return `${Math.max(8, Math.min(100, Math.round(clean)))}%`;
  }
  function logo(side) {
    const src = side === "home" ? data()?.teams?.home?.image || selectedMatch?.homeLogo : data()?.teams?.away?.image || selectedMatch?.awayLogo;
    const name = side === "home" ? homeName() : awayName();
    if (src) return `<img src="${e(src)}" alt="${e(name)}">`;
    return `<span>${e(String(name).slice(0, 2).toUpperCase())}</span>`;
  }
  function loading() {
    return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : `<article class="card"><h2>Carregando dados...</h2></article>`;
  }
  function titleFor(tab) {
    const map = { completas: "Resumo", gols: "Gols", escanteios: "Escanteios", cartoes: "Cartões", chutes: "Chutes", intervalo: "Intervalo", jogadores: "Jogadores", ia: "IA / Tendências" };
    return map[tab] || "Análise";
  }
  function quickCard(title, verdict, text, chips) {
    return `
      <section class="sa-quick-card">
        <div>
          <span class="sa-eyebrow">Leitura rápida da IA</span>
          <h2>${e(verdict)}</h2>
          <p>${e(text)}</p>
        </div>
        <div class="sa-chip-grid">
          ${chips.map(function(chip) {
            return `<article class="sa-chip"><span>${e(chip.label)}</span><strong>${e(chip.value)}</strong></article>`;
          }).join("")}
        </div>
      </section>
    `;
  }
  function section(title, subtitle, body) {
    return `
      <section class="sa-section">
        <header class="sa-section-header"><h3>${e(title)}</h3>${subtitle ? `<small>${e(subtitle)}</small>` : ""}</header>
        ${body}
      </section>
    `;
  }
  function metricCards(cards) {
    return `<div class="sa-card-grid">${cards.map(function(card) {
      return `
        <article class="sa-metric-card">
          <div class="sa-metric-top"><span>${e(card.label)}</span><b class="sa-info-dot">?</b></div>
          <strong>${e(card.value)}</strong>
          <small>${e(card.small || "")}</small>
          <div class="sa-progress ${card.risk ? "risk" : ""}"><i style="--w:${width(card.percent || card.value)}"></i></div>
        </article>
      `;
    }).join("")}</div>`;
  }
  function trendRows(rows) {
    return `<div class="sa-panel-body">${rows.map(function(row) {
      return `<div class="sa-trend-row ${row.down ? "down" : ""}"><span>${row.down ? "↓" : "↑"}</span><p>${e(row.text)}</p><strong>${e(row.value || "")}</strong></div>`;
    }).join("")}</div>`;
  }
  function compareRows(rows) {
    return `<div class="sa-panel-body sa-bars">${rows.map(function(row) {
      const home = n(row.home) || 0;
      const away = n(row.away) || 0;
      const max = Math.max(home, away, 1);
      return `
        <div class="sa-compare-row">
          <div class="sa-compare-label"><span>${e(row.label)}</span><strong>${e(val(row.home))} x ${e(val(row.away))}</strong></div>
          <div class="sa-bar-pair">
            <div class="sa-bar home"><i style="--w:${Math.max(8, Math.round((home / max) * 100))}%">${e(val(row.home))}</i></div>
            <div class="sa-bar away"><i style="--w:${Math.max(8, Math.round((away / max) * 100))}%">${e(val(row.away))}</i></div>
          </div>
        </div>
      `;
    }).join("")}</div>`;
  }
  function note(text) { return `<div class="sa-panel-body"><div class="sa-note">${text}</div></div>`; }
  function baseMetrics(d) {
    return [
      { label: "Over 2.5", value: pct(d.potentials?.goals?.over25), small: "Probabilidade pré-jogo", percent: d.potentials?.goals?.over25 },
      { label: "BTTS", value: pct(d.potentials?.btts?.full_time), small: "Ambas marcam", percent: d.potentials?.btts?.full_time },
      { label: "Escanteios", value: val(d.corners?.potential?.total ?? d.corners?.full_time?.total), small: "Média/potencial", percent: 64 },
      { label: "Cartões", value: val(d.cards?.potential?.total ?? d.cards?.full_time?.total), small: "Tendência disciplinar", percent: 48, risk: true },
      { label: "xG", value: val(d.xg?.prematch?.total ?? d.xg?.actual?.total), small: "Total estimado", percent: 55 },
      { label: "H2H", value: val(d.h2h?.matches || d.diagnostics?.h2h?.count || "-"), small: "Confrontos mapeados", percent: 38 }
    ];
  }
  function technicalRows(d) {
    return [
      { label: "xG", home: d.xg?.prematch?.home ?? d.xg?.actual?.home, away: d.xg?.prematch?.away ?? d.xg?.actual?.away },
      { label: "Finalizações", home: d.shots?.full_time?.home_total, away: d.shots?.full_time?.away_total },
      { label: "No alvo", home: d.shots?.full_time?.home_on_target, away: d.shots?.full_time?.away_on_target },
      { label: "Escanteios", home: d.corners?.full_time?.home, away: d.corners?.full_time?.away },
      { label: "Cartões", home: d.cards?.full_time?.home_total, away: d.cards?.full_time?.away_total },
      { label: "Posse", home: d.shots?.possession?.home, away: d.shots?.possession?.away }
    ];
  }
  function formRows(d) {
    const homePpg = d.teams?.home?.ppg || d.teams?.home?.pre_match_ppg || "-";
    const awayPpg = d.teams?.away?.ppg || d.teams?.away?.pre_match_ppg || "-";
    return [
      { text: `${homeName()} chega com melhor recorte de mandante`, value: `PPG ${val(homePpg)}` },
      { text: `${awayName()} precisa confirmar produção fora`, value: `PPG ${val(awayPpg)}`, down: n(awayPpg) < n(homePpg) },
      { text: `Mercado de gols pede validação pelo Over 1.5`, value: pct(d.potentials?.goals?.over15) },
      { text: `BTTS depende do visitante criar chances claras`, value: pct(d.potentials?.btts?.full_time), down: n(d.potentials?.btts?.full_time) < 45 }
    ];
  }
  function dashboard(tab, opts) {
    const d = data();
    if (!d) return loading();
    return `
      <div class="sa-page">
        ${quickCard(opts.title || titleFor(tab), opts.verdict, opts.text, opts.chips)}
        ${section("Contexto para validar", "camada intermediária", metricCards(opts.metrics || baseMetrics(d)))}
        <div class="sa-panels">
          ${section("Forma recente", homeName() + " x " + awayName(), trendRows(opts.trends || formRows(d)))}
          ${section(opts.compareTitle || "Comparativo técnico", "barras por equipe", compareRows(opts.rows || technicalRows(d)))}
          ${section(opts.noteTitle || "Resumo GPT-5", "leitura assistida", note(opts.note))}
        </div>
      </div>
    `;
  }
  function renderCompletasView() {
    const d = data(); if (!d) return loading();
    return dashboard("completas", {
      verdict: n(d.potentials?.goals?.over25) < 45 ? "Tendência de jogo controlado" : "Tendência de jogo com gols",
      text: `${homeName()} x ${awayName()} pede leitura por camadas: primeiro risco, depois mercado e por fim estatísticas avançadas. O foco é transformar os números em decisão simples sem esconder os dados profundos.`,
      chips: [
        { label: "Mercado observado", value: n(d.potentials?.goals?.over15) >= 50 ? "Mais de 1.5 gols" : "Under 3.5 gols" },
        { label: "Confiança", value: n(d.potentials?.goals?.over25) >= 55 ? "Média-alta" : "Moderada" },
        { label: "Risco", value: n(d.potentials?.btts?.full_time) >= 55 ? "BTTS ativo" : "BTTS com cautela" }
      ],
      note: `<strong>Leitura:</strong> ${homeName()} tem vantagem contextual, mas a entrada ideal depende do preço. Over 1.5, BTTS e escanteios devem ser validados junto da escalação e do ritmo recente.`
    });
  }
  function renderGolsView() {
    const d = data(); if (!d) return loading();
    return dashboard("gols", {
      verdict: n(d.potentials?.goals?.over25) >= 50 ? "Gols em bom radar" : "Gols com linha conservadora",
      text: "A aba Gols separa leitura simples de mercado e comparação técnica para quem quer validar Over, BTTS e placar provável.",
      chips: [
        { label: "Over 1.5", value: pct(d.potentials?.goals?.over15) },
        { label: "Over 2.5", value: pct(d.potentials?.goals?.over25) },
        { label: "BTTS", value: pct(d.potentials?.btts?.full_time) }
      ],
      metrics: [
        { label: "Over 0.5", value: pct(d.potentials?.goals?.over05), small: "ao menos 1 gol", percent: d.potentials?.goals?.over05 },
        { label: "Over 1.5", value: pct(d.potentials?.goals?.over15), small: "linha base", percent: d.potentials?.goals?.over15 },
        { label: "Over 2.5", value: pct(d.potentials?.goals?.over25), small: "linha principal", percent: d.potentials?.goals?.over25, risk: n(d.potentials?.goals?.over25) < 45 },
        { label: "BTTS", value: pct(d.potentials?.btts?.full_time), small: "ambas marcam", percent: d.potentials?.btts?.full_time },
        { label: "xG Total", value: val(d.xg?.prematch?.total ?? d.xg?.actual?.total), small: "esperado", percent: 55 },
        { label: "Gols/Jogo", value: val(d.potentials?.goals?.avg), small: "média estimada", percent: 50 }
      ],
      rows: [
        { label: "xG", home: d.xg?.prematch?.home ?? d.xg?.actual?.home, away: d.xg?.prematch?.away ?? d.xg?.actual?.away },
        { label: "Gols FT", home: d.goals?.full_time?.home, away: d.goals?.full_time?.away },
        { label: "Gols 1T", home: d.goals?.first_half?.home, away: d.goals?.first_half?.away },
        { label: "Gols 2T", home: d.goals?.second_half?.home, away: d.goals?.second_half?.away },
        { label: "Chutes", home: d.shots?.full_time?.home_total, away: d.shots?.full_time?.away_total },
        { label: "No alvo", home: d.shots?.full_time?.home_on_target, away: d.shots?.full_time?.away_on_target }
      ],
      note: `<strong>Leitura de gols:</strong> se o Over 1.5 estiver forte e o BTTS abaixo da média, o caminho pode ser gols totais em vez de depender dos dois times marcando.`
    });
  }
  function renderEscanteiosView() {
    const d = data(); if (!d) return loading();
    return dashboard("escanteios", {
      verdict: "Ritmo de escanteios em observação",
      text: "Escanteios agora ficam em leitura de app esportivo: média principal, volume por equipe e linha de mercado mais clara.",
      chips: [
        { label: "Média", value: val(d.corners?.potential?.total ?? d.corners?.full_time?.total) },
        { label: homeName(), value: val(d.corners?.full_time?.home) },
        { label: awayName(), value: val(d.corners?.full_time?.away) }
      ],
      metrics: [
        { label: "Total", value: val(d.corners?.full_time?.total), small: "na partida", percent: 65 },
        { label: "Potencial", value: val(d.corners?.potential?.total), small: "pré-jogo", percent: 62 },
        { label: "Over 8.5", value: pct(d.potentials?.corners?.over85), small: "linha comum", percent: d.potentials?.corners?.over85 },
        { label: "Over 9.5", value: pct(d.potentials?.corners?.over95), small: "linha média", percent: d.potentials?.corners?.over95, risk: n(d.potentials?.corners?.over95) < 45 },
        { label: "1º tempo", value: val(d.corners?.first_half?.total), small: "escanteios HT", percent: 40 },
        { label: "2º tempo", value: val(d.corners?.second_half?.total), small: "escanteios 2T", percent: 50 }
      ],
      rows: [
        { label: "Escanteios FT", home: d.corners?.full_time?.home, away: d.corners?.full_time?.away },
        { label: "Escanteios 1T", home: d.corners?.first_half?.home, away: d.corners?.first_half?.away },
        { label: "Escanteios 2T", home: d.corners?.second_half?.home, away: d.corners?.second_half?.away },
        { label: "0-10 min", home: d.corners?.timings?.home_0_10, away: d.corners?.timings?.away_0_10 }
      ],
      note: `<strong>Leitura de escanteios:</strong> a melhor linha tende a ser aquela perto da média da partida. Se o potencial estiver acima de 8, linhas 7.5/8.5 ficam mais naturais.`
    });
  }
  function renderCartoesView() {
    const d = data(); if (!d) return loading();
    return dashboard("cartoes", {
      verdict: "Disciplina e risco de cartões",
      text: "Cartões são apresentados por risco, média e distribuição por equipe, mantendo leitura simples para iniciantes e comparação para avançados.",
      chips: [
        { label: "Total", value: val(d.cards?.full_time?.total) },
        { label: homeName(), value: val(d.cards?.full_time?.home_total) },
        { label: awayName(), value: val(d.cards?.full_time?.away_total) }
      ],
      metrics: [
        { label: "Total", value: val(d.cards?.full_time?.total), small: "cartões FT", percent: 55, risk: true },
        { label: "Potencial", value: val(d.cards?.potential?.total), small: "pré-jogo", percent: 50, risk: true },
        { label: "Amarelos Casa", value: val(d.cards?.full_time?.home_yellow), small: homeName(), percent: 45 },
        { label: "Amarelos Fora", value: val(d.cards?.full_time?.away_yellow), small: awayName(), percent: 45 },
        { label: "1º tempo", value: val(d.cards?.first_half?.total), small: "cartões HT", percent: 35 },
        { label: "2º tempo", value: val(d.cards?.second_half?.total), small: "cartões 2T", percent: 45 }
      ],
      rows: [
        { label: "Cartões FT", home: d.cards?.full_time?.home_total, away: d.cards?.full_time?.away_total },
        { label: "Amarelos", home: d.cards?.full_time?.home_yellow, away: d.cards?.full_time?.away_yellow },
        { label: "Vermelhos", home: d.cards?.full_time?.home_red, away: d.cards?.full_time?.away_red },
        { label: "Cartões 1T", home: d.cards?.first_half?.home, away: d.cards?.first_half?.away },
        { label: "Cartões 2T", home: d.cards?.second_half?.home, away: d.cards?.second_half?.away }
      ],
      note: `<strong>Leitura de cartões:</strong> use a linha de cartões junto com árbitro, rivalidade e estilo de faltas. Cartões isolados têm volatilidade maior.`
    });
  }
  function renderChutesView() {
    const d = data(); if (!d) return loading();
    return dashboard("chutes", {
      verdict: "Volume ofensivo e pressão",
      text: "Chutes, posse e ataques ajudam a validar mercados de gols sem depender apenas do placar histórico.",
      chips: [
        { label: "Chutes", value: val(d.shots?.full_time?.total) },
        { label: "No alvo", value: val(d.shots?.full_time?.total_on_target) },
        { label: "Posse", value: `${pct(d.shots?.possession?.home)} / ${pct(d.shots?.possession?.away)}` }
      ],
      metrics: [
        { label: "Chutes", value: val(d.shots?.full_time?.total), small: "totais", percent: 62 },
        { label: "No alvo", value: val(d.shots?.full_time?.total_on_target), small: "qualidade", percent: 52 },
        { label: "Fora", value: val(d.shots?.full_time?.total_off_target), small: "volume sem precisão", percent: 48, risk: true },
        { label: "Ataques", value: val((n(d.shots?.attacks?.home_attacks) || 0) + (n(d.shots?.attacks?.away_attacks) || 0)), small: "totais", percent: 60 },
        { label: "Perigosos", value: val((n(d.shots?.attacks?.home_dangerous) || 0) + (n(d.shots?.attacks?.away_dangerous) || 0)), small: "pressão", percent: 56 },
        { label: "Posse casa", value: pct(d.shots?.possession?.home), small: homeName(), percent: d.shots?.possession?.home }
      ],
      rows: technicalRows(d),
      note: `<strong>Leitura de chutes:</strong> quando chutes e xG caminham juntos, a leitura de gols ganha força. Se há muito chute e pouco alvo, o risco aumenta.`
    });
  }
  function renderIntervaloView() {
    const d = data(); if (!d) return loading();
    return dashboard("intervalo", {
      verdict: "Leitura por tempo de jogo",
      text: "O intervalo mostra se a partida tende a começar forte ou se o mercado fica mais interessante no segundo tempo.",
      chips: [
        { label: "Gols 1T", value: val(d.goals?.first_half?.total) },
        { label: "Gols 2T", value: val(d.goals?.second_half?.total) },
        { label: "HT", value: `${val(d.goals?.first_half?.home)} x ${val(d.goals?.first_half?.away)}` }
      ],
      metrics: [
        { label: "Gols 1T", value: val(d.goals?.first_half?.total), small: "intervalo", percent: 42 },
        { label: "Gols 2T", value: val(d.goals?.second_half?.total), small: "etapa final", percent: 50 },
        { label: "Corners 1T", value: val(d.corners?.first_half?.total), small: "pressão inicial", percent: 45 },
        { label: "Corners 2T", value: val(d.corners?.second_half?.total), small: "pressão final", percent: 52 },
        { label: "Cartões 1T", value: val(d.cards?.first_half?.total), small: "risco inicial", percent: 30, risk: true },
        { label: "Cartões 2T", value: val(d.cards?.second_half?.total), small: "risco final", percent: 44, risk: true }
      ],
      rows: [
        { label: "Gols 1T", home: d.goals?.first_half?.home, away: d.goals?.first_half?.away },
        { label: "Gols 2T", home: d.goals?.second_half?.home, away: d.goals?.second_half?.away },
        { label: "Corners 1T", home: d.corners?.first_half?.home, away: d.corners?.first_half?.away },
        { label: "Corners 2T", home: d.corners?.second_half?.home, away: d.corners?.second_half?.away },
        { label: "Cartões 1T", home: d.cards?.first_half?.home, away: d.cards?.first_half?.away },
        { label: "Cartões 2T", home: d.cards?.second_half?.home, away: d.cards?.second_half?.away }
      ],
      note: `<strong>Leitura de intervalo:</strong> se o primeiro tempo for fraco historicamente, entradas ao vivo ou linhas de segundo tempo podem ser melhores que pré-jogo.`
    });
  }
  function playerList(players) {
    if (!players || !players.length) return `<div class="sa-empty">Jogadores indisponíveis no retorno atual da API.</div>`;
    return `<div class="sa-panel-body">${players.slice(0, 6).map(function(player) {
      const value = player.value ?? player.goals ?? player.cards ?? player.cards_per_90 ?? "-";
      return `<div class="sa-player-row"><span></span><p>${e(player.name || "Jogador")}</p><strong>${e(val(value))}</strong></div>`;
    }).join("")}</div>`;
  }
  async function loadPlayersIfNeeded(d) {
    if (!d || d._sportsPlayersLoading || d._sportsPlayersLoaded) return;
    const ids = { season: d.ids?.season_id || selectedMatch?.seasonId, home: d.ids?.home_id, away: d.ids?.away_id };
    if (!ids.season || !ids.home || !ids.away) return;
    d._sportsPlayersLoading = true;
    try {
      const params = new URLSearchParams({ season_id: ids.season, home_id: ids.home, away_id: ids.away, home_name: homeName(), away_name: awayName() });
      const response = await fetch(`/api/jogadores?${params.toString()}`);
      const payload = await response.json();
      if (response.ok && payload.ok) {
        d._sportsPlayers = payload.data;
        d._sportsPlayersLoaded = true;
      }
    } finally {
      d._sportsPlayersLoading = false;
      if (document.querySelector(".tab.active")?.dataset.tab === "jogadores") renderTab("jogadores");
    }
  }
  function renderJogadoresView() {
    const d = data(); if (!d) return loading();
    loadPlayersIfNeeded(d);
    const playerData = d._sportsPlayers || d._jogadoresData || null;
    const homeScorers = playerData?.home?.scorers || d.players?.home || [];
    const awayScorers = playerData?.away?.scorers || d.players?.away || [];
    const homeCards = playerData?.home?.cards || d.players?.home || [];
    const awayCards = playerData?.away?.cards || d.players?.away || [];
    return `
      <div class="sa-page">
        ${quickCard("Jogadores", "Destaques individuais", "Veja artilheiros, jogadores com maior risco de cartão e nomes que podem influenciar os mercados principais.", [
          { label: "Mandante", value: homeName() }, { label: "Visitante", value: awayName() }, { label: "Fonte", value: "league-players" }
        ])}
        <div class="sa-split">
          <article class="sa-team-card"><header class="sa-team-title">${logo("home")}<h3>Artilheiros - ${e(homeName())}</h3></header>${playerList(homeScorers)}</article>
          <article class="sa-team-card"><header class="sa-team-title">${logo("away")}<h3>Artilheiros - ${e(awayName())}</h3></header>${playerList(awayScorers)}</article>
          <article class="sa-team-card"><header class="sa-team-title">${logo("home")}<h3>Cartões - ${e(homeName())}</h3></header>${playerList(homeCards)}</article>
          <article class="sa-team-card"><header class="sa-team-title">${logo("away")}<h3>Cartões - ${e(awayName())}</h3></header>${playerList(awayCards)}</article>
        </div>
      </div>
    `;
  }
  function renderIaView() {
    const d = data(); if (!d) return loading();
    return dashboard("ia", {
      verdict: "Decisão guiada por camadas",
      text: "A IA traduz os dados em linguagem simples para iniciantes, valida com contexto para intermediários e mantém profundidade para usuários avançados.",
      chips: [
        { label: "Melhor leitura", value: n(d.potentials?.goals?.over25) < 45 ? "Poucos gols" : "Gols em radar" },
        { label: "Confiança", value: "Moderada" },
        { label: "Atenção", value: "Escalações" }
      ],
      noteTitle: "Resumo da IA",
      note: `<strong>${homeName()} x ${awayName()}:</strong> o modelo prioriza mercado com maior aderência aos dados disponíveis. Valide forma recente, odds e risco antes da entrada. A leitura não garante lucro e deve ser usada com gestão.`
    });
  }
  renderCompletas = renderCompletasView;
  renderGols = renderGolsView;
  renderEscanteios = renderEscanteiosView;
  renderCartoes = renderCartoesView;
  renderChutes = renderChutesView;
  renderIntervalo = renderIntervaloView;
  renderJogadores = renderJogadoresView;
  renderIA = renderIaView;
})();
