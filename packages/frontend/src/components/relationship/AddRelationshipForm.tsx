import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createRelationship } from '@/api/relationships';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PersonSummary } from '@family-tree/shared';

// Relationship type as the user sees it, mapping to API params
const REL_OPTIONS = [
  { label: 'Parent of…',  type: 'parent_child' as const, selfIsA: true  },
  { label: 'Child of…',   type: 'parent_child' as const, selfIsA: false },
  { label: 'Spouse of…',  type: 'spouse'       as const, selfIsA: true  },
  { label: 'Sibling of…', type: 'sibling'      as const, selfIsA: true  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPersonId: string;
  allPersons: PersonSummary[];
}

export function AddRelationshipForm({ open, onOpenChange, currentPersonId, allPersons }: Props) {
  const qc = useQueryClient();
  const [relOption, setRelOption] = useState(0);
  const [otherId, setOtherId] = useState('');
  const [saving, setSaving] = useState(false);

  const others = allPersons.filter(p => p.id !== currentPersonId);

  async function handleSave() {
    if (!otherId) { toast.error('Select a person'); return; }
    const opt = REL_OPTIONS[relOption];
    const personAId = opt.selfIsA ? currentPersonId : otherId;
    const personBId = opt.selfIsA ? otherId : currentPersonId;
    setSaving(true);
    try {
      await createRelationship({ personAId, personBId, type: opt.type });
      await qc.invalidateQueries({ queryKey: ['tree'] });
      toast.success('Relationship added');
      onOpenChange(false);
      setOtherId('');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? 'That relationship already exists' : 'Failed to add relationship');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add relationship</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <select
              value={relOption}
              onChange={e => setRelOption(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {REL_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Person</label>
            <select
              value={otherId}
              onChange={e => setOtherId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {others
                .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName ?? ''}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !otherId}>
            {saving ? 'Saving…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
