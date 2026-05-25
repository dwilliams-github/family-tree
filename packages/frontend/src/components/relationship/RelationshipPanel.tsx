import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteRelationship } from '@/api/relationships';
import { Button } from '@/components/ui/button';
import { AddRelationshipForm } from './AddRelationshipForm';
import type { PersonSummary, Relationship } from '@family-tree/shared';

function relLabel(rel: Relationship, currentId: string, persons: PersonSummary[]): string {
  const otherId = rel.personAId === currentId ? rel.personBId : rel.personAId;
  const other = persons.find(p => p.id === otherId);
  const name = other ? `${other.firstName}${other.lastName ? ` ${other.lastName}` : ''}` : 'Unknown';
  if (rel.type === 'parent_child') {
    return rel.personAId === currentId ? `Parent of ${name}` : `Child of ${name}`;
  }
  if (rel.type === 'spouse') return `Spouse: ${name}`;
  return `Sibling: ${name}`;
}

interface Props {
  personId: string;
  relationships: Relationship[];
  allPersons: PersonSummary[];
}

export function RelationshipPanel({ personId, relationships, allPersons }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const mine = relationships.filter(r => r.personAId === personId || r.personBId === personId);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteRelationship(id);
      await qc.invalidateQueries({ queryKey: ['tree'] });
      toast.success('Relationship removed');
    } catch {
      toast.error('Failed to remove relationship');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Relationships</h3>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>+ Add</Button>
      </div>

      {mine.length === 0 && (
        <p className="text-sm text-muted-foreground">No relationships recorded.</p>
      )}

      <ul className="space-y-1">
        {mine.map(rel => (
          <li key={rel.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
            <span>{relLabel(rel, personId, allPersons)}</span>
            <button
              onClick={() => handleDelete(rel.id)}
              disabled={deleting === rel.id}
              className="text-muted-foreground hover:text-destructive text-xs ml-2 disabled:opacity-40"
            >
              {deleting === rel.id ? '…' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>

      <AddRelationshipForm
        open={addOpen}
        onOpenChange={setAddOpen}
        currentPersonId={personId}
        allPersons={allPersons}
      />
    </div>
  );
}
