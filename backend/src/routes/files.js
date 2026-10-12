import { Router } from 'express';
import { store } from '../lib/store.js';
import { assertRole } from '../auth/access.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId query param is required' });
    await assertRole(req.user.id, projectId, 'viewer');
    res.json({ files: await store.listFiles(projectId) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { projectId, path, content } = req.body || {};
    if (!projectId || !path) return res.status(400).json({ error: 'projectId and path are required' });
    await assertRole(req.user.id, projectId, 'editor');
    res.status(201).json({ file: await store.createFile({ projectId, path, content }) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const file = await store.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    await assertRole(req.user.id, file.projectId, 'viewer');
    res.json({ file });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const file = await store.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    await assertRole(req.user.id, file.projectId, 'editor');
    const { content } = req.body || {};
    if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' });
    res.json({ file: await store.updateFile(req.params.id, content) });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const file = await store.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    await assertRole(req.user.id, file.projectId, 'editor');
    await store.deleteFile(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
