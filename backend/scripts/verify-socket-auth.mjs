import http from 'node:http';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { getToken } from './lib/token.mjs';

const server = http.createServer(createApp());
createSocketServer(server);
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}`;
console.log('server on', url);

function connect(auth) {
  return new Promise((resolve) => {
    const s = ioClient(url, { auth, transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve({ ok: true, socket: s }));
    s.on('connect_error', (e) => { s.close(); resolve({ ok: false, error: e.message }); });
    setTimeout(() => { s.close(); resolve({ ok: false, error: 'timeout' }); }, 5000);
  });
}

// Negative: no token must be rejected (run with ALLOW_GUEST unset/false).
const anon = await connect({});
console.log('no token    ->', anon.ok ? 'CONNECTED (bad!)' : `rejected: ${anon.error}`);

// Positive: a real token connects and the server reports the user.
const token = await getToken();
let user = null;
if (token) {
  const auth = await connect({ token });
  if (auth.ok) {
    user = await new Promise((res) => {
      auth.socket.on('session', ({ user }) => res(user));
      setTimeout(() => res(null), 3000);
    });
    auth.socket.close();
  }
  console.log('with token  ->', auth.ok ? 'connected' : `rejected: ${auth.error}`);
  console.log('session user->', JSON.stringify(user));
} else {
  console.log('(no token minted; skipping positive test)');
}

server.close();
console.log(!anon.ok && (!token || (user && user.id)) ? 'SOCKET AUTH VERIFY OK' : 'SOCKET AUTH VERIFY FAILED');
process.exit(0);
