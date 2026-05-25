import { api } from './client';
import type { GraphDTO } from '@family-tree/shared';

export async function fetchTree(): Promise<GraphDTO> {
  const res = await api.get<GraphDTO>('/tree');
  return res.data;
}
