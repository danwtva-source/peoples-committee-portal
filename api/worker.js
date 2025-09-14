// Cloudflare Worker — Communities' Choice API
// Endpoints: POST /api/login, GET /api/me, POST /api/logout
// - Login accepts username + password1
// - Sets a signed cookie AND also returns a token (for browsers that block 3rd-party cookies)
// - /api/me will accept session from cookie OR Authorization: Bearer <token>

const COOKIE_NAME = "cc_session";
const COOKIE_MAX_DAYS = 30;

// ------------------------------ USERS (inline) ------------------------------
const users = [
  { "username": "tvaadmin",    "name": "TVA Admin",       "area": "ALL",       "role": "admin" },
  { "username": "bpaynter",    "name": "Boyd Paynter",    "area": "Blaenavon", "role": "member" },
  { "username": "klang",       "name": "Karen Lang",      "area": "Blaenavon", "role": "member" },
  { "username": "lwhite",      "name": "Louise White",    "area": "Blaenavon", "role": "member" },
  { "username": "mletch",      "name": "Melanie Letch",   "area": "Blaenavon", "role": "member" },
  { "username": "nlewis",      "name": "Nigel Lewis",     "area": "Blaenavon", "role": "member" },
  { "username": "scharles",    "name": "Sarah J Charles", "area": "Blaenavon", "role": "member" },
  { "username": "sdavies",     "name": "Steffan Davies",  "area": "Blaenavon", "role": "member" },
  { "username": "sford",       "name": "Sharon Ford",     "area": "Blaenavon", "role": "member" },
  { "username": "tgardner",    "name": "Terry Gardner",   "area": "Blaenavon", "role": "member" },
  { "username": "aanderson",   "name": "Alysha Anderson", "area": "Penygarn",  "role": "member" },
  { "username": "hdewar",      "name": "Heather Dewar",   "area": "Penygarn",  "role": "member" },
  { "username": "jbruton",     "name": "John Bruton",     "area": "Penygarn",  "role": "member" },
  { "username": "jcharles",    "name": "Joe Charles",     "area": "Penygarn",  "role": "member" },
  { "username": "lbevan",      "name": "Leighton Bevan",  "area": "Penygarn",  "role": "member" },
  { "username": "sbradley",    "name": "Sarah Bradley",   "area": "Penygarn",  "role": "member" },
  { "username": "brichardson", "name": "Bailey Richardson","area": "ALL",      "role": "admin"  },
  { "username": "dwatkins",    "name": "Dan Watkins",     "area": "ALL",       "role": "admin"  },
  { "username": "gjenkins",    "name": "Gabi Jenkins",    "area": "St Cadocs", "role": "member" },
  { "username": "mcock",       "name": "Mike Cock",       "area": "St Cadocs", "role": "member" },
  { "username": "sdalby",      "name": "Sonia Dalby",     "area": "St Cadocs", "role": "member" },
  { "username": "sgrudgings",  "name": "Sam Grudgings",   "area": "Thornhill & Upper Cwmbran", "role": "member" }
];

// --------------------------- Tiny signing helpers ---------------------------
const te = new TextEncoder();

function b64urlEncodeStr(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecodeStr(b64) {
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/"); while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return b64urlEncodeStr(bin);
}

async function makeToken(payload, secret, maxDays = COOKIE_MAX_DAYS) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxDays * 24 * 60 * 60;
  const body = { ...payload, iat: now, exp };
  const data = b64urlEncodeStr(JSON.stringify(body));
  const sig = await hmacSha256(secret, data);
  return `${data}.${sig}`;
}

async function parseToken(token, secret) {
  if (!token || token.indexOf(".") === -1) return null;
  const [data, sig] = token.split(".");
  const expected = await hmacSha256(secret, data);
  if (sig !== expected) return null;
  const payload = JSON.parse(b64urlDecodeStr(data));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ----------------------------- Cookie helpers ------------------------------
function setCookie(headers, value, days = COOKIE_MAX_DAYS) {
  const maxAge = days * 24 * 60 * 60;
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`
  );
}
function clearCookie(headers) {
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`
  );
}
async function readCookie(cookieHeader, secret) {
  const m = (cookieHeader || "").match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  return await parseToken(m[1], secret);
}

// Accept session from cookie OR Authorization: Bearer <token>
async function readSession(request, secret) {
  const c = await readCookie(request.headers.get("Cookie") || "", secret);
  if (c) return c;
  const auth = request.headers.get("Authorization") || "";
  const mm = auth.match(/^Bearer\s+(.+)$/i);
  if (mm) return await parseToken(mm[1], secret);
  return null;
}

// ------------------------------- CORS headers ------------------------------
function corsHeaders(origin, ALLOWED_ORIGIN) {
  // must not be "*" when we send credentials
  const allow = ALLOWED_ORIGIN || origin || "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
}

function json(obj, init = {}) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", ...init.headers });
  return new Response(JSON.stringify(obj), { ...init, headers });
}
function text(msg, status = 200, headers = {}) {
  return new Response(msg, { status, headers: new Headers(headers) });
}

// --------------------------------- WORKER ----------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const method = request.method.toUpperCase();

    const headers = new Headers({
      "Cache-Control": "no-store",
      ...corsHeaders(origin, env.ALLOWED_ORIGIN)
    });

    if (method === "OPTIONS") return new Response(null, { status: 204, headers });

    const SECRET = env.COOKIE_SECRET || "change-me";

    // ---------------------- GET /api/me ----------------------
    if (url.pathname === "/api/me" && method === "GET") {
      const session = await readSession(request, SECRET);
      if (!session) return text("Unauthorized", 401, headers);
      return json(
        { username: session.username, name: session.name, role: session.role, area: session.area },
        { status: 200, headers }
      );
    }

    // --------------------- POST /api/login -------------------
    if (url.pathname === "/api/login" && method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { body = {}; }
      const { username, password } = body || {};
      if (!username || !password) return text("Missing credentials", 400, headers);
      if (password !== "password1") return text("Invalid credentials", 401, headers);

      const row = users.find(u => String(u.username || "").toLowerCase() === String(username).toLowerCase());
      if (!row) return text("Unknown user", 401, headers);

      const payload = { username: row.username, name: row.name, role: row.role || "member", area: row.area };
      const token = await makeToken(payload, SECRET, COOKIE_MAX_DAYS);
      setCookie(headers, token);
      // return the token too (so the front-end can use Authorization header if cookies are blocked)
      return json({ ...payload, token }, { status: 200, headers });
    }

    // -------------------- POST /api/logout -------------------
    if (url.pathname === "/api/logout" && method === "POST") {
      clearCookie(headers);
      return text("OK", 200, headers);
    }

    return text("Not found", 404, headers);
  }
};
