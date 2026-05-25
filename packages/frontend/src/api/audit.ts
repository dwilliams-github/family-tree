import { api } from './client';
import type { AuditEntry } from '@family-tree/shared';

export interface AuditPage {
  total: number;
  page: number;
  limit: number;
  entries: AuditEntry[];
}

export async function fetchAuditLog(page = 1, limit = 50): Promise<AuditPage> {
  const res = await api.get<AuditPage>('/audit', { params: { page, limit } });
  return res.data;
}
