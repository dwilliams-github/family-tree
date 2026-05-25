export type RelationshipType = 'parent_child' | 'spouse' | 'sibling';

export interface Relationship {
  id: string;
  personAId: string;
  personBId: string;
  type: RelationshipType;
  personARole?: string;
  personBRole?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface RelationshipInput {
  personAId: string;
  personBId: string;
  type: RelationshipType;
  personARole?: string;
  personBRole?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface GraphDTO {
  persons: import('./person.js').PersonSummary[];
  relationships: Relationship[];
}
