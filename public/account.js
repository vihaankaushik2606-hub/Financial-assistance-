const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

// Expose globally so app.js and other scripts can safely use them
window.$ = $;
window.esc = esc;

let supabaseClient = null;
let currentSession = null;
const LOCAL_STORAGE_HISTORY_KEY = "ai_finance_lab_history";

const profileLink = document.createElement("a");
profileLink.className = "profile-link";
profileLink.href = "/account.html";
profileLink.setAttribute("aria-label", "Sign in or view your account");
profileLink.title = "Your account";
profileLink.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg><span class="profile-status" aria-hidden="true"></span>';
document.querySelector(".quick-nav")?.appendChild(profileLink);

async function initAccount() {
  const setup = $("authSetupNotice");
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const config = await response.json().catch(() => ({}));

    if (!config.authConfigured || !window.supabase?.createClient) {
      if (setup) {
        setup.innerHTML = "✨ <b>Guest Mode Active:</b> You can use research tools, financial calculators, and AI assistance freely. (Configure Supabase in <code>.env</code> if you wish to sync history across devices.)";
      }
      if ($("authStatus")) {
        $("authStatus").textContent = "Guest mode active. Your research will be saved locally on this device.";
      }
      loadPrivateHistory();
      return;
    }

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    if (setup) {
      setup.textContent = "Account service ready. Sign in with email or Google to sync your saved research across devices.";
    }

    const { data } = await supabaseClient.auth.getSession();
    currentSession = data.session;
    renderAccount(currentSession);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      setTimeout(() => renderAccount(session), 0);
    });
  } catch (_error) {
    if (setup) {
      setup.textContent = "Guest mode active. Research tools are ready to use.";
    }
    loadPrivateHistory();
  }
}

function renderAccount(session) {
  window.dispatchEvent(new Event("finance-account-changed"));
  profileLink.classList.toggle("signed-in", Boolean(session));
  profileLink.setAttribute("aria-label", session ? "View your account details" : "Sign in or create an account");
  profileLink.title = session ? "Your account details" : "Sign in";

  if ($("accountHeading")) $("accountHeading").textContent = session ? "Your account details" : "Sign in or create an account.";
  if ($("profileEmail")) {
    const user = session?.user;
    $("profileName").textContent = user?.user_metadata?.full_name || user?.user_metadata?.name || "Not provided";
    $("profileEmail").textContent = user?.email || "Not provided";
    const joined = user?.created_at ? new Date(user.created_at) : null;
    $("profileJoined").textContent = joined && Number.isFinite(joined.getTime()) ? joined.toLocaleDateString() : "Unavailable";
    $("profileProvider").textContent = user?.app_metadata?.providers?.join(", ") || user?.app_metadata?.provider || "Email";
  }

  if ($("authSignedOut")) $("authSignedOut").hidden = Boolean(session);
  if ($("authSignedIn")) $("authSignedIn").hidden = !session;

  const navAccount = $("navAccount");
  if (navAccount) navAccount.textContent = session ? "Your account" : "Sign in";

  if (session) {
    if ($("accountIdentity")) $("accountIdentity").textContent = `Signed in as ${session.user.email || "Google account"}`;
    if ($("authStatus")) $("authStatus").textContent = "Signed in. Cloud synchronization active for this account.";
    setTimeout(loadPrivateHistory, 0);
  } else {
    if ($("authStatus")) $("authStatus").textContent = "Guest mode active. Sign in to sync your private history across devices.";
    loadPrivateHistory();
  }
}

async function getAccessToken() {
  if (!supabaseClient) {
    return "guest-token";
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) {
    return "guest-token";
  }
  return data.session.access_token;
}

async function savePrivateHistory(kind, title, content) {
  const record = {
    id: "hist_" + Date.now(),
    kind,
    title: String(title || "").slice(0, 160),
    content: String(content || "").slice(0, 12000),
    created_at: new Date().toISOString()
  };

  // If connected to Supabase, save to cloud
  if (supabaseClient && currentSession) {
    const { error } = await supabaseClient.from("analysis_history").insert({
      kind: record.kind,
      title: record.title,
      content: record.content
    });
    if (error) {
      if ($("authStatus")) $("authStatus").textContent = "Cloud save failed. Saved locally instead.";
      saveLocalHistory(record);
      return;
    }
  } else {
    // Save to local storage for guests
    saveLocalHistory(record);
  }
  await loadPrivateHistory();
}

