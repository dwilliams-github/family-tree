import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface Props {
  requireAdmin?: boolean;
}

export function ProtectedRoute({ requireAdmin = false }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== 'ADMIN') return <Navigate to="/" replace />;

  return <Outlet />;
}
