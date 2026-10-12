import http from 'node:http';
import { createApp } from '../src/app.js';
import { getToken } from './lib/token.mjs';


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
const tokenA = await getToken(`alice+${stamp}@example.com`);
const tokenB = await getToken(`bob+${stamp}@example.com`);
if (!tokenA || !tokenB) { console.log('could not mint two tokens'); process.exit(1); }

// A creates a project (becomes owner)
const created = await req('POST', '/api/projects', tokenA, { name: 'roles test' });
const pid = created.body.project.id;
console.log('A created project', pid.slice(0, 8));

// B has no access yet
console.log('B read (expect 403):', (await req('GET', `/api/projects/${pid}`, tokenB)).status);

// A adds B as viewer
await req('POST', `/api/projects/${pid}/members`, tokenA, { email: `bob+${stamp}@example.com`, role: 'viewer' });
console.log('B read as viewer (expect 200):', (await req('GET', `/api/projects/${pid}`, tokenB)).status);
console.log('B write as viewer (expect 403):', (await req('POST', '/api/files', tokenB, { projectId: pid, path: 'x.js', content: '' })).status);

// A promotes B to editor
await req('POST', `/api/projects/${pid}/members`, tokenA, { email: `bob+${stamp}@example.com`, role: 'editor' });
console.log('B write as editor (expect 201):', (await req('POST', '/api/files', tokenB, { projectId: pid, path: 'x.js', content: '' })).status);

server.close();
console.log('ROLES VERIFY DONE');
process.exit(0);
