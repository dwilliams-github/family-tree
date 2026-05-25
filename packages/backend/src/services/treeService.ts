import { prisma } from '../db/client.js';
import { toPersonSummary } from './personService.js';
import { toRelationship } from './relationshipService.js';
import type { GraphDTO } from '@family-tree/shared';

export async function getFullTree(): Promise<GraphDTO> {
  const [persons, relationships] = await Promise.all([
    prisma.person.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.relationship.findMany(),
  ]);

  return {
    persons: persons.map(toPersonSummary),
    relationships: relationships.map(toRelationship),
  };
}

export async function getSubtree(personId: string, maxDepth = 10): Promise<GraphDTO> {
  const { persons: allPersons, relationships: allRels } = await getFullTree();

  // BFS across relationship graph in both directions
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: personId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (depth >= maxDepth) continue;

    for (const rel of allRels) {
      if (rel.personAId === id && !visited.has(rel.personBId)) {
        queue.push({ id: rel.personBId, depth: depth + 1 });
      }
      if (rel.personBId === id && !visited.has(rel.personAId)) {
        queue.push({ id: rel.personAId, depth: depth + 1 });
      }
    }
  }

  return {
    persons: allPersons.filter((p) => visited.has(p.id)),
    relationships: allRels.filter((r) => visited.has(r.personAId) && visited.has(r.personBId)),
  };
}
