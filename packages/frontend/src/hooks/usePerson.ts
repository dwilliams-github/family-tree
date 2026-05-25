import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPerson, getPersonPhotoBlobUrl } from '@/api/persons';

export function usePerson(id: string | null) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: () => getPerson(id!),
    enabled: !!id,
  });
}

export function usePersonPhoto(personId: string | null, hasPhoto: boolean) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!personId || !hasPhoto) { setUrl(null); return; }
    let blobUrl = '';
    getPersonPhotoBlobUrl(personId)
      .then((u) => { blobUrl = u; setUrl(u); })
      .catch(() => setUrl(null));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [personId, hasPhoto]);

  return url;
}
