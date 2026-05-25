import { usePersonPhoto } from '@/hooks/usePerson';
import { cn } from '@/lib/utils';

interface Props {
  personId: string;
  hasPhoto: boolean;
  firstName: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-14 w-14 text-base',
  lg: 'h-24 w-24 text-2xl',
};

export function PersonAvatar({ personId, hasPhoto, firstName, lastName, size = 'md', className }: Props) {
  const photoUrl = usePersonPhoto(personId, hasPhoto);
  const initials = `${firstName[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName ?? ''}`}
        className={cn('rounded-full object-cover', SIZE[size], className)}
      />
    );
  }

  return (
    <div className={cn('rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground select-none', SIZE[size], className)}>
      {initials}
    </div>
  );
}
