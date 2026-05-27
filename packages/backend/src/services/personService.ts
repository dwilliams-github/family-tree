import { AuditTable, AuditAction } from '@prisma/client';
import type { Person as PrismaPersonModel } from '@prisma/client';
import { prisma } from '../db/client.js';
import { logAudit } from './auditService.js';
import type { Person, PersonSummary, PersonInput } from '@family-tree/shared';

// ── Serialization helpers ────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().split('T')[0];
}

export function toPersonSummary(p: PrismaPersonModel): PersonSummary {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName ?? undefined,
    dateOfBirth: formatDate(p.dateOfBirth),
    dateOfDeath: formatDate(p.dateOfDeath),
    isLiving: p.isLiving,
    hasPhoto: p.photoData !== null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toPerson(p: PrismaPersonModel): Person {
  return {
    ...toPersonSummary(p),
    birthName: p.birthName ?? undefined,
    gender: (p.gender as 'male' | 'female' | 'other') ?? undefined,
    placeOfBirth: p.placeOfBirth ?? undefined,
    placeOfDeath: p.placeOfDeath ?? undefined,
    addressStreet: p.addressStreet ?? undefined,
    addressCity: p.addressCity ?? undefined,
    addressPostalCode: p.addressPostalCode ?? undefined,
    addressCountry: p.addressCountry ?? undefined,
    bio: p.bio ?? undefined,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function personToAuditJson(p: PrismaPersonModel): Record<string, unknown> {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    birthName: p.birthName,
    gender: p.gender,
    dateOfBirth: formatDate(p.dateOfBirth) ?? null,
    dateOfDeath: formatDate(p.dateOfDeath) ?? null,
    placeOfBirth: p.placeOfBirth,
    placeOfDeath: p.placeOfDeath,
    addressStreet: p.addressStreet,
    addressCity: p.addressCity,
    addressPostalCode: p.addressPostalCode,
    addressCountry: p.addressCountry,
    bio: p.bio,
    isLiving: p.isLiving,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    // photoData intentionally omitted
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function listPersons(): Promise<PersonSummary[]> {
  const persons = await prisma.person.findMany({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  return persons.map(toPersonSummary);
}

export async function getPerson(id: string): Promise<Person> {
  const p = await prisma.person.findUniqueOrThrow({ where: { id } });
  return toPerson(p);
}

export async function searchPersons(q: string): Promise<PersonSummary[]> {
  const persons = await prisma.person.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { birthName: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  return persons.map(toPersonSummary);
}

// ── Mutations ────────────────────────────────────────────────────────────────

function toDateOrUndefined(s?: string) {
  return s ? new Date(s) : undefined;
}

export async function createPerson(
  input: PersonInput,
  userId: string,
  ipAddress?: string
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.person.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthName: input.birthName,
        gender: input.gender as 'male' | 'female' | 'other' | undefined,
        dateOfBirth: toDateOrUndefined(input.dateOfBirth),
        dateOfDeath: toDateOrUndefined(input.dateOfDeath),
        placeOfBirth: input.placeOfBirth,
        placeOfDeath: input.placeOfDeath,
        addressStreet: input.addressStreet,
        addressCity: input.addressCity,
        addressPostalCode: input.addressPostalCode,
        addressCountry: input.addressCountry,
        bio: input.bio,
        isLiving: input.isLiving ?? true,
        createdBy: userId,
      },
    });

    await logAudit(tx, {
      tableName: AuditTable.persons,
      recordId: p.id,
      action: AuditAction.INSERT,
      performedBy: userId,
      newState: personToAuditJson(p),
      ipAddress,
    });

    return toPerson(p);
  });
}

export async function updatePerson(
  id: string,
  input: Partial<PersonInput>,
  userId: string,
  ipAddress?: string
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.person.findUniqueOrThrow({ where: { id } });

    const p = await tx.person.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.birthName !== undefined && { birthName: input.birthName }),
        ...(input.gender !== undefined && { gender: input.gender as 'male' | 'female' | 'other' }),
        ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }),
        ...(input.dateOfDeath !== undefined && { dateOfDeath: input.dateOfDeath ? new Date(input.dateOfDeath) : null }),
        ...(input.placeOfBirth !== undefined && { placeOfBirth: input.placeOfBirth }),
        ...(input.placeOfDeath !== undefined && { placeOfDeath: input.placeOfDeath }),
        ...(input.addressStreet !== undefined && { addressStreet: input.addressStreet }),
        ...(input.addressCity !== undefined && { addressCity: input.addressCity }),
        ...(input.addressPostalCode !== undefined && { addressPostalCode: input.addressPostalCode }),
        ...(input.addressCountry !== undefined && { addressCountry: input.addressCountry }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.isLiving !== undefined && { isLiving: input.isLiving }),
      },
    });

    const changedFields = (Object.keys(input) as Array<keyof PersonInput>).filter(
      (k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((p as Record<string, unknown>)[k])
    );

    await logAudit(tx, {
      tableName: AuditTable.persons,
      recordId: p.id,
      action: AuditAction.UPDATE,
      performedBy: userId,
      previousState: personToAuditJson(before),
      newState: personToAuditJson(p),
      changedFields,
      ipAddress,
    });

    return toPerson(p);
  });
}

export async function deletePerson(
  id: string,
  userId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const p = await tx.person.findUniqueOrThrow({ where: { id } });

    await tx.person.delete({ where: { id } });

    await logAudit(tx, {
      tableName: AuditTable.persons,
      recordId: id,
      action: AuditAction.DELETE,
      performedBy: userId,
      previousState: personToAuditJson(p),
      ipAddress,
    });
  });
}

// ── Photo ────────────────────────────────────────────────────────────────────

export async function getPersonPhoto(
  id: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const p = await prisma.person.findUniqueOrThrow({
    where: { id },
    select: { photoData: true, photoMimeType: true },
  });
  if (!p.photoData || !p.photoMimeType) return null;
  return { data: p.photoData, mimeType: p.photoMimeType };
}

export async function setPersonPhoto(
  id: string,
  data: Buffer,
  mimeType: string,
  userId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.person.findUniqueOrThrow({ where: { id } });

    await tx.person.update({
      where: { id },
      data: { photoData: data, photoMimeType: mimeType },
    });

    await logAudit(tx, {
      tableName: AuditTable.persons,
      recordId: id,
      action: AuditAction.UPDATE,
      performedBy: userId,
      previousState: personToAuditJson(before),
      newState: { ...personToAuditJson(before), photoMimeType: mimeType, hasPhoto: true },
      changedFields: ['photoData', 'photoMimeType'],
      ipAddress,
    });
  });
}

export async function deletePersonPhoto(
  id: string,
  userId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.person.findUniqueOrThrow({ where: { id } });

    await tx.person.update({
      where: { id },
      data: { photoData: null, photoMimeType: null },
    });

    await logAudit(tx, {
      tableName: AuditTable.persons,
      recordId: id,
      action: AuditAction.UPDATE,
      performedBy: userId,
      previousState: personToAuditJson(before),
      newState: { ...personToAuditJson(before), photoMimeType: null, hasPhoto: false },
      changedFields: ['photoData', 'photoMimeType'],
      ipAddress,
    });
  });
}
