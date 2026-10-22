(() => {
 // The landing page uses a single compact header; other pages keep quick navigation.
 if (document.body.classList.contains('landing-market-page')) {
  const strip = document.querySelector('.quick-nav');
  const profile = strip?.querySelector('.profile-link');
  const header = document.querySelector('.site-header nav');
  if (profile && header) { header.appendChild(profile); strip.remove(); }
 }
 const box = document.getElementById('reduceMotion');
 let reduced = false;
 try { reduced = localStorage.getItem('finance-reduce-motion') === 'true'; } catch (_) {}
 document.documentElement.classList.toggle('reduce-motion', reduced);
 if (box) {
  box.checked = reduced;
  box.addEventListener('change', () => {
   document.documentElement.classList.toggle('reduce-motion', box.checked);
   try { localStorage.setItem('finance-reduce-motion', String(box.checked)); document.getElementById('settingsStatus').textContent = 'Preference saved on this device.'; }
   catch (_) { document.getElementById('settingsStatus').textContent = 'Preference applied for this page. Your browser could not save it.'; }
  });
 }
 function markCurrent() {
  document.querySelectorAll('.quick-nav a').forEach(link => {
   const url = new URL(link.href);
   const active = url.pathname === location.pathname && (url.hash ? url.hash === location.hash : !location.hash);
   if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
 }
 markCurrent(); window.addEventListener('hashchange', markCurrent);
})();