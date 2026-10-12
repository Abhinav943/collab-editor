import http from 'node:http';
import { createApp } from '../src/app.js';
import { getToken } from './lib/token.mjs';
import { prisma } from '../src/lib/prisma.js';

// for (let i = 1; i <= 5; i++) {
//   try { await prisma.$connect(); console.log('db ready'); break; }
//   catch { await new Promise((r) => setTimeout(r, 2000)); }
// }

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

const token = await getToken(`ai+${Date.now()}@example.com`);
const created = await req('POST', '/api/projects', token, { name: 'ai test' });
const pid = created.body.project.id;

console.log('--- generate ---');
const g = await req('POST', '/api/ai/generate', token, {
  projectId: pid, language: 'javascript', prompt: 'Write a function that reverses a string.',
});
console.log(g.status, JSON.stringify(g.body.code || g.body).slice(0, 200));

console.log('--- explain ---');
const e = await req('POST', '/api/ai/explain', token, {
  projectId: pid, language: 'javascript',
  code: 'const x = ;', error: 'SyntaxError: Unexpected token ;',
});
console.log(e.status, JSON.stringify(e.body.explanation || e.body).slice(0, 200));

server.close();
console.log('AI VERIFY DONE');
process.exit(0);
