(() => {
 let promptEvent;
 const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
 const install = document.querySelector("[data-install-app]");
 const status = document.querySelector("[data-install-status]");
 const setStatus = text => { if (status) status.textContent = text; };
 if (standalone) {
  setStatus("AI Finance Lab is already open as an app.");
  if (install) install.hidden = true;
 }
 window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault(); promptEvent = event;
  if (install && !standalone) { install.hidden = false; install.disabled = false; }
  setStatus("Ready to install. Tap Install app.");
 });
 install?.addEventListener("click", async () => {
  if (!promptEvent) { setStatus("Use your browser menu to install. On iPhone, open Safari, tap Share, then Add to Home Screen and enable Open as Web App if shown."); return; }
  const pending = promptEvent; promptEvent = null;
  try { await pending.prompt(); const choice = await pending.userChoice;
   setStatus(choice.outcome === "accepted" ? "Installation requested. Check your home screen." : "Installation cancelled. You can try again from your browser menu.");
  } catch { setStatus("Open your browser menu and choose Install app or Add to Home Screen."); }
 });
 window.addEventListener("appinstalled", () => {
  promptEvent = null; if (install) install.hidden = true; setStatus("Installed. Open Finance Lab from your home screen.");
 });
 if ("serviceWorker" in navigator) window.addEventListener("load", () => {
  navigator.serviceWorker.register("/sw.js", { updateViaCache:"none" }).catch(() => setStatus("Offline support could not start. You can still use the site online."));
 });
})();