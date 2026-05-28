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

export async function sendInvite(email: string, sendEmail = true): Promise<{ link: string }> {
  const res = await api.post<{ link: string }>('/auth/invite', { email, sendEmail });
  return res.data;
}

export async function updateDisplayName(displayName: string): Promise<AuthResponse> {
  const res = await api.patch<AuthResponse>('/auth/me', { displayName });
  return res.data;
}

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  role: string | null;
  createdAt: string;
  status: 'active' | 'pending';
}

export async function getUsers(): Promise<UserSummary[]> {
  const res = await api.get<UserSummary[]>('/auth/users');
  return res.data;
}
