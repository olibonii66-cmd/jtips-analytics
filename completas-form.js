(function() {
  function hasValue(value) {
    return value !== undefined && value !== null && value !== "" && value !== -1 && value !== "-1";
  }

  function getRawMatch(data) {
    return data?.raw?.match_details || data?.raw?.match || selectedMatch?.raw || null;
  }

  function escape(value) {
    return typeof escapeHTML === "function"
      ? escapeHTML(value)
      : String(value ?? "").replace(/[&<>"]/g, function(char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char];
      });
  }

  function getTeamIds(data) {
    const raw = getRawMatch(data) || {};

    return {
      home: data?.ids?.home_id || raw.homeID || raw.home_id || raw.team_a_id || selectedMatch?.raw?.homeID || "",
      away: data?.ids?.away_id || raw.awayID || raw.away_id || raw.team_b_id || selectedMatch?.raw?.awayID || ""
    };
  }

  function needsFormData(data) {
    const ids = getTeamIds(data);

    return Boolean(
      data &&
      selectedMatch?.seasonId &&
      ids.home &&
      ids.away &&
      !data._completasFormLoading &&
      !data._completasFormLoaded &&
      !data._completasFormError
    );
  }

  async function loadFormData(data) {
    if (!needsFormData(data)) return;

    const ids = getTeamIds(data);
    const raw = getRawMatch(data) || {};
    data._completasFormLoading = true;

    try {
      const params = new URLSearchParams({
        season_id: selectedMatch.seasonId,
        match_id: selectedMatch.matchId || "",
        home_id: ids.home,
        away_id: ids.away
      });

      const dateUnix = data.status?.date_unix || raw.date_unix;
      if (dateUnix) params.set("date_unix", dateUnix);

      const response = await fetch(`/api/completas-form?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Últimos jogos indisponíveis.");
      }

      data.raw = data.raw || {};
      data.raw.match = data.raw.match || raw || {};
      data.raw.match_details = data.raw.match_details || data.raw.match;
      data._completasForm = payload.data;
      data._completasFormLoaded = true;
      data.diagnostics = data.diagnostics || {};
      data.diagnostics.completas_form = payload.diagnostics || null;

      applyFormData(data);
    } catch (error) {
      data._completasFormError = error.message;
    } finally {
      data._completasFormLoading = false;
      if (selectedMatch?.complete === data) renderTab("completas");
    }
  }

  function applyFormData(data) {
    const raw = getRawMatch(data);
    const form = data?._completasForm;

    if (!raw || !form) return;

    raw.team_a_last_matches = form.home?.all || [];
    raw.team_a_home_matches = form.home?.home || [];
    raw.team_a_away_matches = form.home?.away || [];
    raw.home_recent_matches = form.home?.all || [];

    raw.team_b_last_matches = form.away?.all || [];
    raw.team_b_home_matches = form.away?.home || [];
    raw.team_b_away_matches = form.away?.away || [];
    raw.away_recent_matches = form.away?.all || [];
  }

  function getRows(side, mode) {
    const data = selectedMatch?.complete;
    const form = data?._completasForm;
    const team = side === "away" ? form?.away : form?.home;

    if (!team) return [];
    return team[mode] || [];
  }

  function getModeFromText(text) {
    const normalized = String(text || "").toLowerCase();
    if (normalized.includes("todos")) return "all";
    if (normalized.includes("visitante")) return "away";
    return "home";
  }

  function score(row) {
    if (hasValue(row.homeGoalCount) && hasValue(row.awayGoalCount)) {
      return `${row.homeGoalCount} - ${row.awayGoalCount}`;
    }

    return "-";
  }

  function renderRows(rows) {
    if (!rows.length) {
      return `<div class="complete-empty-mini">Últimos jogos não disponíveis na API.</div>`;
    }

    return rows.map(function(row) {
      return `
        <div class="complete-form-row detailed">
          <strong>${escape(row.home_name || "Mandante")}</strong>
          <span>${escape(score(row))}</span>
          <em>${escape(row.away_name || "Visitante")}</em>
        </div>
      `;
    }).join("");
  }

  function updateTabState(item, selected) {
    item.classList.toggle("active", selected);

    if (item.tagName !== "B") {
      item.style.removeProperty("background");
      item.style.removeProperty("color");
      return;
    }

    if (selected) {
      item.style.removeProperty("background");
      item.style.removeProperty("color");
      return;
    }

    item.style.background = "transparent";
    item.style.color = "#8a96a3";
  }

  function updateFormList(tabElement) {
    const teamElement = tabElement.closest(".complete-form-team");
    if (!teamElement) return;

    const side = teamElement.classList.contains("away") ? "away" : "home";
    const mode = getModeFromText(tabElement.textContent);
    const list = teamElement.querySelector(".complete-form-list");

    teamElement.querySelectorAll(".complete-form-tabs span, .complete-form-tabs b").forEach(function(item) {
      updateTabState(item, item === tabElement);
    });

    if (list) list.innerHTML = renderRows(getRows(side, mode));
  }

  document.addEventListener("click", function(event) {
    const tab = event.target.closest(".complete-form-tabs span, .complete-form-tabs b");
    if (!tab) return;
    updateFormList(tab);
  });

  if (typeof renderCompletas === "function") {
    const previousRenderCompletas = renderCompletas;

    renderCompletas = function renderCompletasWithTeamForm() {
      const data = selectedMatch?.complete;
      applyFormData(data);
      loadFormData(data);
      return previousRenderCompletas();
    };
  }
})();
