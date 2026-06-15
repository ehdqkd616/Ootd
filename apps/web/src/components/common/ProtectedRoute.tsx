import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores/app.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAppStore((s) => ({ isAuthenticated: !!s.user }));
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
