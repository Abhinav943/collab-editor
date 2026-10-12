import http from "node:http";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";
import { createApp } from "../src/app.js";
import { createSocketServer } from "../src/socket/index.js";

const app = createApp();
const server = http.createServer(app);
createSocketServer(server);
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}`;
console.log("server on", url);

const docA = new Y.Doc();
const docB = new Y.Doc();
const a = new SocketIOProvider(url, "verify-room", docA, {
  autoConnect: false,
});
const b = new SocketIOProvider(url, "verify-room", docB, {
  autoConnect: false,
});

let synced = 0;
a.on("sync", (s) => {
  if (s) synced++;
});
b.on("sync", (s) => {
  if (s) synced++;
});
a.connect();
b.connect();

await new Promise((res) => {
  const iv = setInterval(() => {
    if (synced >= 2) {
      clearInterval(iv);
      res();
    }
  }, 100);
});
console.log("both clients synced");

docA.getText("monaco").insert(0, 'console.log("synced")');
await new Promise((r) => setTimeout(r, 400));

const got = docB.getText("monaco").toString();
console.log("B received:", JSON.stringify(got));
if (got !== 'console.log("synced")') {
  console.error("FAIL: edit did not propagate");
  process.exit(1);
}
console.log("COLLAB VERIFY OK");
process.exit(0);
