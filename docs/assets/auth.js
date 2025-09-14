// Front-end auth for Communities' Choice Portal
// Sends login as x-www-form-urlencoded to avoid CORS preflight.
// Falls back to Bearer token if third-party cookies are blocked.

const API_BASE = "https://communities-choice-api.dan-w-tva.workers.dev";

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function ensureOverlay(){
  if ($("#cc-login-overlay")) return;
  const w=document.createElement("div");
  w.innerHTML=`
  <div id="cc-login-overlay" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;">
    <div style="background:#fff;border-radius:16px;width:min(520px,92vw);padding:24px 24px 28px;box-shadow:0 30px 60px rgba(0,0,0,.25);">
      <h2 style="margin:0 0 8px;font-family:system-ui,sans-serif">Committee Portal Login</h2>
      <p style="margin:0 18px 18px 0;color:#555">Please sign in with your username and password.</p>
      <form id="cc-login-form">
        <label style="display:block;font-weight:600;margin:10px 0 6px;">Username</label>
        <input id="cc-username" autocomplete="username" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:10px" />
        <label style="display:block;font-weight:600;margin:16px 0 6px;">Password</label>
        <input id="cc-password" type="password" autocomplete="current-password" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:10px" />
        <div id="cc-login-error" style="color:#c00;margin:8px 0 0;display:none"></div>
        <button type="submit" style="margin-top:14px;width:100%;padding:12px 14px;border:0;border-radius:12px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer">Sign in</button>
      </form>
    </div>
  </div>`;
  document.body.appendChild(w.firstElementChild);
}
function showLoginOverlay(show){ const o=$("#cc-login-overlay"); if(o) o.style.display=show?"flex":"none"; }
function setError(m){ const e=$("#cc-login-error"); if(e){ e.textContent=m||""; e.style.display=m?"block":"none"; } }

// token helper (fallback when cookies blocked)
const TOKEN_KEY="cc_token";
const getToken=()=>sessionStorage.getItem(TOKEN_KEY)||"";
const setToken=t=>{ if(t) sessionStorage.setItem(TOKEN_KEY,t); };
const clearToken=()=>sessionStorage.removeItem(TOKEN_KEY);
const authHeaders=()=>{ const h={}; const t=getToken(); if(t) h["Authorization"]=`Bearer ${t}`; return h; };

function afterAuth(me){
  if (window.applyAreaFilter) window.applyAreaFilter(me.area, me.role);
  if (window.setCommitteeUser) window.setCommitteeUser(me);
  setError(""); showLoginOverlay(false);
}

async function checkSession(){
  ensureOverlay();
  try{
    const r=await fetch(`${API_BASE}/api/me`, { credentials:"include", headers:authHeaders() });
    if(!r.ok){ showLoginOverlay(true); return; }
    const me=await r.json(); afterAuth(me);
  }catch{ showLoginOverlay(true); setError("Failed to reach sign-in service."); }
}

async function doLogin(e){
  e.preventDefault(); setError("");
  const username=$("#cc-username")?.value?.trim()||""; const password=$("#cc-password")?.value||"";
  if(!username||!password){ setError("Please enter username and password."); return; }

  try{
    // FORM body to avoid preflight
    const body=new URLSearchParams({ username, password });
    const r=await fetch(`${API_BASE}/api/login`, {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" },
      credentials:"include",
      body
    });
    if(!r.ok){ setError(await r.text()||"Login failed."); return; }

    const data=await r.clone().json().catch(()=>null);
    if(data && data.token) setToken(data.token);

    const meRes=await fetch(`${API_BASE}/api/me`, { credentials:"include", headers:authHeaders() });
    if(!meRes.ok){ setError("Could not load profile."); return; }
    const me=await meRes.json(); afterAuth(me);
  }catch{ setError("Failed to fetch"); }
}

async function doLogout(e){ if(e) e.preventDefault(); clearToken(); try{ await fetch(`${API_BASE}/api/logout`, { method:"POST", credentials:"include" }); }catch{} showLoginOverlay(true); }

document.addEventListener("DOMContentLoaded", () => {
  ensureOverlay();
  $("#cc-login-form")?.addEventListener("submit", doLogin);
  [ "#logoutBtn", "a[href='#logout']", ".nav-logout", "#logout" ].forEach(sel => $$(sel).forEach(b=>b.addEventListener("click", doLogout)));
  checkSession();
});

window.ccShowLogin = () => { ensureOverlay(); showLoginOverlay(true); };
