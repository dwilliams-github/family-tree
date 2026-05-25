import { Prisma, AuditTable, AuditAction } from '@prisma/client';
import { prisma } from '../db/client.js';

export async function logAudit(
  tx: Prisma.TransactionClient,
  params: {
    tableName: AuditTable;
    recordId: string;
    action: AuditAction;
    performedBy: string;
    previousState?: Record<string, unknown> | null;
    newState?: Record<string, unknown> | null;
    changedFields?: string[];
    ipAddress?: string;
  }
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tableName: params.tableName,
      recordId: params.recordId,
      action: params.action,
      performedBy: params.performedBy,
      previousState: (params.previousState as Prisma.InputJsonValue) ?? Prisma.DbNull,
      newState: (params.newState as Prisma.InputJsonValue) ?? Prisma.DbNull,
      changedFields: params.changedFields ?? [],
      ipAddress: params.ipAddress,
    },
  });
}

// Apply the inverse of the most recent audit entry for a given record.
// Only the user who made the last change may undo it.
export async function undoLastChange(
  recordId: string,
  requestingUserId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.auditLog.findFirst({
      where: { recordId },
      orderBy: { createdAt: 'desc' },
    });

    if (!entry) throw Object.assign(new Error('No audit history found for this record'), { status: 404 });
    if (entry.performedBy !== requestingUserId) {
      throw Object.assign(new Error('You can only undo your own last change'), { status: 403 });
    }

    const prev = entry.previousState as Record<string, unknown> | null;
    const curr = entry.newState as Record<string, unknown> | null;

    if (entry.tableName === AuditTable.persons) {
      if (entry.action === AuditAction.INSERT) {
        await tx.person.delete({ where: { id: recordId } });
      } else if (entry.action === AuditAction.UPDATE && prev) {
        await tx.person.update({
          where: { id: recordId },
          data: deserializePersonUpdate(prev),
        });
      } else if (entry.action === AuditAction.DELETE && prev) {
        await tx.person.create({ data: deserializePersonCreate(prev) });
      }
    } else {
      if (entry.action === AuditAction.INSERT) {
        await tx.relationship.delete({ where: { id: recordId } });
      } else if (entry.action === AuditAction.UPDATE && prev) {
        await tx.relationship.update({
          where: { id: recordId },
          data: deserializeRelationshipUpdate(prev),
        });
      } else if (entry.action === AuditAction.DELETE && prev) {
        await tx.relationship.create({ data: deserializeRelationshipCreate(prev) });
      }
    }

    // Log the undo itself
    const undoAction =
      entry.action === AuditAction.INSERT
        ? AuditAction.DELETE
        : entry.action === AuditAction.DELETE
          ? AuditAction.INSERT
          : AuditAction.UPDATE;

    await logAudit(tx, {
      tableName: entry.tableName,
      recordId,
      action: undoAction,
      performedBy: requestingUserId,
      previousState: curr,
      newState: prev,
      ipAddress,
    });
  });
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  return new Date(v as string);
}

function deserializePersonUpdate(s: Record<string, unknown>) {
  return {
    firstName: s.firstName as string,
    lastName: (s.lastName as string) ?? null,
    birthName: (s.birthName as string) ?? null,
    gender: (s.gender as 'male' | 'female' | 'other') ?? null,
    dateOfBirth: toDate(s.dateOfBirth),
    dateOfDeath: toDate(s.dateOfDeath),
    placeOfBirth: (s.placeOfBirth as string) ?? null,
    placeOfDeath: (s.placeOfDeath as string) ?? null,
    bio: (s.bio as string) ?? null,
    isLiving: s.isLiving as boolean,
    // photoData intentionally excluded — undo does not restore photos
  };
}

function deserializePersonCreate(s: Record<string, unknown>) {
  return {
    id: s.id as string,
    ...deserializePersonUpdate(s),
    createdBy: s.createdBy as string,
  };
}

function deserializeRelationshipUpdate(s: Record<string, unknown>) {
  return {
    personAId: s.personAId as string,
    personBId: s.personBId as string,
    relationshipType: s.relationshipType as 'parent_child' | 'spouse' | 'sibling',
    personARole: (s.personARole as string) ?? null,
    personBRole: (s.personBRole as string) ?? null,
    startDate: toDate(s.startDate),
    endDate: toDate(s.endDate),
    notes: (s.notes as string) ?? null,
  };
}

function deserializeRelationshipCreate(s: Record<string, unknown>) {
  return {
    id: s.id as string,
    ...deserializeRelationshipUpdate(s),
    createdBy: s.createdBy as string,
  };
}
