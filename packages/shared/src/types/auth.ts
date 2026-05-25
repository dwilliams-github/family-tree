export interface JwtPayload {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
  displayName?: string;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    displayName?: string;
  };
}
