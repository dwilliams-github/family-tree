import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminOnly.js';
import { undoLastChange } from '../services/auditService.js';
import type { AuditEntry } from '@family-tree/shared';

const router = Router();

function toAuditEntry(row: {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  performedBy: string;
  performer: { email: string };
  previousState: unknown;
  newState: unknown;
  changedFields: string[];
  ipAddress: string | null;
  createdAt: Date;
}): AuditEntry {
  return {
    id: row.id,
    tableName: row.tableName as AuditEntry['tableName'],
    recordId: row.recordId,
    action: row.action as AuditEntry['action'],
    performedBy: row.performedBy,
    performedByEmail: row.performer.email,
    previousState: (row.previousState as Record<string, unknown>) ?? undefined,
    newState: (row.newState as Record<string, unknown>) ?? undefined,
    changedFields: row.changedFields,
    ipAddress: row.ipAddress ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/audit?page=1&limit=50  (admin)
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'))));

    const [total, rows] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: { performer: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      total,
      page,
      limit,
      entries: rows.map(toAuditEntry),
    });
  } catch (err) { next(err); }
});

// GET /api/audit/record/:recordId  (admin)
router.get('/record/:recordId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { recordId: req.params.recordId },
      include: { performer: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(toAuditEntry));
  } catch (err) { next(err); }
});

// POST /api/audit/record/:recordId/undo  (any auth'd user, own last change only)
router.post('/record/:recordId/undo', requireAuth, async (req, res, next) => {
  try {
    await undoLastChange(req.params.recordId, req.user!.sub, req.ip);
    res.status(204).end();
  } catch (err) { next(err); }
});

export { router as auditRouter };
