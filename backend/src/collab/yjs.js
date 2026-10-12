import { YSocketIO } from 'y-socket.io/dist/server';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { userForToken } from '../auth/tokenCache.js';

/** The shared text a room's document holds (room name === file id). */
function sharedText(doc) {
  const inner = typeof doc.getText === 'function' ? doc : doc.ydoc;
  return inner.getText('monaco');
}

export function createCollabServer(io) {
  const ysocketio = new YSocketIO(io, {
    authenticate: (handshake) => {
      const token = handshake?.auth?.token;
      return Boolean(token && userForToken(token));
    },
  });
  ysocketio.initialize();

  // Seed the room from Postgres ONCE, when the room is created.
  ysocketio.on('document-loaded', async (doc) => {
    try {
      const file = await prisma.file.findUnique({ where: { id: doc.name } });
      if (!file?.content) return;
      const ytext = sharedText(doc);
      if (ytext.length === 0) ytext.insert(0, file.content);
    } catch (e) {
      logger.error('yjs seed failed:', e.message);
    }
  });

  // Flush the room to Postgres when the last client leaves.
  ysocketio.on('all-document-connections-closed', async (doc) => {
    try {
      const ytext = sharedText(doc);
      await prisma.file.update({ where: { id: doc.name }, data: { content: ytext.toString() } });
    } catch (e) {
      logger.debug('yjs flush skipped:', e.message);
    }
  });

  return ysocketio;
}
