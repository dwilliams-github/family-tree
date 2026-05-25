import { api } from './client';
import type { Relationship, RelationshipInput } from '@family-tree/shared';

export async function createRelationship(input: RelationshipInput): Promise<Relationship> {
  const res = await api.post<Relationship>('/relationships', input);
  return res.data;
}

export async function deleteRelationship(id: string): Promise<void> {
  await api.delete(`/relationships/${id}`);
}

export async function undoPersonChange(personId: string): Promise<void> {
  await api.post(`/audit/record/${personId}/undo`);
}
