import { AuditTable, AuditAction } from '@prisma/client';
import type { Relationship as PrismaRelModel } from '@prisma/client';
import { prisma } from '../db/client.js';
import { logAudit } from './auditService.js';
import type { Relationship, RelationshipInput } from '@family-tree/shared';

// ── Serialization helpers ────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().split('T')[0];
}

export function toRelationship(r: PrismaRelModel): Relationship {
  return {
    id: r.id,
    personAId: r.personAId,
    personBId: r.personBId,
    type: r.relationshipType as Relationship['type'],
    personARole: r.personARole ?? undefined,
    personBRole: r.personBRole ?? undefined,
    startDate: formatDate(r.startDate),
    endDate: formatDate(r.endDate),
    notes: r.notes ?? undefined,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

export function relationshipToAuditJson(r: PrismaRelModel): Record<string, unknown> {
  return {
    id: r.id,
    personAId: r.personAId,
    personBId: r.personBId,
    relationshipType: r.relationshipType,
    personARole: r.personARole,
    personBRole: r.personBRole,
    startDate: formatDate(r.startDate) ?? null,
    endDate: formatDate(r.endDate) ?? null,
    notes: r.notes,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// For spouse/sibling, enforce canonical ordering so the unique constraint works.
function canonical(input: RelationshipInput): { personAId: string; personBId: string } {
  const { personAId, personBId, type } = input;
  if (type === 'parent_child') return { personAId, personBId };
  return personAId < personBId
    ? { personAId, personBId }
    : { personAId: personBId, personBId: personAId };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listRelationships(): Promise<Relationship[]> {
  const rels = await prisma.relationship.findMany();
  return rels.map(toRelationship);
}

export async function getRelationship(id: string): Promise<Relationship> {
  const r = await prisma.relationship.findUniqueOrThrow({ where: { id } });
  return toRelationship(r);
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createRelationship(
  input: RelationshipInput,
  userId: string,
  ipAddress?: string
): Promise<Relationship> {
  return prisma.$transaction(async (tx) => {
    const { personAId, personBId } = canonical(input);

    const r = await tx.relationship.create({
      data: {
        personAId,
        personBId,
        relationshipType: input.type,
        personARole: input.personARole,
        personBRole: input.personBRole,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        notes: input.notes,
        createdBy: userId,
      },
    });

    await logAudit(tx, {
      tableName: AuditTable.relationships,
      recordId: r.id,
      action: AuditAction.INSERT,
      performedBy: userId,
      newState: relationshipToAuditJson(r),
      ipAddress,
    });

    return toRelationship(r);
  });
}

export async function updateRelationship(
  id: string,
  input: Partial<RelationshipInput>,
  userId: string,
  ipAddress?: string
): Promise<Relationship> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.relationship.findUniqueOrThrow({ where: { id } });

    const r = await tx.relationship.update({
      where: { id },
      data: {
        ...(input.personARole !== undefined && { personARole: input.personARole }),
        ...(input.personBRole !== undefined && { personBRole: input.personBRole }),
        ...(input.startDate !== undefined && { startDate: input.startDate ? new Date(input.startDate) : null }),
        ...(input.endDate !== undefined && { endDate: input.endDate ? new Date(input.endDate) : null }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    const changedFields = ['personARole', 'personBRole', 'startDate', 'endDate', 'notes'].filter(
      (k) =>
        JSON.stringify((before as Record<string, unknown>)[k]) !==
        JSON.stringify((r as Record<string, unknown>)[k])
    );

    await logAudit(tx, {
      tableName: AuditTable.relationships,
      recordId: r.id,
      action: AuditAction.UPDATE,
      performedBy: userId,
      previousState: relationshipToAuditJson(before),
      newState: relationshipToAuditJson(r),
      changedFields,
      ipAddress,
    });

    return toRelationship(r);
  });
}

export async function deleteRelationship(
  id: string,
  userId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const r = await tx.relationship.findUniqueOrThrow({ where: { id } });

    await tx.relationship.delete({ where: { id } });

    await logAudit(tx, {
      tableName: AuditTable.relationships,
      recordId: id,
      action: AuditAction.DELETE,
      performedBy: userId,
      previousState: relationshipToAuditJson(r),
      ipAddress,
    });
  });
}
