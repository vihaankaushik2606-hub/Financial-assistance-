(() => {
 // The landing page uses a single compact header; other pages keep quick navigation.
 if (document.body.classList.contains('landing-market-page') || document.body.classList.contains('floating-subpage')) {
  const strip = document.querySelector('.quick-nav');
  const profile = strip?.querySelector('.profile-link');
  const header = document.querySelector('.site-header nav,.subpage-header-nav');
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
  document.querySelectorAll('.quick-nav a,.subpage-header-nav a').forEach(link => {
   const url = new URL(link.href);
   const active = url.pathname === location.pathname && (url.hash ? url.hash === location.hash : !location.hash);
   if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
 }
 markCurrent(); window.addEventListener('hashchange', markCurrent);
})();
(() => {const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/research-lab.html"]')){const a=document.createElement("a");a.href="/research-lab.html";a.textContent="Business Analysis Lab";if(location.pathname==="/research-lab.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const n=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(n&&!n.querySelector('a[href="/news.html"]')){const a=document.createElement("a");a.href="/news.html";a.textContent="News";n.append(a);}})();
(()=>{const main=document.querySelector('main');if(main&&!document.querySelector('.workspace-nav')){const n=document.createElement('nav');n.className='workspace-nav';n.setAttribute('aria-label','Research tools');for(const [href,label] of [['/evidence.html','Evidence Review'],['/quarterly.html','Quarterly Changes'],['/news-impact.html','News Impact'],['/my-research.html','My Analysis']]){const a=document.createElement('a');a.href=href;a.textContent=label;n.append(a);}main.append(n);}})();
(() => {
 const header=document.querySelector('.site-header,.topbar');if(!header)return;
 let account=header.querySelector('.profile-link')||header.querySelector('a[href="/account.html"]');
 if(!account){account=document.createElement('a');account.href='/account.html';}
 header.querySelectorAll('a[href="/account.html"]').forEach(a=>{if(a!==account)a.remove();});
 account.classList.add('profile-link','header-account');account.setAttribute('aria-label','Your account / sign in');account.title='Your account';
 if(!account.querySelector('svg'))account.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
 header.append(account);
})();

document.documentElement.classList.remove("sign-in-hidden");

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/financial-instruments.html"]')){const a=document.createElement("a");a.href="/financial-instruments.html";a.textContent="Instruments";if(location.pathname==="/financial-instruments.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{for(const nav of document.querySelectorAll(".workspace-nav")){if(nav.querySelector('a[href="/compare-health.html"]'))continue;const a=document.createElement("a");a.href="/compare-health.html";a.textContent="Compare & Health";if(location.pathname==="/compare-health.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/pricing.html"]')){const a=document.createElement("a");a.href="/pricing.html";a.textContent="Pricing";if(location.pathname==="/pricing.html")a.setAttribute("aria-current","page");nav.append(a);}})();

(()=>{const main=document.querySelector("main");if(main&&!document.querySelector('[data-source-credit]')){const p=document.createElement("p");p.dataset.sourceCredit="true";p.style.cssText="text-align:center;padding:2rem 1rem;font-size:.9rem";const a=document.createElement("a");a.href="/sources.html";a.textContent="Sources & credits · CNBC · TradingView · FMP";p.append(a);main.append(p);}})();

(()=>{for(const n of document.querySelectorAll(".workspace-nav")){if(n.querySelector('a[href="/company-evaluation.html"]'))continue;const a=document.createElement("a");a.href="/company-evaluation.html";a.textContent="Company Evaluation";if(location.pathname==="/company-evaluation.html")a.setAttribute("aria-current","page");n.append(a);}})();

(()=>{const nav=document.querySelector(".site-header nav,.subpage-header-nav,.quick-nav");if(nav&&!nav.querySelector('a[href="/company-evaluation.html"]')){const a=document.createElement("a");a.href="/company-evaluation.html";a.textContent="Company Evaluation";if(location.pathname==="/company-evaluation.html")a.setAttribute("aria-current","page");nav.append(a);}})();
