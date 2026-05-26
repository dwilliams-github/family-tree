import { api } from './client';
import type { AuthResponse } from '@family-tree/shared';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function getInvite(token: string): Promise<{ email: string }> {
  const res = await api.get<{ email: string }>(`/auth/invite/${token}`);
  return res.data;
}

export async function acceptInvite(token: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(`/auth/invite/${token}/accept`, { password });
  return res.data;
}

export async function sendInvite(email: string): Promise<void> {
  await api.post('/auth/invite', { email });
}

export async function updateDisplayName(displayName: string): Promise<AuthResponse> {
  const res = await api.patch<AuthResponse>('/auth/me', { displayName });
  return res.data;
}
