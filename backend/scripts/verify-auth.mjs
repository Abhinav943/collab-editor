import http from 'node:http';
import config from '../src/config.js';
import { createApp } from '../src/app.js';

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

async function getToken() {
  if (process.env.TEST_TOKEN) return process.env.TEST_TOKEN;
  const { createAuthClient } = await import('@neondatabase/auth');
  const authClient = createAuthClient(config.neonAuthBaseUrl);
  const email = process.env.TEST_EMAIL || `demo+${Date.now()}@example.com`;
  const password = process.env.TEST_PASSWORD || 'password123';
  try { await authClient.signIn.email({ email, password }); }
  catch { await authClient.signUp.email({ email, password, name: 'Demo User' }); }
  try {
    const t = await authClient.token();
    const tok = t?.data?.token ?? t?.token;
    if (isJwt(tok)) return tok;
  } catch {}
  return null;
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port, path, method: 'GET', headers }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(createApp());
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const noAuth = await get(port, '/api/me');
console.log('no token   ->', noAuth.status, noAuth.body);

const token = await getToken();

if (token) {
  // ---------- diagnose the JWT ----------
  const { decodeProtectedHeader, decodeJwt, createRemoteJWKSet, jwtVerify } = await import('jose');
  const base = config.neonAuthBaseUrl.replace(/\/+$/, '');
  const expectedIssuer = new URL(base).origin;
  const jwksUrl = `${base}/.well-known/jwks.json`;

  console.log('JWT header :', JSON.stringify(decodeProtectedHeader(token)));
  const claims = decodeJwt(token);
  console.log('JWT iss    :', claims.iss);
  console.log('JWT aud    :', claims.aud);
  console.log('expected   :', expectedIssuer);
  console.log('jwks url   :', jwksUrl);

  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  try {
    await jwtVerify(token, jwks);
    console.log('verify (signature only) : OK');
  } catch (e) {
    console.log('verify (signature only) : FAILED ->', e.code || e.name, e.message);
  }
  try {
    await jwtVerify(token, jwks, { issuer: expectedIssuer });
    console.log('verify (with issuer)    : OK');
  } catch (e) {
    console.log('verify (with issuer)    : FAILED ->', e.code || e.name, e.message);
  }
  // ---------- end diagnose ----------

  const withAuth = await get(port, '/api/me', { authorization: `Bearer ${token}` });
  console.log('with token ->', withAuth.status, withAuth.body);
} else {
  console.log('(no JWT available)');
}

server.close();
process.exit(0);
