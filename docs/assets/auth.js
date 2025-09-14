// Front-end auth helper for Communities' Choice Portal
// Works with the Worker above. It injects the login overlay if missing,
// handles login/logout, stores a token (for browsers that block 3rd-party
// cookies) and calls window.setCommitteeUser(profile) so the page renders.

// 1) Set this to YOUR Worker URL (no trailing slash)
const API_BASE = "https://communities-choice-api.dan-w-tva.workers.dev";

// tiny dom helpers
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// -------------------- overlay creation (auto-inject) -----------------------
function ensureOverlay() {
  if ($("#cc-login-overlay")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
  <div id="cc-login-overlay" style="
    display:flex; align-items:center; justify-content:center;
    position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:9999;">
    <div style="background:#fff; border-radius:16px; width:min(520px,92vw);
                padding:24px 24px 28px; box-shadow:0 30px 60px rgba(0,0,0,.25);">
      <h2 style="margin:0 0 8px; font-family: system-ui, sans-serif;">Committee Portal Login</h2>
      <p style="margin:0 18px 18px 0; color:#555">Please sign in with your username and password.</p>
      <form id="cc-login-form">
        <label style="display:block; font-weight:600; margin:10px 0 6px;">Username</label>
        <input id="cc-username" autocomplete="username" style="width:100%; padding:10px;
               border:1px solid #ccc; border-radius:10px" />
        <label style="display:block; font-weight:600; margin:16px 0 6px;">Password</label>
        <input id="cc-password" type="password" autocomplete="current-password" style="width:100%;
               padding:10px; border:1px solid #ccc; border-radius:10px" />
        <div id="cc-login-error" style="color:#c00; margin:8px 0 0; display:none"></div>
        <button type="submit" style="
          margin-top:14px; width:100%; padding:12px 14px; border:0; border-radius:12px;
          background:#0f172a; color:#fff; font-weight:700; cursor:pointer">
          Sign in
        </button>
      </form>
    </div>
  </div>`;
  document.body.appendChild(wrapper.firstElementChild);
}

function showLoginOverlay(show) {
  const overlay = $("#cc-login-overlay");
  if (!overlay) return;
  overlay.style.display = show ? "flex" : "none";
}
function setError(msg) {
  const el = $("#cc-login-error");
  if (el) { el.textContent = msg || ""; el.style.display = msg ? "block" : "none"; }
}

// --------------------------- token helpers ---------------------------------
const TOKEN_KEY = "cc_token";
const getToken  = () => sessionStorage.getItem(TOKEN_KEY) || "";
const setToken  = (t) => { if (t) sessionStorage.setItem(TOKEN_KEY, t); };
const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

function authHeaders() {
  const headers = {};
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

// -------------------- hand-off to the page module --------------------------
function afterAuth(me) {
  // Optional: keep your existing area filter if present
  if (window.applyAreaFilter) window.applyAreaFilter(me.area, me.role);

  // IMPORTANT: tells the page who is logged in (index.html defines this)
  if (window.setCommitteeUser) window.setCommitteeUser(me);

  setError("");
  showLoginOverlay(false);
}

// ----------------------------- API calls -----------------------------------
async function checkSession() {
  ensureOverlay();
  try {
    const r = await fetch(`${API_BASE}/api/me`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!r.ok) { showLoginOverlay(true); return; }
    const me = await r.json();
    afterAuth(me);
  } catch {
    showLoginOverlay(true);
    setError("Failed to reach sign-in service.");
  }
}

async function doLogin(e) {
  e.preventDefault();
  setError("");
  const username = $("#cc-username")?.value?.trim() || "";
  const password = $("#cc-password")?.value || "";
  if (!username || !password) { setError("Please enter username and password."); return; }

  try {
    const r = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
    if (!r.ok) {
      const t = await r.text();
      setError(t || "Login failed.");
      return;
    }

    // Store token if provided (works even when third-party cookies are blocked)
    const data = await r.clone().json().catch(() => null);
    if (data && data.token) setToken(data.token);

    // Get profile (works via cookie OR Authorization header)
    const meRes = await fetch(`${API_BASE}/api/me`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!meRes.ok) { setError("Could not load profile."); return; }
    const me = await meRes.json();
    afterAuth(me);
  } catch {
    setError("Failed to fetch");
  }
}

async function doLogout(e) {
  if (e) e.preventDefault();
  clearToken();
  try { await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" }); } catch {}
  showLoginOverlay(true);
}

// ------------------------------- boot --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  ensureOverlay();

  const form = $("#cc-login-form");
  if (form) form.addEventListener("submit", doLogin);

  // wire any logout buttons already in your page
  [ "#logoutBtn", "a[href='#logout']", ".nav-logout", "#logout" ].forEach(sel => {
    $$(sel).forEach(btn => btn.addEventListener("click", doLogout));
  });

  // Check if we already have a valid session
  checkSession();
});

// Debug helper: force overlay
window.ccShowLogin = () => { ensureOverlay(); showLoginOverlay(true); };
