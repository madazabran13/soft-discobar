import { Navigate } from 'react-router-dom';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import { Loader2, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'trabajador' ? '/worker' : '/admin'} replace />;
  }

  return <>{children}</>;
};

export const ModuleGuard = ({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) => {
  const canAccess = useAuthStore((s) => s.canAccess);
  useAuthStore((s) => s.modules);
  if (!canAccess(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Módulo no disponible</h2>
        <p className="max-w-sm text-sm text-muted-foreground">Este módulo está desactivado para tu negocio o tu rol. Contacta al administrador.</p>
      </div>
    );
  }
  return <>{children}</>;
};
