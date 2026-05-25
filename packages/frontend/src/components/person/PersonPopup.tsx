import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePerson } from '@/hooks/usePerson';
import { useTree } from '@/hooks/useTree';
import { deletePerson } from '@/api/persons';
import { undoPersonChange } from '@/api/relationships';
import { useAuth } from '@/auth/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonForm } from './PersonForm';
import { PhotoUpload } from './PhotoUpload';
import { RelationshipPanel } from '@/components/relationship/RelationshipPanel';

interface Props {
  personId: string | null;
  onClose: () => void;
}

function SectionHeader({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {onEdit && (
        <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          Edit
        </button>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? undefined : 'text-muted-foreground/40'}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function PersonPopup({ personId, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: person, isLoading } = usePerson(personId);
  const { data: tree } = useTree();
  const [editOpen, setEditOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  async function handleUndo() {
    if (!personId) return;
    setUndoing(true);
    try {
      await undoPersonChange(personId);
      await qc.invalidateQueries({ queryKey: ['person', personId] });
      await qc.invalidateQueries({ queryKey: ['tree'] });
      toast.success('Last change undone');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 403 ? 'You can only undo your own last change' : 'Failed to undo');
    } finally {
      setUndoing(false);
    }
  }

  async function handleDelete() {
    if (!personId || !confirm(`Delete ${person?.firstName} ${person?.lastName ?? ''}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deletePerson(personId);
      await qc.invalidateQueries({ queryKey: ['tree'] });
      toast.success('Person deleted');
      onClose();
    } catch {
      toast.error('Failed to delete person');
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet open={!!personId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-6 p-6">
          {isLoading || !person ? (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="sr-only">{person.firstName} {person.lastName}</SheetTitle>
              </SheetHeader>

              {/* Photo + name */}
              <div className="flex items-center gap-4">
                <PhotoUpload person={person} />
                <div>
                  <h2 className="text-xl font-semibold leading-tight">
                    {person.firstName} {person.lastName ?? ''}
                  </h2>
                  {person.birthName && (
                    <p className="text-sm text-muted-foreground">née {person.birthName}</p>
                  )}
                  {!person.isLiving && (
                    <p className="text-xs text-muted-foreground">†</p>
                  )}
                </div>
              </div>

              {/* Details with inline Edit */}
              <div className="space-y-2">
                <SectionHeader title="Details" onEdit={() => setEditOpen(true)} />
                <div className="space-y-1.5">
                  <DetailRow label="Born" value={[person.dateOfBirth, person.placeOfBirth].filter(Boolean).join(' · ')} />
                  <DetailRow label="Died" value={[person.dateOfDeath, person.placeOfDeath].filter(Boolean).join(' · ')} />
                  <DetailRow label="Gender" value={person.gender} />
                  <DetailRow
                    label={person.isLiving ? 'Residence' : 'Last residence'}
                    value={[
                      person.addressStreet,
                      [person.addressCity, person.addressPostalCode].filter(Boolean).join(' '),
                      person.addressCountry,
                    ].filter(Boolean).join(', ') || undefined}
                  />
                  <DetailRow label="Notes" value={person.bio} />
                </div>
              </div>

              {/* Relationships */}
              {tree && (
                <RelationshipPanel
                  personId={person.id}
                  relationships={tree.relationships}
                  allPersons={tree.persons}
                />
              )}

              {/* Rare actions — undo and admin delete only */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-auto">
                <Button size="sm" variant="outline" onClick={handleUndo} disabled={undoing}>
                  {undoing ? 'Undoing…' : 'Undo last edit'}
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={handleDelete} disabled={deleting}
                    className="text-destructive hover:text-destructive ml-auto">
                    {deleting ? 'Deleting…' : 'Delete'}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {person && (
        <PersonForm open={editOpen} onOpenChange={setEditOpen} person={person} />
      )}
    </>
  );
}
