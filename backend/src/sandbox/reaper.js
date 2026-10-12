import { logger } from '../lib/logger.js';
import { reapIdleSandboxes } from './sandbox.js';

const MAX_IDLE_MS = 15 * 60 * 1000;   // close after 15 min quiet
const INTERVAL_MS = 5 * 60 * 1000;

export function startSandboxReaper() {
  const timer = setInterval(async () => {
    try {
      const killed = await reapIdleSandboxes(MAX_IDLE_MS);
      if (killed) logger.info(`sandbox reaper: closed ${killed} idle sandbox(es)`);
    } catch (e) {
      logger.error('sandbox reaper failed:', e.message);
    }
  }, INTERVAL_MS);
  timer.unref?.();
  return timer;
}
