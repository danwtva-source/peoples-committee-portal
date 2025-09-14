const users = [
  { "username": "tvaadmin", "name": "TVA Admin", "area": "ALL", "role": "admin" },
  { "username": "bpaynter", "name": "Boyd Paynter", "area": "Blaenavon", "role": "member" },
  { "username": "klang", "name": "Karen Lang", "area": "Blaenavon", "role": "member" },
  { "username": "lwhite", "name": "Louise White", "area": "Blaenavon", "role": "member" },
  { "username": "mletch", "name": "Melanie Letch", "area": "Blaenavon", "role": "member" },
  { "username": "nlewis", "name": "Nigel Lewis", "area": "Blaenavon", "role": "member" },
  { "username": "scharles", "name": "Sarah J Charles", "area": "Blaenavon", "role": "member" },
  { "username": "sdavies", "name": "Steffan Davies", "area": "Blaenavon", "role": "member" },
  { "username": "sford", "name": "Sharon Ford", "area": "Blaenavon", "role": "member" },
  { "username": "tgardner", "name": "Terry Gardner", "area": "Blaenavon", "role": "member" },
  { "username": "aanderson", "name": "Alysha Anderson", "area": "Penygarn", "role": "member" },
  { "username": "hdewar", "name": "Heather Dewar", "area": "Penygarn", "role": "member" },
  { "username": "jbruton", "name": "John Bruton", "area": "Penygarn", "role": "member" },
  { "username": "jcharles", "name": "Joe Charles", "area": "Penygarn", "role": "member" },
  { "username": "lbevan", "name": "Leighton Bevan", "area": "Penygarn", "role": "member" },
  { "username": "sbradley", "name": "Sarah Bradley", "area": "Penygarn", "role": "member" },
  { "username": "brichardson", "name": "Bailey Richardson", "area": "ALL", "role": "admin" },
  { "username": "dwatkins", "name": "Dan Watkins", "area": "ALL", "role": "admin" },
  { "username": "gjenkins", "name": "Gabi Jenkins", "area": "St Cadocs", "role": "member" },
  { "username": "mcock", "name": "Mike Cock", "area": "St Cadocs", "role": "member" },
  { "username": "sdalby", "name": "Sonia Dalby", "area": "St Cadocs", "role": "member" },
  { "username": "sgrudgings", "name": "Sam Grudgings", "area": "Thornhill & Upper Cwmbran", "role": "member" }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const method = request.method.toUpperCase();

    const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || "";
    const COOKIE_SECRET = env.COOKIE_SECRET || "change-me";

    function corsHeaders() {
      const allow = (origin && ALLOWED_ORIGIN && origin.startsWith(ALLOWED_ORIGIN)) ? origin : (ALLOWED_ORIGIN || "https://danwtva-source.github.io");
      return {
        "Access-Control-Allow-Origin": allow,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      };
    }
    const headers = new Headers({ "Cache-Control": "no-store", ...corsHeaders() });

    if (method === "OPTIONS") return new Response(null, { status: 204, headers });

    const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers: new Headers({ "Content-Type": "application/json", ...corsHeaders() }) });
    const text = (t, status=200) => new Response(t, { status, headers });

    async function hmac(data) {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", enc.encode(COOKIE_SECRET), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
      return btoa(String.fromCharCode(...new Uint8Array(sig)));
    }
    async function makeCookie(payload) {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const sig = await hmac(data);
      return `${data}.${sig}`;
    }
    async function readCookie(cookie) {
      const [data, sig] = (cookie||"").split(".",2);
      if(!data||!sig) return null;
      const expect = await hmac(data);
      if(sig!==expect) return null;
      try { return JSON.parse(decodeURIComponent(escape(atob(data)))); } catch { return null; }
    }
    function setCookie(h, val) {
      h.append("Set-Cookie", `cc_session=${val}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`);
    }
    function clearCookie(h) {
      h.append("Set-Cookie", `cc_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`);
    }

    if (url.pathname === "/api/me" && method === "GET") {
      const raw = (request.headers.get("Cookie")||"").split(";").find(s=>s.trim().startsWith("cc_session="));
      const cookieVal = raw ? raw.split("=",2)[1] : "";
      const session = await readCookie(cookieVal);
      if (!session) return text("Unauthorized", 401);
      return json({ username: session.username, name: session.name, role: session.role, area: session.area });
    }

    if (url.pathname === "/api/login" && method === "POST") {
      const body = await request.json().catch(()=> ({}));
      const { username, password } = body || {};
      if (!username || !password) return text("Missing credentials", 400);
      if (password !== "password1") return text("Invalid credentials", 401);
      const row = users.find(u => (u.username||"").toLowerCase() === String(username).toLowerCase());
      if (!row) return text("Unknown user", 401);
      const payload = { username: row.username, name: row.name, role: row.role||"member", area: row.area };
      const cookie = await makeCookie(payload);
      setCookie(headers, cookie);
      return json(payload);
    }

    if (url.pathname === "/api/logout" && method === "POST") {
      clearCookie(headers);
      return text("OK");
    }

    return text("Not found", 404);
  }
}
