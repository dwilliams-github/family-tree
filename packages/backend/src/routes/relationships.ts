import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import * as relService from '../services/relationshipService.js';

const router = Router();

const relationshipInputSchema = z.object({
  personAId: z.string().uuid(),
  personBId: z.string().uuid(),
  type: z.enum(['parent_child', 'spouse', 'sibling']),
  personARole: z.string().optional(),
  personBRole: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

function handleNotFound(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') throw Object.assign(new Error('Relationship not found'), { status: 404 });
    if (err.code === 'P2002') throw Object.assign(new Error('Relationship already exists'), { status: 409 });
    if (err.code === 'P2003') throw Object.assign(new Error('One or both persons not found'), { status: 400 });
  }
  throw err;
}

// GET /api/relationships
router.get('/', requireAuth, async (_req, res, next) => {
  try { res.json(await relService.listRelationships()); }
  catch (err) { next(err); }
});

// GET /api/relationships/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try { res.json(await relService.getRelationship(req.params.id)); }
  catch (err) { next(handleNotFound(err) as never); }
});

// POST /api/relationships
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = relationshipInputSchema.parse(req.body);
    const rel = await relService.createRelationship(input, req.user!.sub, req.ip);
    res.status(201).json(rel);
  } catch (err) { next(handleNotFound(err) as never); }
});

// PUT /api/relationships/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const input = relationshipInputSchema.partial().parse(req.body);
    res.json(await relService.updateRelationship(req.params.id, input, req.user!.sub, req.ip));
  } catch (err) { next(handleNotFound(err) as never); }
});

// DELETE /api/relationships/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await relService.deleteRelationship(req.params.id, req.user!.sub, req.ip);
    res.status(204).end();
  } catch (err) { next(handleNotFound(err) as never); }
});

export { router as relationshipsRouter };
