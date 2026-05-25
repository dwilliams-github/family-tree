import type { Node, Edge } from '@xyflow/react';
import type { GraphDTO, PersonSummary } from '@family-tree/shared';

export interface PersonNodeData extends Record<string, unknown> {
  person: PersonSummary;
}

export type PersonNode = Node<PersonNodeData, 'personNode'>;

export function graphToFlow(dto: GraphDTO): { nodes: PersonNode[]; edges: Edge[] } {
  const nodes: PersonNode[] = dto.persons.map((person) => ({
    id: person.id,
    type: 'personNode' as const,
    position: { x: 0, y: 0 },
    data: { person },
  }));

  const edges: Edge[] = dto.relationships.map((rel) => ({
    id: rel.id,
    source: rel.personAId,
    target: rel.personBId,
    type: 'personEdge',
    data: { relType: rel.type },
  }));

  return { nodes, edges };
}
