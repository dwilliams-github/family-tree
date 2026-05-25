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
import { PersonAvatar } from './PersonAvatar';
import { PersonForm } from './PersonForm';
import { PhotoUpload } from './PhotoUpload';
import { RelationshipPanel } from '@/components/relationship/RelationshipPanel';

interface Props {
  personId: string | null;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function PersonPopup({ personId, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: person, isLoading } = usePerson(personId);
  const { data: tree } = useTree();
  const [editOpen, setEditOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
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
        <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-6">
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

              {/* Photo + name header */}
              <div className="flex items-center gap-4">
                <PersonAvatar
                  personId={person.id}
                  hasPhoto={person.hasPhoto}
                  firstName={person.firstName}
                  lastName={person.lastName}
                  size="lg"
                />
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

              {/* Detail rows */}
              <div className="space-y-1.5">
                <DetailRow label="Born" value={[person.dateOfBirth, person.placeOfBirth].filter(Boolean).join(' · ')} />
                <DetailRow label="Died" value={[person.dateOfDeath, person.placeOfDeath].filter(Boolean).join(' · ')} />
                <DetailRow label="Gender" value={person.gender} />
              </div>

              {/* Bio / notes */}
              {person.bio && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{person.bio}</p>
                </div>
              )}

              {/* Relationships */}
              {tree && (
                <RelationshipPanel
                  personId={person.id}
                  relationships={tree.relationships}
                  allPersons={tree.persons}
                />
              )}

              {/* Photo management */}
              {photoOpen && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photo</p>
                  <PhotoUpload person={person} />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-auto">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setPhotoOpen(v => !v)}>
                  {photoOpen ? 'Hide photo' : 'Photo'}
                </Button>
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