function saveLocalHistory(record) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY) || "[]");
    existing.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(existing.slice(0, 30)));
  } catch (_e) {}
}

async function loadPrivateHistory() {
  const historyList = $("historyList");
  if (!historyList) return;

  if (supabaseClient && currentSession) {
    const requestedUser = currentSession.user.id;
    historyList.innerHTML = '<p class="muted">Loading your saved history…</p>';
    const { data, error } = await supabaseClient.from("analysis_history")
      .select("id,kind,title,content,created_at")
      .order("created_at", { ascending: false }).limit(30);

    if (currentSession?.user.id !== requestedUser) return;
    if (error) {
      historyList.innerHTML = '<p class="notice">Could not load cloud history. Showing local history if available.</p>';
      renderLocalHistory(historyList);
      return;
    }
    if (!data?.length) {
      historyList.innerHTML = '<p class="muted">No saved analyses yet. Your future AI results and scans will appear here.</p>';
      return;
    }
    renderHistoryItems(historyList, data);
  } else {
    renderLocalHistory(historyList);
  }
}

function renderLocalHistory(historyList) {
  try {
    const items = JSON.parse(localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY) || "[]");
    if (!items.length) {
      historyList.innerHTML = '<p class="muted">No saved analyses yet. Your research results will appear here.</p>';
      return;
    }
    renderHistoryItems(historyList, items);
  } catch (_e) {
    historyList.innerHTML = '<p class="muted">No saved analyses yet.</p>';
  }
}

function renderHistoryItems(container, items) {
  container.innerHTML = items.map(item => `
    <article class="finding">
      <time>${esc(new Date(item.created_at).toLocaleString())} · ${esc(item.kind)}</time>
      <b>${esc(item.title)}</b>
      <p style="white-space: pre-wrap;">${esc(item.content)}</p>
    </article>
  `).join("");
}

async function runAuthAction(action) {
  if (!supabaseClient) {
    if ($("authStatus")) {
      $("authStatus").textContent = "Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env to enable user accounts.";
    }
    return;
  }
  const email = $("authEmail")?.value.trim() || "";
  const password = $("authPassword")?.value || "";
  if ($("authStatus")) $("authStatus").textContent = "Processing…";

  try {
    let result;
    if (action === "signup") {
      if (!email || password.length < 8) throw new Error("Please enter a valid email and a password with at least 8 characters.");
      result = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (result.error) throw result.error;
      if ($("authStatus")) $("authStatus").textContent = result.data.session ? "Account created and signed in!" : "Account created! Check your email inbox to confirm your account.";
      if (result.data.session) window.location.assign("/");
    } else if (action === "signin") {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if ($("authStatus")) $("authStatus").textContent = "Signed in successfully!";
      if (result.data.session) window.location.assign("/");
    } else if (action === "google") {
      result = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (result.error) throw result.error;
    } else if (action === "signout") {
      result = await supabaseClient.auth.signOut();
      if (result.error) throw result.error;
      if ($("authStatus")) $("authStatus").textContent = "You have signed out.";
    }
  } catch (error) {
    if ($("authStatus")) $("authStatus").textContent = error.message || "Account action failed. Please try again.";
  }
}

$("signInBtn")?.addEventListener("click", () => runAuthAction("signin"));
$("signUpBtn")?.addEventListener("click", () => runAuthAction("signup"));
$("googleSignInBtn")?.addEventListener("click", () => runAuthAction("google"));
$("signOutBtn")?.addEventListener("click", () => runAuthAction("signout"));
$("refreshHistoryBtn")?.addEventListener("click", loadPrivateHistory);

let resolveFinanceAccount;
window.FinanceAccount={ready:new Promise(resolve=>{resolveFinanceAccount=resolve;}),token:getAccessToken};
const startFinanceAccount=()=>initAccount().finally(()=>resolveFinanceAccount());
// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startFinanceAccount);
} else {
  startFinanceAccount();
}

