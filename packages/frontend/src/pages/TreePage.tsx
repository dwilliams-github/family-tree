import { useState } from 'react';
import { FamilyTree } from '@/components/tree/FamilyTree';

export function TreePage() {
  const [_selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  return (
    <div className="w-screen h-screen">
      <FamilyTree onPersonSelect={setSelectedPersonId} />
    </div>
  );
}
