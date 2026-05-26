import { createContext, useContext, useState, type ReactNode } from 'react';
import type { JwtPayload } from '@family-tree/shared';
import { updateDisplayName } from '@/api/auth';

interface AuthContextValue {
  user: JwtPayload | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  updateUser: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as JwtPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<JwtPayload | null>(() => {
    const stored = localStorage.getItem('token');
    return stored ? decodeJwt(stored) : null;
  });

  function login(newToken: string) {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(decodeJwt(newToken));
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  async function updateUser(displayName: string) {
    const { token: newToken } = await updateDisplayName(displayName);
    login(newToken);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
