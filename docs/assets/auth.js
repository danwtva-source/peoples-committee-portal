const API_BASE = "https://communities-choice-api.dan-w-tva.workers.dev";
const CROSS_AREA_LABEL = "Cross-Area";

function el(html){const d=document.createElement("div");d.innerHTML=html.trim();return d.firstElementChild}
function showOverlay(){document.documentElement.classList.add("cc-auth-pending");const ov=document.getElementById("cc-login-overlay");ov.style.display="flex"}
function hideOverlay(){document.documentElement.classList.remove("cc-auth-pending");const ov=document.getElementById("cc-login-overlay");ov.style.display="none"}

function applyAreaFilter(profile){
  if(!profile || profile.role==="admin"){hideOverlay();return}
  const allowedAreas=new Set([profile.area, CROSS_AREA_LABEL]);
  const areaNames=["Blaenavon","Thornhill & Upper Cwmbran","Trevethin","Penygarn","St Cadocs"];

  const navLinks=Array.from(document.querySelectorAll("a, button"));
  navLinks.forEach(a=>{
    const t=(a.textContent||"").trim();
    const matchesKnown=areaNames.some(n=>t.includes(n));
    if(matchesKnown && ![...allowedAreas].some(n=>t.includes(n))){
      (a.closest("li, a, button")||a).style.display="none";
    }
  });

  const containers=Array.from(document.querySelectorAll("[data-app], .application-row, .application-card, tr, li"));
  containers.forEach(node=>{
    const txt=(node.textContent||"").toLowerCase();
    const hasMarkers=txt.includes("area") && (txt.includes("applicant")||txt.includes("ref"));
    if(!hasMarkers) return;
    const allowed=[...allowedAreas].some(area=>txt.includes(area.toLowerCase()));
    if(!allowed){ node.style.display="none"; }
  });

  const selects=Array.from(document.querySelectorAll("select"));
  selects.forEach(sel=>{
    Array.from(sel.options).forEach(opt=>{
      const t=(opt.text||opt.label||"").toLowerCase();
      const looksLikeArea=["blaenavon","thornhill","upper cwmbran","trevethin","penygarn","st cadocs","cross-area"].some(k=>t.includes(k));
      if(looksLikeArea){
        const ok=[...allowedAreas].some(area=>t.includes(area.toLowerCase()));
        if(!ok) opt.remove();
      }
    });
  });

  hideOverlay();
}

async function fetchJSON(url, opts={}){
  const res=await fetch(url,{credentials:"include",...opts});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function tryRestoreSession(){
  try{ const me=await fetchJSON(`${API_BASE}/api/me`); applyAreaFilter(me); }
  catch(e){ showOverlay(); }
}

async function handleLogin(ev){
  ev.preventDefault();
  const u=document.getElementById("cc-username").value.trim();
  const p=document.getElementById("cc-password").value;
  const err=document.getElementById("cc-login-err"); err.textContent="";
  try{
    const res=await fetch(`${API_BASE}/api/login`,{
      method:"POST",credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username:u,password:p})
    });
    if(!res.ok){ throw new Error(await res.text()||"Login failed"); }
    const me=await res.json();
    applyAreaFilter(me);
  }catch(e){ err.textContent=e.message||"Invalid credentials"; }
}

function injectLoginOverlay(){
  const overlay=el(`
    <div id="cc-login-overlay" role="dialog" aria-modal="true">
      <div id="cc-login-card">
        <h2>Committee Portal Login</h2>
        <p>Please sign in with your username and password.</p>
        <form id="cc-login-form">
          <label for="cc-username">Username</label>
          <input id="cc-username" name="username" type="text" autocomplete="username" required />
          <label for="cc-password">Password</label>
          <input id="cc-password" name="password" type="password" autocomplete="current-password" required />
          <button id="cc-login-btn" type="submit">Sign in</button>
          <div id="cc-login-err" aria-live="polite"></div>
        </form>
      </div>
    </div>`);
  document.body.appendChild(overlay);
  document.getElementById("cc-login-form").addEventListener("submit", handleLogin);
}

window.addEventListener("DOMContentLoaded", ()=>{
  injectLoginOverlay();
  document.documentElement.classList.add("cc-auth-pending");
  tryRestoreSession();
});
