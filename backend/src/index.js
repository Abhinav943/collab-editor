import http from "node:http";
import config from "./config.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import { createSocketServer } from "./socket/index.js";
import { prisma } from "./lib/prisma.js";
import { startSandboxReaper } from "./sandbox/reaper.js";

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

startSandboxReaper();

server.listen(config.port, () => {
  logger.info(
    `backend listening on http://localhost:${config.port} (${config.nodeEnv})`,
  );
  logger.info(`allowed origins: ${config.clientOrigins.join(", ")}`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  io.close();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
