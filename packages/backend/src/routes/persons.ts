import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminOnly.js';
import * as personService from '../services/personService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const personInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  birthName: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateOfDeath: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  placeOfBirth: z.string().optional(),
  placeOfDeath: z.string().optional(),
  bio: z.string().optional(),
  isLiving: z.boolean().optional(),
});

function handleNotFound(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw Object.assign(new Error('Person not found'), { status: 404 });
  }
  throw err;
}

// GET /api/persons/search?q=  — must come before /:id
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) { res.json([]); return; }
    res.json(await personService.searchPersons(q));
  } catch (err) { next(err); }
});

// GET /api/persons
router.get('/', requireAuth, async (_req, res, next) => {
  try { res.json(await personService.listPersons()); }
  catch (err) { next(err); }
});

// GET /api/persons/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try { res.json(await personService.getPerson(req.params.id)); }
  catch (err) { next(handleNotFound(err) as never); }
});

// POST /api/persons
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = personInputSchema.parse(req.body);
    const person = await personService.createPerson(input, req.user!.sub, req.ip);
    res.status(201).json(person);
  } catch (err) { next(err); }
});

// PUT /api/persons/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const input = personInputSchema.partial().parse(req.body);
    res.json(await personService.updatePerson(req.params.id, input, req.user!.sub, req.ip));
  } catch (err) { next(handleNotFound(err) as never); }
});

// DELETE /api/persons/:id  (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await personService.deletePerson(req.params.id, req.user!.sub, req.ip);
    res.status(204).end();
  } catch (err) { next(handleNotFound(err) as never); }
});

// GET /api/persons/:id/photo
router.get('/:id/photo', requireAuth, async (req, res, next) => {
  try {
    const photo = await personService.getPersonPhoto(req.params.id);
    if (!photo) { res.status(404).json({ error: 'No photo' }); return; }
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(photo.data);
  } catch (err) { next(handleNotFound(err) as never); }
});

// PUT /api/persons/:id/photo
router.put('/:id/photo', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const resized = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    await personService.setPersonPhoto(req.params.id, resized, 'image/jpeg', req.user!.sub, req.ip);
    res.status(204).end();
  } catch (err) { next(handleNotFound(err) as never); }
});

// DELETE /api/persons/:id/photo
router.delete('/:id/photo', requireAuth, async (req, res, next) => {
  try {
    await personService.deletePersonPhoto(req.params.id, req.user!.sub, req.ip);
    res.status(204).end();
  } catch (err) { next(handleNotFound(err) as never); }
});

export { router as personsRouter };
