const $ = (id) => document.getElementById(id);

let supabaseClient = null;
let currentSession = null;
async function initAccount() {
  const setup = $("authSetupNotice");
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const config = await response.json();
    if (!config.authConfigured || !window.supabase?.createClient) {
      setup.textContent = "The account service is temporarily unavailable. Please try again shortly.";
      $("authStatus").textContent = "AI features are protected and require a configured, signed-in account.";
      return;
    }
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    setup.textContent = "Account service ready. Sign in to use AI and view your own saved history.";
    const { data } = await supabaseClient.auth.getSession();
    currentSession = data.session;
    renderAccount(currentSession);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      setTimeout(() => renderAccount(session), 0);
    });
  } catch (_error) {
    setup.textContent = "Could not load account setup. Please try again later.";
  }
}
function renderAccount(session) {
  $("authSignedOut").hidden = Boolean(session);
  $("authSignedIn").hidden = !session;
  const navAccount = $("navAccount");
  if (navAccount) navAccount.textContent = session ? "Your account" : "Sign in";
  if (session) {
    $("accountIdentity").textContent = `Signed in as ${session.user.email || "Google account"}`;
    $("authStatus").textContent = "Signed in. AI requests and history are associated with this account.";
    setTimeout(loadPrivateHistory, 0);
  } else {
    $("authStatus").textContent = "Sign in to use AI features and save your private history.";
    $("historyList").innerHTML = '<p class="muted">Sign in to view your saved analyses.</p>';
  }
}
async function getAccessToken() {
  if (!supabaseClient) throw new Error("Account service is not configured yet.");
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Please sign in before using AI features.");
  return data.session.access_token;
}
async function savePrivateHistory(kind, title, content) {
  if (!supabaseClient || !currentSession) return;
  const { error } = await supabaseClient.from("analysis_history").insert({
    kind, title: String(title || "").slice(0, 160), content: String(content || "").slice(0, 12000)
  });
  if (error) {
    $("authStatus").textContent = "Your analysis could not be saved. Please try again shortly.";
    return;
  }
  await loadPrivateHistory();
}
async function loadPrivateHistory() {
  if (!supabaseClient || !currentSession) return;
  const requestedUser = currentSession.user.id;
  $("historyList").innerHTML = '<p class="muted">Loading your saved history…</p>';
  const { data, error } = await supabaseClient.from("analysis_history")
    .select("id,kind,title,content,created_at")
    .order("created_at", { ascending: false }).limit(30);
  if (currentSession?.user.id !== requestedUser) return;
  if (error) {
    $("historyList").innerHTML = '<p class="notice">Your saved research could not be loaded. Please try refreshing your history.</p>';
    return;
  }
  if (!data?.length) {
    $("historyList").innerHTML = '<p class="muted">No saved AI analyses yet. Your future AI results will appear here.</p>';
    return;
  }
  $("historyList").innerHTML = data.map(item => `<article class="finding"><time>${esc(new Date(item.created_at).toLocaleString())} · ${esc(item.kind)}</time><b>${esc(item.title)}</b><p>${esc(item.content)}</p></article>`).join("");
}
async function runAuthAction(action) {
  if (!supabaseClient) {
    $("authStatus").textContent = "Accounts are not configured. The site owner must finish the Supabase setup first.";
    return;
  }
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  $("authStatus").textContent = "Working…";
  try {
    let result;
    if (action === "signup") {
      if (!email || password.length < 8) throw new Error("Enter a valid email and a password with at least 8 characters.");
      result = await supabaseClient.auth.signUp({ email, password });
      if (result.error) throw result.error;
      $("authStatus").textContent = result.data.session ? "Account created and signed in." : "Account created. Check your email to confirm it, then sign in.";
    } else if (action === "signin") {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      $("authStatus").textContent = "Signed in successfully.";
    } else if (action === "google") {
      result = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (result.error) throw result.error;
    } else if (action === "signout") {
      result = await supabaseClient.auth.signOut();
      if (result.error) throw result.error;
      $("authStatus").textContent = "You have signed out.";
    }
  } catch (error) {
    $("authStatus").textContent = error.message || "Account action failed. Please try again.";
  }
}
$("signInBtn").addEventListener("click", () => runAuthAction("signin"));
$("signUpBtn").addEventListener("click", () => runAuthAction("signup"));
$("googleSignInBtn").addEventListener("click", () => runAuthAction("google"));
$("signOutBtn").addEventListener("click", () => runAuthAction("signout"));
$("refreshHistoryBtn").addEventListener("click", loadPrivateHistory);
initAccount();

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

