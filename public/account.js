const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

// Expose globally so app.js and other scripts can safely use them
window.$ = $;
window.esc = esc;

let supabaseClient = null;
let currentSession = null;
let authMode = "signin";
let authBusy = false;
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
        setup.textContent = "Account service could not load. Refresh the page or try another browser.";
      }
      if ($("authStatus")) {
        $("authStatus").textContent = "Sign-in is unavailable until the account service loads.";
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

    const { data, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    currentSession = data.session;
    renderAccount(currentSession);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      setTimeout(() => renderAccount(session), 0);
    });
  } catch (_error) {
    if (setup) {
      setup.textContent = "Could not connect to the account service. Refresh the page and try again.";
    }
    loadPrivateHistory();
  }
}

function renderAccount(session) {
  window.dispatchEvent(new Event("finance-account-changed"));
  profileLink.classList.toggle("signed-in", Boolean(session));
  profileLink.setAttribute("aria-label", session ? "View your account details" : "Sign in or create an account");
  profileLink.title = session ? "Your account details" : "Sign in";
  const displayName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "Your account";
  document.querySelectorAll(".profile-link,.header-account").forEach(link => {
    let label=link.querySelector(".account-label");
    if(!label){label=document.createElement("span");label.className="account-label";link.append(label);}
    label.textContent=session ? displayName : "Sign in";
    link.setAttribute("aria-label",session ? "Your account: "+displayName : "Sign in or create an account");
  });
  if($("profileNameInput")) $("profileNameInput").value = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || "";
  document.querySelector(".auth-mode")?.toggleAttribute("hidden",Boolean(session));
  if($("authIntro")) $("authIntro").hidden=Boolean(session);

  if ($("accountHeading")) $("accountHeading").textContent = session ? "Your account details" : authMode === "signup" ? "Create account" : "Sign in";
  if ($("profileEmail")) {
    const user = session?.user;
    $("profileName").textContent = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Add your name above";
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
    if ($("accountIdentity")) $("accountIdentity").textContent = `Welcome, ${displayName}. Signed in as ${session.user.email || "Google account"}`;
    if ($("authStatus")) $("authStatus").textContent = "Signed in. Cloud synchronization active for this account.";
    setTimeout(loadPrivateHistory, 0);
  } else {
    if ($("authStatus")) $("authStatus").textContent = "Sign in to your existing account, or choose Create account if you are new.";
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
  if(authBusy) return;
  if (!supabaseClient) {
    if ($("authStatus")) {
      $("authStatus").textContent = "Account service is not ready. Refresh the page and try again.";
    }
    return;
  }
  const email = $("authEmail")?.value.trim() || "";
  const password = $("authPassword")?.value || "";
  if ($("authStatus")) $("authStatus").textContent = "Processing…";

  authBusy=true;
  document.querySelectorAll(".auth-actions button,#googleSignInBtn").forEach(b=>b.disabled=true);
  try {
    let result;
    if (action === "signup") {
      if (!$("authEmail")?.checkValidity() || !email || password.length < 8) throw new Error("Enter a valid email and a password with at least 8 characters.");
      const fullName=$("authName")?.value.trim();
      if(!fullName) throw new Error("Enter your name to create your account.");
      result = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/account.html", data: {full_name:fullName} } });
      if (result.error) throw result.error;
      if ($("authStatus")) $("authStatus").textContent = result.data.session ? "Account created and signed in!" : "Check your inbox and spam folder for the confirmation email. Open its link, then sign in. If you already registered, choose Sign in.";
      if (result.data.session) window.location.assign("/");
    } else if (action === "signin") {
      if(!email || !password || !$("authEmail")?.checkValidity()) throw new Error("Enter your email and password to sign in.");
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
    if ($("authStatus")) $("authStatus").textContent = error.code === "email_not_confirmed" ? "Confirm your email first: open the confirmation link in your inbox or spam folder, then sign in." : error.code === "invalid_credentials" ? "Could not sign in. Check your email and password. If you used Google to register, use Continue with Google." : error.message || "Account action failed. Please try again.";
  } finally {
    authBusy=false;
    document.querySelectorAll(".auth-actions button,#googleSignInBtn").forEach(b=>b.disabled=false);
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


function setAuthMode(mode) {
 authMode=mode;
 if($("signupName")) $("signupName").hidden=mode!=="signup";
 if($("signUpBtn")) $("signUpBtn").hidden=mode!=="signup";
 if($("signInBtn")) $("signInBtn").hidden=mode!=="signin";
 if($("accountHeading")) $("accountHeading").textContent=mode==="signup"?"Create account":"Sign in";
 if($("authIntro")) $("authIntro").textContent=mode==="signup"?"New here? Create your tester account.":"Already registered? Sign in below.";
 $("showSignIn")?.setAttribute("aria-pressed",String(mode==="signin"));
 $("showSignUp")?.setAttribute("aria-pressed",String(mode==="signup"));
 $("authPassword")?.setAttribute("autocomplete",mode==="signup"?"new-password":"current-password");
 if($("authStatus")) $("authStatus").textContent=mode==="signup"?"After registering, check your email to confirm your account.":"Enter the email and password you registered with.";
}
$("showSignIn")?.addEventListener("click",()=>setAuthMode("signin"));
$("showSignUp")?.addEventListener("click",()=>setAuthMode("signup"));
$("authPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();runAuthAction(authMode);}});
$("saveProfileName")?.addEventListener("click",async()=>{
 const name=$("profileNameInput")?.value.trim();
 if(!name || !supabaseClient || !currentSession){$("authStatus").textContent="Enter your name while signed in.";return;}
 $("saveProfileName").disabled=true;
 try {
  const {data,error}=await supabaseClient.auth.updateUser({data:{full_name:name}});
  if(error)throw error;
  currentSession={...currentSession,user:data.user};renderAccount(currentSession);
  $("authStatus").textContent="Your name has been saved.";
 }catch(error){$("authStatus").textContent=error.message||"Could not save your name.";}
 finally{$("saveProfileName").disabled=false;}
});
