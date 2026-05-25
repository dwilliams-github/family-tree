import { useTree } from '@/hooks/useTree';
import { Skeleton } from '@/components/ui/skeleton';
import { TreeCanvas } from './TreeCanvas';

interface Props {
  selectedPersonId: string | null;
  onPersonSelect: (id: string) => void;
}

export function FamilyTree({ selectedPersonId, onPersonSelect }: Props) {
  const { data, isLoading, isError } = useTree();

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center gap-4 flex-col">
        <Skeleton className="h-20 w-40 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="h-20 w-40 rounded-lg" />
          <Skeleton className="h-20 w-40 rounded-lg" />
        </div>
        <p className="text-sm text-muted-foreground">Loading family tree…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-destructive">Failed to load family tree.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <TreeCanvas
      dto={data}
      selectedPersonId={selectedPersonId}
      onPersonSelect={onPersonSelect}
    />
  );
}
