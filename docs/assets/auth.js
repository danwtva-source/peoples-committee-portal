// docs/assets/auth.js
// -------------------------------------------------------------
// Set this to YOUR Worker URL (no trailing slash)
const API_BASE = "https://communities-choice-api.dan-w-tva.workers.dev";

// Small helpers
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showLoginOverlay(show) {
  const overlay = $("#cc-login-overlay");
  if (!overlay) return;
  overlay.style.display = show ? "flex" : "none";
  document.documentElement.classList.toggle("cc-blur", show);
  document.body.classList.toggle("cc-blur", show);
}

function setError(msg) {
  const el = $("#cc-login-error");
  if (el) { el.textContent = msg || ""; el.style.display = msg ? "block" : "none"; }
}

function afterAuth(me) {
  // Optional: limit the UI by area/role (your existing filter, if present)
  if (window.applyAreaFilter) window.applyAreaFilter(me.area, me.role);

  // 🔗 The critical bridge so the page renders (sets currentUserProfile internally)
  if (window.setCommitteeUser) window.setCommitteeUser(me);

  setError("");
  showLoginOverlay(false);
}

async function checkSession() {
  try {
    const r = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    if (!r.ok) { showLoginOverlay(true); return; }
    const me = await r.json();
    afterAuth(me);
  } catch {
    // If the API cannot be reached, keep the overlay visible
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
    // Immediately fetch profile so we have area/role/name
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
  try {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
  } catch {}
  showLoginOverlay(true);
}

// Wire up on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // If the overlay markup isn’t present for some reason, don’t crash
  const form = $("#cc-login-form");
  if (form) form.addEventListener("submit", doLogin);

  // Optional: bind any "Logout" button you have
  $$("#logoutBtn, a[href='#logout'], .nav-logout, #logout").forEach(btn => {
    btn.addEventListener("click", doLogout);
  });

  // Start by checking if we already have a valid cookie
  checkSession();
});
