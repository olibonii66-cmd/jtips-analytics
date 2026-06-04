(function() {
  function cleanValue(value) {
    if (value === undefined || value === null || value === "" || value === -1 || value === "-1") return null;
    return value;
  }

  function cleanOdd(value) {
    const clean = cleanValue(value);
    if (clean === null || clean === 0 || clean === "0") return null;

    const number = Number(clean);
    return Number.isFinite(number) && number > 0 ? Number(number.toFixed(2)) : null;
  }

  function sumClean(a, b) {
    const first = cleanValue(a);
    const second = cleanValue(b);

    if (first === null && second === null) return null;

    return Number(first || 0) + Number(second || 0);
  }

  function booleanOrValue(value) {
    if (value === true || value === false) return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    return cleanValue(value);
  }

  function getMatchName(raw, side, fallback) {
    if (side === "home") {
      return raw.home_name || raw.homeName || raw.team_a_name || raw.home_team_name || raw.home || fallback;
    }

    return raw.away_name || raw.awayName || raw.team_b_name || raw.away_team_name || raw.away || fallback;
  }

  function buildCompleteFromMatchDetails(raw, baseMatch) {
    const homeId = String(raw.homeID || raw.home_id || raw.team_a_id || baseMatch?.raw?.homeID || "");
    const awayId = String(raw.awayID || raw.away_id || raw.team_b_id || baseMatch?.raw?.awayID || "");
    const homeNameValue = getMatchName(raw, "home", baseMatch?.home || "Mandante");
    const awayNameValue = getMatchName(raw, "away", baseMatch?.away || "Visitante");

    return {
      ids: {
        match_id: raw.id || raw.match_id || baseMatch?.matchId || null,
        season_id: raw.competition_id || raw.league_id || raw.season_id || baseMatch?.seasonId || null,
        home_id: homeId || null,
        away_id: awayId || null,
        referee_id: raw.refereeID || raw.referee_id || null
      },
      status: {
        raw: raw.status || raw.game_status || null,
        normalized: normalizeStatus(raw.status || raw.game_status, raw),
        date_unix: raw.date_unix || null,
        date_iso: raw.date_unix ? new Date(Number(raw.date_unix) * 1000).toISOString() : null
      },
      league: {
        competition_id: raw.competition_id || raw.league_id || raw.season_id || baseMatch?.seasonId || null,
        season: raw.season || null,
        game_week: raw.game_week || null,
        round_id: raw.roundID || raw.round_id || null
      },
      teams: {
        home: {
          id: homeId || null,
          name: homeNameValue,
          image: normalizeImageUrl(raw.home_image || baseMatch?.homeLogo || ""),
          url: raw.home_url || null,
          ppg: cleanValue(raw.home_ppg),
          pre_match_ppg: cleanValue(raw.pre_match_home_ppg),
          overall_pre_match_ppg: cleanValue(raw.pre_match_teamA_overall_ppg),
          table: null,
          raw: raw.home_team || null
        },
        away: {
          id: awayId || null,
          name: awayNameValue,
          image: normalizeImageUrl(raw.away_image || baseMatch?.awayLogo || ""),
          url: raw.away_url || null,
          ppg: cleanValue(raw.away_ppg),
          pre_match_ppg: cleanValue(raw.pre_match_away_ppg),
          overall_pre_match_ppg: cleanValue(raw.pre_match_teamB_overall_ppg),
          table: null,
          raw: raw.away_team || null
        }
      },
      score: {
        home_goals: cleanValue(raw.homeGoalCount),
        away_goals: cleanValue(raw.awayGoalCount),
        total_goals: cleanValue(raw.totalGoalCount || raw.overallGoalCount),
        winner_team_id: cleanValue(raw.winningTeam),
        home_goal_timings: raw.homeGoals_timings || raw.homeGoals || [],
        away_goal_timings: raw.awayGoals_timings || raw.awayGoals || [],
        over05: booleanOrValue(raw.over05),
        over15: booleanOrValue(raw.over15),
        over25: booleanOrValue(raw.over25),
        over35: booleanOrValue(raw.over35),
        over45: booleanOrValue(raw.over45),
        over55: booleanOrValue(raw.over55),
        btts: booleanOrValue(raw.btts)
      },
      goals: {
        full_time: {
          home: cleanValue(raw.homeGoalCount),
          away: cleanValue(raw.awayGoalCount),
          total: cleanValue(raw.totalGoalCount || raw.overallGoalCount)
        },
        first_half: {
          home: cleanValue(raw.ht_goals_team_a),
          away: cleanValue(raw.ht_goals_team_b),
          total: cleanValue(raw.HTGoalCount)
        },
        second_half: {
          home: cleanValue(raw.goals_2hg_team_a),
          away: cleanValue(raw.goals_2hg_team_b),
          total: cleanValue(raw.GoalCount_2hg)
        },
        timings: {
          recorded: cleanValue(raw.goal_timings_recorded),
          disabled: cleanValue(raw.goalTimingDisabled),
          home: raw.homeGoals_timings || raw.homeGoals || [],
          away: raw.awayGoals_timings || raw.awayGoals || []
        }
      },
      xg: {
        actual: {
          home: cleanValue(raw.team_a_xg),
          away: cleanValue(raw.team_b_xg),
          total: cleanValue(raw.total_xg)
        },
        prematch: {
          home: cleanValue(raw.team_a_xg_prematch),
          away: cleanValue(raw.team_b_xg_prematch),
          total: cleanValue(raw.total_xg_prematch)
        }
      },
      corners: {
        full_time: {
          home: cleanValue(raw.team_a_corners),
          away: cleanValue(raw.team_b_corners),
          total: cleanValue(raw.totalCornerCount)
        },
        first_half: {
          home: cleanValue(raw.team_a_fh_corners),
          away: cleanValue(raw.team_b_fh_corners),
          total: cleanValue(raw.corner_fh_count)
        },
        second_half: {
          home: cleanValue(raw.team_a_2h_corners),
          away: cleanValue(raw.team_b_2h_corners),
          total: cleanValue(raw.corner_2h_count)
        },
        potential: {
          total: cleanValue(raw.corners_potential),
          over85: cleanValue(raw.corners_o85_potential),
          over95: cleanValue(raw.corners_o95_potential),
          over105: cleanValue(raw.corners_o105_potential)
        },
        timings: {
          recorded: cleanValue(raw.corner_timings_recorded),
          home_0_10: cleanValue(raw.team_a_corners_0_10_min),
          away_0_10: cleanValue(raw.team_b_corners_0_10_min)
        }
      },
      cards: {
        full_time: {
          home_total: cleanValue(raw.team_a_cards_num),
          away_total: cleanValue(raw.team_b_cards_num),
          total: sumClean(raw.team_a_cards_num, raw.team_b_cards_num),
          home_yellow: cleanValue(raw.team_a_yellow_cards),
          away_yellow: cleanValue(raw.team_b_yellow_cards),
          home_red: cleanValue(raw.team_a_red_cards),
          away_red: cleanValue(raw.team_b_red_cards)
        },
        first_half: {
          home: cleanValue(raw.team_a_fh_cards),
          away: cleanValue(raw.team_b_fh_cards),
          total: cleanValue(raw.total_fh_cards)
        },
        second_half: {
          home: cleanValue(raw.team_a_2h_cards),
          away: cleanValue(raw.team_b_2h_cards),
          total: cleanValue(raw.total_2h_cards)
        },
        potential: {
          total: cleanValue(raw.cards_potential)
        },
        timings: {
          recorded: cleanValue(raw.card_timings_recorded),
          home_0_10: cleanValue(raw.team_a_cards_0_10_min),
          away_0_10: cleanValue(raw.team_b_cards_0_10_min)
        }
      },
      shots: {
        full_time: {
          home_total: cleanValue(raw.team_a_shots),
          away_total: cleanValue(raw.team_b_shots),
          total: sumClean(raw.team_a_shots, raw.team_b_shots),
          home_on_target: cleanValue(raw.team_a_shotsOnTarget),
          away_on_target: cleanValue(raw.team_b_shotsOnTarget),
          total_on_target: sumClean(raw.team_a_shotsOnTarget, raw.team_b_shotsOnTarget),
          home_off_target: cleanValue(raw.team_a_shotsOffTarget),
          away_off_target: cleanValue(raw.team_b_shotsOffTarget),
          total_off_target: sumClean(raw.team_a_shotsOffTarget, raw.team_b_shotsOffTarget)
        },
        attacks: {
          home_attacks: cleanValue(raw.team_a_attacks),
          away_attacks: cleanValue(raw.team_b_attacks),
          home_dangerous: cleanValue(raw.team_a_dangerous_attacks),
          away_dangerous: cleanValue(raw.team_b_dangerous_attacks),
          recorded: cleanValue(raw.attacks_recorded)
        },
        possession: {
          home: cleanValue(raw.team_a_possession),
          away: cleanValue(raw.team_b_possession)
        }
      },
      discipline_and_flow: {
        fouls: {
          home: cleanValue(raw.team_a_fouls),
          away: cleanValue(raw.team_b_fouls),
          total: sumClean(raw.team_a_fouls, raw.team_b_fouls)
        },
        offsides: {
          home: cleanValue(raw.team_a_offsides),
          away: cleanValue(raw.team_b_offsides),
          total: sumClean(raw.team_a_offsides, raw.team_b_offsides),
          potential: cleanValue(raw.offsides_potential)
        },
        throwins: {
          recorded: cleanValue(raw.throwins_recorded),
          home: cleanValue(raw.team_a_throwins),
          away: cleanValue(raw.team_b_throwins),
          total: sumClean(raw.team_a_throwins, raw.team_b_throwins)
        },
        freekicks: {
          recorded: cleanValue(raw.freekicks_recorded),
          home: cleanValue(raw.team_a_freekicks),
          away: cleanValue(raw.team_b_freekicks),
          total: sumClean(raw.team_a_freekicks, raw.team_b_freekicks)
        },
        goalkicks: {
          recorded: cleanValue(raw.goalkicks_recorded),
          home: cleanValue(raw.team_a_goalkicks),
          away: cleanValue(raw.team_b_goalkicks),
          total: sumClean(raw.team_a_goalkicks, raw.team_b_goalkicks)
        }
      },
      penalties: {
        home_won: cleanValue(raw.team_a_penalties_won),
        away_won: cleanValue(raw.team_b_penalties_won),
        home_goals: cleanValue(raw.team_a_penalty_goals),
        away_goals: cleanValue(raw.team_b_penalty_goals),
        home_missed: cleanValue(raw.team_a_penalty_missed),
        away_missed: cleanValue(raw.team_b_penalty_missed),
        recorded: cleanValue(raw.pens_recorded)
      },
      potentials: {
        goals: {
          over05: cleanValue(raw.o05_potential),
          over15: cleanValue(raw.o15_potential),
          over25: cleanValue(raw.o25_potential),
          over35: cleanValue(raw.o35_potential),
          over45: cleanValue(raw.o45_potential),
          under05: cleanValue(raw.u05_potential),
          under15: cleanValue(raw.u15_potential),
          under25: cleanValue(raw.u25_potential),
          under35: cleanValue(raw.u35_potential),
          under45: cleanValue(raw.u45_potential),
          avg: cleanValue(raw.avg_potential)
        },
        btts: {
          full_time: cleanValue(raw.btts_potential),
          first_half: cleanValue(raw.btts_fhg_potential),
          second_half: cleanValue(raw.btts_2hg_potential)
        },
        corners: {
          total: cleanValue(raw.corners_potential),
          over85: cleanValue(raw.corners_o85_potential),
          over95: cleanValue(raw.corners_o95_potential),
          over105: cleanValue(raw.corners_o105_potential)
        },
        cards: {
          total: cleanValue(raw.cards_potential)
        },
        offsides: {
          total: cleanValue(raw.offsides_potential)
        }
      },
      odds: {
        result: {
          home: cleanOdd(raw.odds_ft_1),
          draw: cleanOdd(raw.odds_ft_x),
          away: cleanOdd(raw.odds_ft_2)
        },
        goals: {
          over05: cleanOdd(raw.odds_ft_over05),
          over15: cleanOdd(raw.odds_ft_over15),
          over25: cleanOdd(raw.odds_ft_over25),
          over35: cleanOdd(raw.odds_ft_over35),
          over45: cleanOdd(raw.odds_ft_over45),
          under05: cleanOdd(raw.odds_ft_under05),
          under15: cleanOdd(raw.odds_ft_under15),
          under25: cleanOdd(raw.odds_ft_under25),
          under35: cleanOdd(raw.odds_ft_under35),
          under45: cleanOdd(raw.odds_ft_under45)
        },
        btts: {
          yes: cleanOdd(raw.odds_btts_yes),
          no: cleanOdd(raw.odds_btts_no)
        },
        clean_sheet: {
          home_yes: cleanOdd(raw.odds_team_a_cs_yes),
          home_no: cleanOdd(raw.odds_team_a_cs_no),
          away_yes: cleanOdd(raw.odds_team_b_cs_yes),
          away_no: cleanOdd(raw.odds_team_b_cs_no)
        },
        double_chance: {
          home_or_draw: cleanOdd(raw.odds_doublechance_1x),
          home_or_away: cleanOdd(raw.odds_doublechance_12),
          draw_or_away: cleanOdd(raw.odds_doublechance_x2)
        },
        half_time: {
          result_home: cleanOdd(raw.odds_1st_half_result_1),
          result_draw: cleanOdd(raw.odds_1st_half_result_x),
          result_away: cleanOdd(raw.odds_1st_half_result_2),
          over05: cleanOdd(raw.odds_1st_half_over05),
          over15: cleanOdd(raw.odds_1st_half_over15),
          over25: cleanOdd(raw.odds_1st_half_over25),
          over35: cleanOdd(raw.odds_1st_half_over35),
          under05: cleanOdd(raw.odds_1st_half_under05),
          under15: cleanOdd(raw.odds_1st_half_under15),
          under25: cleanOdd(raw.odds_1st_half_under25),
          under35: cleanOdd(raw.odds_1st_half_under35)
        },
        second_half: {
          result_home: cleanOdd(raw.odds_2nd_half_result_1),
          result_draw: cleanOdd(raw.odds_2nd_half_result_x),
          result_away: cleanOdd(raw.odds_2nd_half_result_2),
          over05: cleanOdd(raw.odds_2nd_half_over05),
          over15: cleanOdd(raw.odds_2nd_half_over15),
          over25: cleanOdd(raw.odds_2nd_half_over25),
          over35: cleanOdd(raw.odds_2nd_half_over35),
          under05: cleanOdd(raw.odds_2nd_half_under05),
          under15: cleanOdd(raw.odds_2nd_half_under15),
          under25: cleanOdd(raw.odds_2nd_half_under25),
          under35: cleanOdd(raw.odds_2nd_half_under35)
        },
        corners: {
          over75: cleanOdd(raw.odds_corners_over_75),
          over85: cleanOdd(raw.odds_corners_over_85),
          over95: cleanOdd(raw.odds_corners_over_95),
          over105: cleanOdd(raw.odds_corners_over_105),
          over115: cleanOdd(raw.odds_corners_over_115),
          under75: cleanOdd(raw.odds_corners_under_75),
          under85: cleanOdd(raw.odds_corners_under_85),
          under95: cleanOdd(raw.odds_corners_under_95),
          under105: cleanOdd(raw.odds_corners_under_105),
          under115: cleanOdd(raw.odds_corners_under_115),
          home: cleanOdd(raw.odds_corners_1),
          draw: cleanOdd(raw.odds_corners_x),
          away: cleanOdd(raw.odds_corners_2)
        },
        other: {
          win_to_nil_home: cleanOdd(raw.odds_win_to_nil_1),
          win_to_nil_away: cleanOdd(raw.odds_win_to_nil_2),
          dnb_home: cleanOdd(raw.odds_dnb_1),
          dnb_away: cleanOdd(raw.odds_dnb_2)
        }
      },
      venue: {
        stadium_name: raw.stadium_name || "",
        stadium_location: raw.stadium_location || "",
        attendance: cleanValue(raw.attendance)
      },
      referee: {
        id: raw.refereeID || raw.referee_id || null,
        raw: raw.referee || null
      },
      players: {
        home: [],
        away: []
      },
      league_table: {
        home: null,
        away: null,
        all: []
      },
      raw: {
        match: raw,
        match_details: raw,
        home_team: raw.home_team || null,
        away_team: raw.away_team || null
      },
      diagnostics: {
        source: "match-details"
      }
    };
  }

  async function fetchMatchDetails(match) {
    const response = await fetch(`/api/match-details?match_id=${encodeURIComponent(match.matchId)}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error || "Erro ao carregar dados reais da partida.");
    }

    return buildCompleteFromMatchDetails(payload.data, match);
  }

  async function fetchLegacyComplete(match) {
    if (!match.seasonId) {
      throw new Error("Season ID indisponivel para endpoint legado.");
    }

    const response = await fetch(
      `/api/partida-completa?match_id=${encodeURIComponent(match.matchId)}&season_id=${encodeURIComponent(match.seasonId)}`
    );
    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error || "Erro ao carregar partida completa.");
    }

    return payload.data;
  }

  showStats = async function showStatsWithRealFootyStats(encodedMatchId) {
    const matchId = decodeURIComponent(encodedMatchId);
    const foundMatch = findMatchById(matchId);

    if (!foundMatch) return;

    selectedMatch = foundMatch;

    document.getElementById("homePage").classList.add("hidden");
    document.getElementById("statsPage").classList.remove("hidden");

    tabButtons.forEach(function(item) {
      item.classList.toggle("active", item.dataset.tab === "completas");
    });

    updateMatchHeader(selectedMatch);

    tabContent.innerHTML = `
      <article class="card">
        <h2>Carregando dados reais da FootyStats...</h2>
        <p class="small-note">Buscando estatisticas, odds, tendencias e H2H da partida por match_id.</p>
      </article>
    `;

    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      if (!selectedMatch.matchId) {
        throw new Error("Nao encontramos match_id para carregar a partida na FootyStats.");
      }

      try {
        selectedMatch.complete = await fetchMatchDetails(selectedMatch);
      } catch (detailsError) {
        selectedMatch.complete = await fetchLegacyComplete(selectedMatch);
        selectedMatch.complete.diagnostics = selectedMatch.complete.diagnostics || {};
        selectedMatch.complete.diagnostics.match_details_error = detailsError.message;
      }

      syncSelectedMatchFromComplete();
      updateMatchHeader(selectedMatch);
      renderTab("completas");
    } catch (error) {
      tabContent.innerHTML = `
        <article class="card">
          <h2>⚠️ Nao foi possivel carregar os dados reais</h2>
          <p class="small-note">${escapeHTML(error.message)}</p>
          <p class="small-note">Confira se a variavel FOOTYSTATS_API_KEY esta configurada na Vercel e se a partida possui match_id valido.</p>
        </article>
      `;
    }
  };
})();
