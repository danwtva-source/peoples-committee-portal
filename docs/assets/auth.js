// docs/assets/auth.js
// -------------------------------------------------------------
// 1) Set this to YOUR Worker URL (no trailing slash)
const API_BASE = "https://communities-choice-api.dan-w-tva.workers.dev";

// tiny dom helpers
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// --- overlay creation (auto-inject if missing) -----------------------------
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

// --- overlay helpers -------------------------------------------------------
function showLoginOverlay(show) {
  const overlay = $("#cc-login-overlay");
  if (!overlay) return;                     // safe if not present (but we inject above)
  overlay.style.display = show ? "flex" : "none";
}

function setError(msg) {
  const el = $("#cc-login-error");
  if (el) { el.textContent = msg || ""; el.style.display = msg ? "block" : "none"; }
}

// --- hand-off to the page's module so it renders dashboards ----------------
function afterAuth(me) {
  // keep any area filtering you already have
  if (window.applyAreaFilter) window.applyAreaFilter(me.area, me.role);

  // critical bridge: tells the page module who is logged in
  if (window.setCommitteeUser) window.setCommitteeUser(me);

  setError("");
  showLoginOverlay(false);
}

// --- API calls -------------------------------------------------------------
async function checkSession() {
  ensureOverlay();
  try {
    const r = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
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
    if (!r.ok) { setError(await r.text() || "Login failed."); return; }

    const meRes = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    if (!meRes.ok) { setError("Could not load profile."); return; }
    const me = await meRes.json();
    afterAuth(me);
  } catch {
    setError("Failed to fetch");
  }
}

async function doLogout(e) {
  if (e) e.preventDefault();
  try { await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" }); } catch {}
  showLoginOverlay(true);
}

// --- boot ------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  ensureOverlay();

  const form = $("#cc-login-form");
  if (form) form.addEventListener("submit", doLogin);

  // wire any logout buttons if present
  [ "#logoutBtn", "a[href='#logout']", ".nav-logout", "#logout" ].forEach(sel => {
    $$(sel).forEach(btn => btn.addEventListener("click", doLogout));
  });

  checkSession();
});

// expose small debug helper
window.ccShowLogin = () => { ensureOverlay(); showLoginOverlay(true); };
