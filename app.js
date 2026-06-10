(() => {
  const APP_PARTS = [
    "./assets/runtime/app-v2-01.part",
    "./assets/runtime/app-v2-02.part",
    "./assets/runtime/app-v2-03.part",
    "./assets/runtime/app-v2-04.part",
    "./assets/runtime/app-v2-05.part",
  ];
  const STYLE_PARTS = [
    "./assets/runtime/styles-v2-01.part",
    "./assets/runtime/styles-v2-02.part",
  ];

  const COMPACT_LAYOUT_CSS = `
    @media (min-width: 1180px) {
      .dashboard {
        padding: 12px 18px 18px !important;
      }

      .topbar {
        margin-bottom: 12px !important;
      }

      .topbar h1 {
        font-size: clamp(2.1rem, 3vw, 3.2rem) !important;
        line-height: 0.95 !important;
      }

      .market-board {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 12px !important;
        align-items: start !important;
      }

      .market-card {
        min-width: 0 !important;
        padding: 9px !important;
        border-radius: 10px !important;
      }

      .market-card.featured {
        grid-column: auto !important;
      }

      .market-card-header {
        gap: 8px !important;
        margin-bottom: 8px !important;
      }

      .match-identity {
        min-width: 0 !important;
        gap: 8px !important;
      }

      .match-identity strong,
      .ticket-pick,
      .team-side strong {
        font-size: 0.72rem !important;
        line-height: 1.1 !important;
      }

      .match-identity small,
      .team-side span,
      .team-side em,
      .line-heading span,
      .ticket-row em,
      .ticket-row strong,
      .anti-conflict small {
        font-size: 0.64rem !important;
      }

      .mini-crest,
      .team-logo,
      .ticket-teams b {
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        border-radius: 8px !important;
        font-size: 0.58rem !important;
      }

      .match-clock,
      .favorite-button {
        min-width: 30px !important;
        height: 30px !important;
        padding: 0 7px !important;
        font-size: 0.68rem !important;
      }

      .score-panel,
      .pregame-panel {
        min-height: auto !important;
        padding: 8px !important;
        margin-bottom: 8px !important;
      }

      .line-section {
        padding: 8px 0 !important;
        margin: 0 !important;
      }

      .signal-lines {
        gap: 5px !important;
      }

      .signal-line {
        grid-template-columns: minmax(72px, 0.62fr) minmax(64px, 1fr) 38px !important;
        gap: 6px !important;
        min-height: 16px !important;
      }

      .signal-line span,
      .signal-line strong {
        font-size: 0.62rem !important;
      }

      .ticket-slip {
        gap: 5px !important;
      }

      .anti-conflict,
      .ticket-row,
      .ticket-total {
        min-height: 30px !important;
        padding: 6px 7px !important;
        gap: 7px !important;
      }

      .market-actions {
        gap: 7px !important;
        margin-top: 8px !important;
      }

      .market-actions button,
      .bet365-button {
        min-height: 34px !important;
        height: 34px !important;
        font-size: 0.72rem !important;
      }
    }

    @media (min-width: 860px) and (max-width: 1179px) {
      .market-board {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }
    }

    @media (max-width: 859px) {
      .market-board {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
      }
    }
  `;

  async function readCompressed(parts) {
    const responses = await Promise.all(parts.map((part) => fetch(part)));
    const failed = responses.find((response) => !response.ok);
    if (failed) throw new Error(`Falha ao carregar atualização: ${failed.status}`);

    const encoded = (await Promise.all(responses.map((response) => response.text())))
      .join("")
      .replace(/\s+/g, "");
    const binary = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    );
    const stream = new Blob([binary])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }

  function removeBrokenLogo(image) {
    if (!(image instanceof HTMLImageElement) || !image.matches("img[data-team-logo]")) {
      return;
    }
    image.closest("[data-logo-shell]")?.classList.remove("has-image");
    image.remove();
  }

  document.addEventListener(
    "error",
    (event) => removeBrokenLogo(event.target),
    true,
  );

  Promise.all([readCompressed(STYLE_PARTS), readCompressed(APP_PARTS)])
    .then(([styles, application]) => {
      const style = document.createElement("style");
      style.dataset.jtipsVersion = "2026-06-09";
      style.textContent = styles;
      document.head.append(style);
      document.querySelector('link[href$="styles.css"]')?.remove();
      window.eval(application);

      const compactStyle = document.createElement("style");
      compactStyle.dataset.jtipsOverride = "compact-three-column-cards";
      compactStyle.textContent = COMPACT_LAYOUT_CSS;
      document.head.append(compactStyle);

      [0, 250, 1000, 3000, 8000].forEach((delay) => {
        window.setTimeout(() => {
          document.querySelectorAll("img[data-team-logo]").forEach((image) => {
            if (image.complete && image.naturalWidth === 0) removeBrokenLogo(image);
          });
        }, delay);
      });
    })
    .catch((error) => {
      console.error(error);
      const notice = document.createElement("div");
      notice.textContent = "Não foi possível carregar a atualização do JTIPS. Atualize a página.";
      notice.style.cssText =
        "position:fixed;inset:20px;z-index:9999;padding:18px;background:#171b18;color:#fff;border:1px solid #c9a84f;font:600 14px Arial,sans-serif";
      document.body.append(notice);
    });
})();
