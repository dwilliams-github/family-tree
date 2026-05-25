import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getFullTree, getSubtree } from '../services/treeService.js';

const router = Router();

// GET /api/tree
router.get('/', requireAuth, async (_req, res, next) => {
  try { res.json(await getFullTree()); }
  catch (err) { next(err); }
});

// GET /api/tree/:personId
router.get('/:personId', requireAuth, async (req, res, next) => {
  try { res.json(await getSubtree(req.params.personId)); }
  catch (err) { next(err); }
});

export { router as treeRouter };
