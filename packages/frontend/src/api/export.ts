import { api } from './client';

export async function downloadMarkdown(): Promise<void> {
  const res = await api.get<Blob>('/export/markdown', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'yap-family-tree.md';
  a.click();
  URL.revokeObjectURL(url);
}
