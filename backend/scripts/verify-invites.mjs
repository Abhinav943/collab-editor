import http from 'node:http';
import { createApp } from '../src/app.js';
import { getToken } from './lib/token.mjs';
import { prisma } from '../src/lib/prisma.js';

for (let i = 1; i <= 5; i++) {
  try { await prisma.$connect(); console.log('db ready'); break; }
  catch (e) { await new Promise((r) => setTimeout(r, 2000)); }
}

const server = http.createServer(createApp());
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: 'localhost', port, path, method,
        headers: { ...(data ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b ? JSON.parse(b) : {} })); },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const stamp = Date.now();
const aliceEmail = `alice+${stamp}@example.com`;
const bobEmail = `bob+${stamp}@example.com`;
const tokenA = await getToken(aliceEmail);
const tokenB = await getToken(bobEmail);

const created = await req('POST', '/api/projects', tokenA, { name: 'invite test' });
const pid = created.body.project.id;
console.log('project', pid.slice(0, 8));

// Alice invites Bob as editor
const inv = await req('POST', `/api/projects/${pid}/invites`, tokenA, { email: bobEmail, role: 'editor' });
console.log('invite created (expect 201):', inv.status);
const inviteToken = inv.body.acceptUrl?.split('/').pop();

// Bob previews + accepts
console.log('preview (expect 200):', (await req('GET', `/api/invites/${inviteToken}`, tokenB)).status);
console.log('accept (expect 200):', (await req('POST', `/api/invites/${inviteToken}/accept`, tokenB)).status);
console.log('Bob reads project (expect 200):', (await req('GET', `/api/projects/${pid}`, tokenB)).status);
console.log('Bob writes file (expect 201):', (await req('POST', '/api/files', tokenB, { projectId: pid, path: 'y.js', content: '' })).status);

// Reusing the same invite must fail
console.log('reuse invite (expect 404):', (await req('POST', `/api/invites/${inviteToken}/accept`, tokenB)).status);

server.close();
console.log('INVITES VERIFY DONE');
process.exit(0);
