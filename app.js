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
