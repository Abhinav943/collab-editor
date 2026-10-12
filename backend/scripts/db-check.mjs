import { prisma } from '../src/lib/prisma.js';

async function tryConnect(n) {
  for (let i = 1; i <= n; i++) {
    try {
      await prisma.$connect();
      console.log(`DB OK (attempt ${i})`);
      return true;
    } catch (e) {
      console.log(`attempt ${i} failed:`, e.message.split('\n')[0]);
      await new Promise((r) => setTimeout(r, 2000)); // give Neon time to wake
    }
  }
  return false;
}

const ok = await tryConnect(3);
await prisma.$disconnect();
process.exit(ok ? 0 : 1);
