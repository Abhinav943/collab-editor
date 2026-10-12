import config from '../../src/config.js';

const TEST_ORIGIN = process.env.TEST_ORIGIN || 'http://localhost:3000';
const jar = new Map();
const _fetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Origin', TEST_ORIGIN);
  if (jar.size) headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  const res = await _fetch(input, { ...init, headers });
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookies) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return res;
};

const isJwt = (s) => typeof s === 'string' && s.split('.').length === 3;

// "fetch failed" hides the real reason in e.cause — surface it.
function describe(e) {
  const c = e?.cause;
  return `${e.message}${c ? ` (cause: ${c.code || c.message})` : ''}`;
}

// Retry transient network blips a couple of times.
async function attempt(fn) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try { return { ok: true, value: await fn() }; }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 400 * i)); }
  }
  return { ok: false, error: last };
}

export async function getToken(emailOverride) {
  if (process.env.TEST_TOKEN) return process.env.TEST_TOKEN;
  jar.clear(); // fresh session per user

  const { createAuthClient } = await import('@neondatabase/auth');
  const authClient = createAuthClient(config.neonAuthBaseUrl);
  const email = emailOverride || process.env.TEST_EMAIL || `demo+${Date.now()}@example.com`;
  const password = process.env.TEST_PASSWORD || 'password123';

  let signedIn = (await attempt(() => authClient.signIn.email({ email, password }))).ok;
  if (!signedIn) {
    const up = await attempt(() => authClient.signUp.email({ email, password, name: email.split('@')[0] }));
    if (!up.ok) {
      console.log(`  sign-up failed for ${email}: ${describe(up.error)}`);
      return null;
    }
  }

  const t = await attempt(() => authClient.token());
  if (t.ok) {
    const tok = t.value?.data?.token ?? t.value?.token;
    if (isJwt(tok)) return tok;
    console.log(`  token() did not return a JWT for ${email}`);
  } else {
    console.log(`  token() failed for ${email}: ${describe(t.error)}`);
  }
  return null;
}
