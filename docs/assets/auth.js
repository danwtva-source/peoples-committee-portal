/* Communities' Choice – auth + scoring-matrix wiring (single file)
   Drop-in replacement for docs/assets/auth.js
*/

const API_BASE = "https://communities-choice-api.dan-w-tva.workers.dev";

// ---------- small utils ----------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function fetchJSON(url, opts={}) {
  return fetch(url, { credentials: 'include', ...opts }).then(async res => {
    const text = await res.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!res.ok) {
      const msg = body?.error || body?.message || text || res.statusText;
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  });
}

// Store token in sessionStorage (Worker also sets cookie)
function setToken(t){ try{sessionStorage.setItem('cc_token', t||'')}catch{} }
function getToken(){ try{return sessionStorage.getItem('cc_token')||''}catch{ return '' } }
function clearToken(){ try{sessionStorage.removeItem('cc_token')}catch{} }

// ---------- overlay UI ----------
function ensureOverlay() {
  if ($('#cc-login-overlay')) return;
  const el = document.createElement('div');
  el.id = 'cc-login-overlay';
  el.style.cssText = `
    position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.35);backdrop-filter:saturate(1.1) blur(2px);z-index:9999;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  `;
  el.innerHTML = `
    <form id="cc-login-card" style="width:min(560px,95vw);background:#fff;border-radius:16px;padding:24px;box-shadow:0 22px 60px rgba(0,0,0,.35)">
      <h2 style="margin:0 0 8px">Committee Portal Login</h2>
      <p style="margin:.25rem 0 1rem;color:#666">Please sign in with your username and password.</p>
      <label style="display:block;margin:.5rem 0 .25rem">Username</label>
      <input id="cc-username" type="text" required style="width:100%;padding:.65rem;border:1px solid #ddd;border-radius:10px">
      <label style="display:block;margin:.75rem 0 .25rem">Password</label>
      <input id="cc-password" type="password" required style="width:100%;padding:.65rem;border:1px solid #ddd;border-radius:10px">
      <div id="cc-error" style="color:#b91c1c;margin:.5rem 0 .25rem;min-height:1.25rem"></div>
      <button id="cc-submit" type="submit" style="margin-top:.25rem;width:100%;padding:.8rem;border:0;background:#0f172a;color:#fff;border-radius:12px;cursor:pointer">Sign in</button>
    </form>
  `;
  document.body.appendChild(el);
  $('#cc-login-card').addEventListener('submit', async (e)=>{
    e.preventDefault();
    $('#cc-error').textContent = '';
    const username = $('#cc-username').value.trim();
    const password = $('#cc-password').value;
    try {
      const body = JSON.stringify({ username, password });
      const data = await fetchJSON(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (data?.token) setToken(data.token);
      hideOverlay();
      onAuthenticated(data);
    } catch (err) {
      $('#cc-error').textContent = err.message || 'Login failed';
    }
  });
}
function showOverlay(){ ensureOverlay(); $('#cc-login-overlay').style.display='flex'; }
function hideOverlay(){ const el=$('#cc-login-overlay'); if (el) el.style.display='none'; }

// ---------- auth ----------
async function getMe() {
  try {
    const data = await fetchJSON(`${API_BASE}/api/me`, {
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : undefined
    });
    return data;
  } catch { return null; }
}

async function doLogout() {
  try { await fetchJSON(`${API_BASE}/api/logout`, { method:'POST' }); } catch {}
  clearToken();
  showOverlay();
}

// Bind logout to any of these selectors
function bindLogout() {
  const sel = ['#logoutBtn','a[href="#logout"]','.nav-logout','#logout'];
  sel.forEach(s=>{
    $$(s).forEach(a=>{
      a.addEventListener('click', (e)=>{ e.preventDefault(); doLogout(); });
    });
  });
}

// ---------- scoring matrix wiring (linked selects + pdf + total) ----------
const Matrix = (function(){
  let pbSel, appSel, viewBtn, matrix, totalEl, pdfDlg, pdfFrm, pdfTitle, pdfClose;
  let maps;

  const buildMaps = () => {
    const pbTo = new Map();
    const appTo = new Map();
    if (pbSel) [...pbSel.options].forEach(opt=>{
      if (!opt.value) return;
      pbTo.set(opt.value, {
        applicant: opt.dataset.applicant || "",
        area:      opt.dataset.area || "",
        pdf:       opt.dataset.pdf || ""
      });
    });
    if (appSel) [...appSel.options].forEach(opt=>{
      if (!opt.value) return;
      appTo.set(opt.value, {
        pb:   opt.dataset.pb || "",
        area: opt.dataset.area || "",
        pdf:  opt.dataset.pdf || ""
      });
    });
    return { pbTo, appTo };
  };

  const openPdf = (url, title) => {
    if (!url) { alert('No PDF available for this application'); return; }
    if (pdfFrm) pdfFrm.src = url;
    if (pdfTitle) pdfTitle.textContent = title || 'Application PDF';
    if (pdfDlg && typeof pdfDlg.showModal === 'function') pdfDlg.showModal();
    else if (pdfDlg) pdfDlg.style.display = 'block';
    else window.open(url, '_blank', 'noopener');
  };
  const closePdf = () => {
    try { pdfDlg?.close(); } catch{}; if (pdfDlg) pdfDlg.style.display='none'; if (pdfFrm) pdfFrm.src='about:blank';
  };

  const recalcTotal = () => {
    if (!matrix || !totalEl) return;
    const inputs = $$('.criterion-input', matrix);
    let sum = 0;
    for (const i of inputs) sum += Number(i.value || 0);
    totalEl.textContent = String(sum);
  };

  const renderMatrixFor = () => {
    if (!matrix) return;
    matrix.classList.remove('hidden','is-hidden');
    matrix.style.removeProperty('display');
    recalcTotal();
  };

  const syncFromPb = () => {
    if (!pbSel || !appSel) return;
    const rec = maps.pbTo.get(pbSel.value);
    if (!rec) return;
    for (const o of appSel.options) if (o.value === rec.applicant) { appSel.value = o.value; break; }
    renderMatrixFor();
  };

  const syncFromApp = () => {
    if (!pbSel || !appSel) return;
    const rec = maps.appTo.get(appSel.value);
    if (!rec) return;
    for (const o of pbSel.options) if (o.value === rec.pb) { pbSel.value = o.value; break; }
    renderMatrixFor();
  };

  const wire = () => {
    pbSel   = $('#pbRefSelect');
    appSel  = $('#applicantSelect');
    viewBtn = $('#viewPdfBtn');
    matrix  = $('#matrixContainer');
    totalEl = $('#totalScore');

    pdfDlg  = $('#pdfDialog');
    pdfFrm  = $('#pdfFrame');
    pdfTitle= $('#pdfTitle');
    pdfClose= $('#pdfCloseBtn');

    if (!pbSel && !appSel) return;    // not on matrix page
    maps = buildMaps();

    pbSel?.addEventListener('change', syncFromPb);
    appSel?.addEventListener('change', syncFromApp);

    viewBtn?.addEventListener('click', ()=>{
      const fromPb = maps.pbTo.get(pbSel?.value || '');
      const fromAp = maps.appTo.get(appSel?.value || '');
      const url = (fromPb?.pdf || fromAp?.pdf || '').trim();
      const ttl = (fromPb?.applicant || appSel?.value || 'Application PDF');
      openPdf(url, ttl);
    });
    pdfClose?.addEventListener('click', closePdf);

    $$('.criterion-input', matrix).forEach(i=>{
      i.addEventListener('input', recalcTotal);
      i.addEventListener('change', recalcTotal);
    });

    // initialize
    if (pbSel?.value) syncFromPb();
    else if (appSel?.value) syncFromApp();
  };

  // public
  return {
    wire,

    // Called by area filter
    filterByArea(area, role){
      const showAll = (role === 'admin' || area === 'ALL');
      function filterSelect(sel, getArea){
        if (!sel) return;
        [...sel.options].forEach(opt=>{
          const optArea = getArea(opt);
          const show = showAll || (optArea === area) || (optArea === 'Cross-Area') || (optArea === 'ALL');
          opt.hidden = !show;
        });
        const first = [...sel.options].find(o=>!o.hidden);
        if (first) sel.value = first.value;
      }
      filterSelect($('#pbRefSelect'),  o => o.dataset.area || '');
      filterSelect($('#applicantSelect'), o => o.dataset.area || '');
      maps = buildMaps();
      if ($('#pbRefSelect')?.value) syncFromPb(); else if ($('#applicantSelect')?.value) syncFromApp();
    }
  };
})();

// ---------- hooks called after login ----------
function onAuthenticated(me) {
  // welcome name if you have it
  const w = $('#welcomeName'); if (w) w.textContent = me?.name || '';

  // area filter (admins see all)
  Matrix.filterByArea(me?.area || '', me?.role || 'member');

  // (re)wire scoring page features
  Matrix.wire();

  bindLogout();
}

async function bootstrap() {
  bindLogout();
  const me = await getMe();
  if (me) {
    hideOverlay();
    onAuthenticated(me);
  } else {
    showOverlay();
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
