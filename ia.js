(function() {
  window.__jtipsIaTeam = window.__jtipsIaTeam || "home";

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
    const selectedRaw = selectedMatch?.raw || {};

    return {
      season: data?.ids?.season_id || selectedMatch?.seasonId || raw.competition_id || raw.league_id || raw.season_id || selectedRaw.competition_id || selectedRaw.league_id || selectedRaw.season_id || "",
      match: data?.ids?.match_id || selectedMatch?.matchId || raw.id || raw.match_id || selectedRaw.id || selectedRaw.match_id || "",
      home: data?.ids?.home_id || raw.homeID || raw.home_id || raw.team_a_id || selectedRaw.homeID || selectedRaw.home_id || selectedRaw.team_a_id || "",
      away: data?.ids?.away_id || raw.awayID || raw.away_id || raw.team_b_id || selectedRaw.awayID || selectedRaw.away_id || selectedRaw.team_b_id || "",
      date: data?.status?.date_unix || raw.date_unix || selectedRaw.date_unix || ""
    };
  }

  function needsIaData(data) {
    const ids = getIds(data);
    return Boolean(data && ids.season && ids.home && ids.away && !data._iaLoading && !data._iaLoaded && !data._iaError);
  }

  async function loadIaData(data) {
    if (!needsIaData(data)) return;

    const ids = getIds(data);
    data._iaLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: ids.season,
        match_id: ids.match,
        home_id: ids.home,
        away_id: ids.away
      });

      if (ids.date) params.set("date_unix", ids.date);

      const response = await fetch(`/api/completas-form?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Tendências indisponíveis.");
      }

      data._iaData = payload.data;
      data._iaLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.ia = payload.diagnostics || null;
    } catch (error) {
      data._iaError = error.message;
    } finally {
      data._iaLoading = false;
      if (selectedMatch?.complete === data && document.querySelector(".tab.active")?.dataset.tab === "ia") {
        renderTab("ia");
      }
    }
  }

  function number(value) {
    if (!exists(value)) return null;
    const parsed = Number(String(value).replace("%", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function fmtNumber(value, decimals) {
    const parsed = number(value);
    if (parsed === null) return "-";
    return String(Number(parsed.toFixed(decimals ?? 2)));
  }

  function fmtOdd(value) {
    if (typeof window.fmtOdd === "function") return window.fmtOdd(value);
    const parsed = number(value);
    return parsed && parsed > 0 ? parsed.toFixed(2) : "-";
  }

  function percent(value) {
    if (typeof pct === "function") return pct(value);
    const parsed = number(value);
    if (parsed === null) return "-";
    return `${Math.round(parsed <= 1 ? parsed * 100 : parsed)}%`;
  }

  function matchTeamSide(row, teamId, teamName) {
    const homeId = String(row.homeID || row.home_id || row.team_a_id || "");
    const awayId = String(row.awayID || row.away_id || row.team_b_id || "");
    const home = normalize(row.home_name || row.homeName || row.team_a_name || row.home || "");
    const away = normalize(row.away_name || row.awayName || row.team_b_name || row.away || "");
    const name = normalize(teamName);

    if (teamId && homeId === String(teamId)) return "home";
    if (teamId && awayId === String(teamId)) return "away";
    if (name && home === name) return "home";
    if (name && away === name) return "away";
    return "home";
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function goals(row, side) {
    const home = number(row.homeGoalCount ?? row.home_goals ?? row.team_a_goals);
    const away = number(row.awayGoalCount ?? row.away_goals ?? row.team_b_goals);
    return {
      for: side === "home" ? home : away,
      against: side === "home" ? away : home,
      total: (home ?? 0) + (away ?? 0),
      known: home !== null && away !== null
    };
  }

  function summarizeRows(rows, teamId, teamName) {
    const normalized = (rows || []).map(function(row) {
      const side = matchTeamSide(row, teamId, teamName);
      const g = goals(row, side);
      const points = !g.known ? null : g.for > g.against ? 3 : g.for === g.against ? 1 : 0;

      return { row, side, goals: g, points };
    }).filter(function(item) {
      return item.goals.known;
    });

    const count = normalized.length;
    const points = normalized.reduce(function(total, item) { return total + (item.points || 0); }, 0);
    const goalsFor = normalized.reduce(function(total, item) { return total + (item.goals.for || 0); }, 0);
    const goalsAgainst = normalized.reduce(function(total, item) { return total + (item.goals.against || 0); }, 0);
    const btts = normalized.filter(function(item) { return item.goals.for > 0 && item.goals.against > 0; }).length;
    const scored = normalized.filter(function(item) { return item.goals.for > 0; }).length;
    const failed = normalized.filter(function(item) { return item.goals.for === 0; }).length;
    const cleanSheets = normalized.filter(function(item) { return item.goals.against === 0; }).length;
    const over15 = normalized.filter(function(item) { return item.goals.total >= 2; }).length;
    const over25 = normalized.filter(function(item) { return item.goals.total >= 3; }).length;
    const unbeaten = normalized.filter(function(item) { return item.points !== 0; }).length;
    const wins = normalized.filter(function(item) { return item.points === 3; }).length;
    const draws = normalized.filter(function(item) { return item.points === 1; }).length;
    const losses = normalized.filter(function(item) { return item.points === 0; }).length;

    return {
      count,
      points,
      ppg: count ? points / count : null,
      goalsFor,
      goalsAgainst,
      btts,
      scored,
      failed,
      cleanSheets,
      over15,
      over25,
      unbeaten,
      wins,
      draws,
      losses
    };
  }

  function seasonBlankRate(data, side) {
    const rawTeam = side === "home" ? data?.teams?.home?.raw : data?.teams?.away?.raw;
    const failed = number(rawTeam?.failed_to_score_overall ?? rawTeam?.fts_overall ?? rawTeam?.matches_failed_to_score);
    const matches = number(rawTeam?.matches_played ?? rawTeam?.seasonMatchesPlayed_overall ?? rawTeam?.matches_played_overall ?? rawTeam?.matches);

    if (failed === null || !matches) return null;
    return Math.round((failed / matches) * 100);
  }

  function buildTrendItems(teamKey, data) {
    const ids = getIds(data);
    const teamName = teamKey === "home" ? homeName() : awayName();
    const teamId = teamKey === "home" ? ids.home : ids.away;
    const form = data._iaData?.[teamKey] || data._completasForm?.[teamKey] || {};
    const allRows = form.all || [];
    const venueRows = teamKey === "home" ? form.home || [] : form.away || [];
    const all = summarizeRows(allRows, teamId, teamName);
    const venue = summarizeRows(venueRows, teamId, teamName);
    const blankRate = seasonBlankRate(data, teamKey);
    const items = [];

    items.push({
      type: "info",
      text: `Chegando para este jogo, ${teamName} somou ${all.points || 0} pontos nos últimos ${all.count || 0} jogos${venue.count ? `, considerando também seu recorte de ${teamKey === "home" ? "mandante" : "visitante"}` : ""}. A média recente é ${fmtNumber(all.ppg, 2)} ponto(s) por jogo. BTTS apareceu em ${all.btts || 0} desses jogos e o time marcou ${all.goalsFor || 0} gols no período.`
    });

    if (venue.unbeaten >= 3) {
      items.push({ type: "up", text: `${teamName} vem forte no recorte de ${teamKey === "home" ? "casa" : "fora"}, ficando invicto em ${venue.unbeaten} dos últimos ${venue.count} jogos disponíveis.` });
    } else if (venue.losses >= 3) {
      items.push({ type: "down", text: `${teamName} preocupa no recorte de ${teamKey === "home" ? "casa" : "fora"}: perdeu ${venue.losses} dos últimos ${venue.count} jogos disponíveis.` });
    } else {
      items.push({ type: "up", text: `${teamName} tem um recorte recente competitivo, com ${all.wins} vitória(s), ${all.draws} empate(s) e ${all.losses} derrota(s) nos últimos ${all.count} jogos.` });
    }

    if (all.cleanSheets >= 2) {
      items.push({ type: "up", text: `${teamName} protegeu bem a própria meta recentemente: foram ${all.cleanSheets} jogo(s) sem sofrer gol nos últimos ${all.count}.` });
    } else {
      items.push({ type: "down", text: `A defesa de ${teamName} exige atenção: sofreu ${all.goalsAgainst || 0} gol(s) nos últimos ${all.count || 0} jogos analisados.` });
    }

    if (all.over25 >= 2) {
      items.push({ type: "up", text: `Existe espaço para gols aqui: ${all.over25} dos últimos ${all.count} jogos de ${teamName} terminaram com 3 ou mais gols.` });
    } else {
      items.push({ type: "down", text: `O ritmo recente de ${teamName} sugere cautela para linhas altas: só ${all.over25} dos últimos ${all.count} jogos passaram de 2.5 gols.` });
    }

    if (all.failed >= 3) {
      items.push({ type: "down", text: `${teamName} ficou sem marcar em ${all.failed} dos últimos ${all.count} jogos. Isso reduz confiança em mercados de gol do time sem confirmação de escalação.` });
    } else {
      items.push({ type: "up", text: `${teamName} balançou a rede em ${all.scored} dos últimos ${all.count} jogos e chega com produção ofensiva recente.` });
    }

    if (blankRate !== null) {
      items.push({ type: blankRate >= 35 ? "down" : "up", text: `Na temporada, ${teamName} ficou sem marcar em aproximadamente ${blankRate}% dos jogos. Esse dado ajuda a calibrar BTTS e gols do time.` });
    } else {
      items.push({ type: all.btts >= 3 ? "up" : "down", text: `BTTS apareceu em ${all.btts} dos últimos ${all.count} jogos de ${teamName}. Use isso como termômetro para ambos marcam.` });
    }

    return items;
  }

  function icon(type) {
    if (type === "up") return "↑";
    if (type === "down") return "↓";
    return "⌁";
  }

  function renderTrendRows(items) {
    return items.map(function(item) {
      return `
        <div class="ia-trend-row ${item.type}">
          <span>${escape(icon(item.type))}</span>
          <p>${escape(item.text)}</p>
        </div>
      `;
    }).join("");
  }

  function renderTrendCard(data) {
    const selected = window.__jtipsIaTeam === "away" ? "away" : "home";
    const items = buildTrendItems(selected, data);

    return `
      <section class="ia-card ia-trends-card">
        <header class="ia-title">Tendências dos Times</header>
        <div class="ia-team-tabs">
          <button type="button" class="${selected === "home" ? "active" : ""}" onclick="setIaTrendTeam('home')">${escape(homeName())}</button>
          <button type="button" class="${selected === "away" ? "active" : ""}" onclick="setIaTrendTeam('away')">${escape(awayName())}</button>
        </div>
        <div class="ia-trends-list">${renderTrendRows(items)}</div>
      </section>
    `;
  }

  function getLeagueText(data) {
    const raw = rawMatch(data);
    const league = data?.league?.season || raw.league_name || raw.competition_name || raw.season || getLeagueTitle?.() || "liga";
    const week = data?.league?.game_week || raw.game_week || raw.round || raw.roundID || "";
    return week ? `${league}, rodada ${week}` : league;
  }

  function summary(data) {
    const home = homeName();
    const away = awayName();
    const oddsHome = fmtOdd(data.odds?.result?.home);
    const oddsDraw = fmtOdd(data.odds?.result?.draw);
    const oddsAway = fmtOdd(data.odds?.result?.away);
    const homeXg = fmtNumber(data.xg?.prematch?.home ?? data.xg?.actual?.home, 2);
    const awayXg = fmtNumber(data.xg?.prematch?.away ?? data.xg?.actual?.away, 2);
    const totalXg = fmtNumber(data.xg?.prematch?.total ?? data.xg?.actual?.total, 2);
    const over15 = fmtOdd(data.odds?.goals?.over15);
    const over25 = fmtOdd(data.odds?.goals?.over25);
    const bttsYes = fmtOdd(data.odds?.btts?.yes);
    const bttsNo = fmtOdd(data.odds?.btts?.no);
    const cornersAvg = fmtNumber(data.corners?.potential?.total ?? data.corners?.full_time?.total, 2);
    const cornersOver75 = fmtOdd(data.odds?.corners?.over75);
    const cornersOver85 = fmtOdd(data.odds?.corners?.over85);
    const over25Potential = percent(data.potentials?.goals?.over25);
    const bttsPotential = percent(data.potentials?.btts?.full_time);
    const homeOddNumber = number(data.odds?.result?.home);
    const awayOddNumber = number(data.odds?.result?.away);
    const favorite = homeOddNumber && awayOddNumber ? homeOddNumber <= awayOddNumber ? home : away : home;
    const scoreLean = number(data.potentials?.goals?.over25) !== null && number(data.potentials?.goals?.over25) < 45 ? "1-0 ou 2-0" : "2-1 ou 1-1";

    return `
      <section class="ia-card ia-summary-card">
        <header class="ia-summary-title"><span>✺</span> Resumo IA das Estatísticas</header>
        <div class="ia-summary-text">
          <p>${escape(home)} x ${escape(away)}, ${escape(getLeagueText(data))}. O mando favorece ${escape(home)}, mas a leitura segue orientada por preço, xG, gols esperados e forma recente.</p>
          <p>Panorama de odds: ${escape(home)} ${escape(oddsHome)}, empate ${escape(oddsDraw)}, ${escape(away)} ${escape(oddsAway)}. No xG pré-jogo/recorte disponível, ${escape(home)} aparece com ${escape(homeXg)} e ${escape(away)} com ${escape(awayXg)}, total aproximado de ${escape(totalXg)}.</p>
          <p>Expectativa de gols: Over 2.5 está em ${escape(over25Potential)} e BTTS em ${escape(bttsPotential)}. Mercado de gols mostra Over 1.5 em ${escape(over15)} e Over 2.5 em ${escape(over25)}; BTTS Sim ${escape(bttsYes)} e Não ${escape(bttsNo)}.</p>
          <p>Escanteios: média/potencial em ${escape(cornersAvg)}, com Over 7.5 em ${escape(cornersOver75)} e Over 8.5 em ${escape(cornersOver85)} quando a API retorna essas odds.</p>
          <p>Leitura final: leve inclinação para ${escape(favorite)}, com placar provável em torno de ${escape(scoreLean)}. Para perfil conservador, observar mercado de gols baixo e BTTS. Para complemento, escanteios podem ser úteis se o ritmo ofensivo confirmar no pré-jogo.</p>
          <small>* Este resumo é gerado automaticamente com base nos dados disponíveis da FootyStats. O JTIPS não garante lucro nem exatidão absoluta das projeções.</small>
        </div>
      </section>
    `;
  }

  function renderIaView() {
    const data = selectedMatch?.complete;

    if (!data) return typeof renderLoadingFallback === "function" ? renderLoadingFallback() : "";

    loadIaData(data);

    if (!data._iaLoaded && !data._iaError) {
      return `<article class="card"><h2>Carregando IA / Tendências...</h2><p class="small-note">Buscando últimos jogos e cruzando com os dados da partida.</p></article>`;
    }

    return `
      ${data._iaError ? `<article class="card"><h2>IA / Tendências</h2><p class="small-note">${escape(data._iaError)} Abaixo está a leitura com os dados já carregados da partida.</p></article>` : ""}
      ${renderTrendCard(data)}
      ${summary(data)}
    `;
  }

  window.setIaTrendTeam = function(side) {
    window.__jtipsIaTeam = side === "away" ? "away" : "home";
    if (document.querySelector(".tab.active")?.dataset.tab === "ia") {
      renderTab("ia");
    }
  };

  if (typeof renderIA === "function") {
    renderIA = renderIaView;
  }
})();
