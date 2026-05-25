import { useState } from 'react';
import { FamilyTree } from '@/components/tree/FamilyTree';
import { PersonPopup } from '@/components/person/PersonPopup';
import { PersonForm } from '@/components/person/PersonForm';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';

export function TreePage() {
  const { user, logout } = useAuth();
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="w-screen h-screen relative">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add person</Button>
      </div>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{user?.displayName ?? user?.email}</span>
        <Button size="sm" variant="outline" onClick={logout}>Sign out</Button>
      </div>

      <FamilyTree onPersonSelect={setSelectedPersonId} />

      <PersonPopup personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
      <PersonForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
