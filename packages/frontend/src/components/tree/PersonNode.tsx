import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { PersonNode as PersonNodeType } from './treeTransform';

export const PersonNode = memo(function PersonNode({
  data,
  selected,
}: NodeProps<PersonNodeType>) {
  const { person } = data;
  const birthYear = person.dateOfBirth?.split('-')[0];
  const deathYear = person.dateOfDeath?.split('-')[0];

  let years = '';
  if (birthYear && deathYear) years = `${birthYear} – ${deathYear}`;
  else if (birthYear && person.isLiving) years = `b. ${birthYear}`;
  else if (birthYear) years = birthYear;

  return (
    <div
      className={cn(
        'w-40 h-20 bg-card border rounded-lg px-3 py-2 flex flex-col justify-center gap-0.5 cursor-pointer shadow-sm transition-shadow hover:shadow-md',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <p className="font-semibold text-sm leading-tight truncate text-card-foreground">
        {person.firstName}{person.lastName ? ` ${person.lastName}` : ''}
      </p>
      {years && (
        <p className="text-xs text-muted-foreground">{years}</p>
      )}
      {!person.isLiving && (
        <span className="text-xs text-muted-foreground/60 leading-tight">†</span>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
