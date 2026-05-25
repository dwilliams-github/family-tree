import { cn } from '@/lib/utils';
import type { PersonSummary } from '@family-tree/shared';
import { CARD_W, CARD_H } from './layout';
import { PersonAvatar } from '@/components/person/PersonAvatar';

interface Props {
  person: PersonSummary;
  selected: boolean;
  style: React.CSSProperties;
  onClick: () => void;
}

export function PersonCard({ person, selected, style, onClick }: Props) {
  const birthYear = person.dateOfBirth?.split('-')[0];
  const deathYear = person.dateOfDeath?.split('-')[0];

  let years = '';
  if (birthYear && deathYear) years = `${birthYear} – ${deathYear}`;
  else if (birthYear && person.isLiving) years = `b. ${birthYear}`;
  else if (birthYear) years = birthYear;

  return (
    <div
      onClick={onClick}
      style={{ position: 'absolute', width: CARD_W, height: CARD_H, ...style }}
      className={cn(
        'bg-card border rounded-lg px-3 pt-2 pb-2 flex flex-col items-start gap-1.5',
        'cursor-pointer shadow-sm transition-shadow hover:shadow-md select-none',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
    >
      <PersonAvatar
        personId={person.id}
        hasPhoto={person.hasPhoto}
        firstName={person.firstName}
        lastName={person.lastName}
        size="sm"
        className="h-10 w-10 shrink-0"
      />
      <div className="flex flex-col gap-0.5 w-full">
        <p className="font-semibold text-sm leading-tight truncate text-card-foreground">
          {person.firstName}{person.lastName ? ` ${person.lastName}` : ''}
        </p>
        {years && <p className="text-xs text-muted-foreground">{years}</p>}
        {!person.isLiving && <p className="text-xs text-muted-foreground/60">†</p>}
      </div>
    </div>
  );
}
