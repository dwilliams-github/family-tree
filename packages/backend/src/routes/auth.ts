import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { hashPassword, verifyPassword, signToken } from '../services/authService.js';
import { sendInviteEmail } from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminOnly.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
});

const acceptSchema = z.object({
  password: z.string().min(8),
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName ?? undefined,
    });

    res.json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
    res.json({ id: user.id, email: user.email, role: user.role, displayName: user.displayName });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/invite  (admin only)
router.post('/invite', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { email } = inviteSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'A user with that email already exists' });
      return;
    }

    // Invalidate any existing pending invite for this address
    await prisma.invitation.updateMany({
      where: { email, acceptedAt: null },
      data: { expiresAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.invitation.create({
      data: { email, token, invitedBy: req.user!.sub, expiresAt },
    });

    await sendInviteEmail(email, token);

    res.status(201).json({ message: `Invitation sent to ${email}` });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/invite/:token
router.get('/invite/:token', async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      res.status(404).json({ error: 'Invalid or expired invitation' });
      return;
    }

    res.json({ email: invitation.email });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/invite/:token/accept
router.post('/invite/:token/accept', async (req, res, next) => {
  try {
    const { password } = acceptSchema.parse(req.body);

    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      res.status(404).json({ error: 'Invalid or expired invitation' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: invitation.email, passwordHash, role: 'USER' },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return newUser;
    });

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName ?? undefined,
    });

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
