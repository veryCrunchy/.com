/**
 * plugins/directus-visual-editing.client.ts
 *
 * Activates Directus 11 Visual Editor support when the site is loaded inside
 * the Directus admin iframe. Sets data-directus-visual-editing on <html> and
 * wires up the postMessage handshake so Directus can detect clickable fields.
 *
 * In production (direct browser visit) this plugin does nothing — zero overhead.
 */
export default defineNuxtPlugin(() => {
  const inEditor = window !== window.parent;
  if (!inEditor) return;

  const html = document.documentElement;
  html.setAttribute("data-directus-visual-editing", "");

  // Notify Directus that the page is ready to receive commands
  function ready() {
    window.parent.postMessage({ type: "directus:ready" }, "*");
  }

  // Handle the connection handshake message from Directus
  window.addEventListener("message", (event) => {
    const { type } = event.data ?? {};

    if (type === "directus:connection") {
      ready();
    }

    // Directus 11 sends a click‑to‑select event; forward the field context
    if (type === "directus:field-click") {
      // The SDK handles field resolution via data attributes on click —
      // just ensuring the event loop is unblocked here.
    }
  });

  // Intercept clicks on elements marked with data-directus-field and send
  // the field context back to the Directus Visual Editor
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const fieldEl = target.closest("[data-directus-field]") as HTMLElement | null;
    if (!fieldEl) return;

    const collection =
      fieldEl.closest("[data-directus-collection]")?.getAttribute("data-directus-collection");
    const item =
      fieldEl.closest("[data-directus-item]")?.getAttribute("data-directus-item");
    const field = fieldEl.getAttribute("data-directus-field");

    if (!collection || !item || !field) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    window.parent.postMessage(
      { type: "directus:field-click", collection, item, field },
      "*"
    );
  });

  // Initial ready signal (page may already be loaded when message fires)
  ready();
});
