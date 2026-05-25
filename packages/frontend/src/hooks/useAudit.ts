import { useQuery } from '@tanstack/react-query';
import { fetchAuditLog } from '@/api/audit';

export function useAuditLog(page: number, limit = 50) {
  return useQuery({
    queryKey: ['audit', page, limit],
    queryFn: () => fetchAuditLog(page, limit),
    placeholderData: (prev) => prev,
  });
}
