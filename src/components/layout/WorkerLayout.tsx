import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Wine, UtensilsCrossed, Receipt, ClipboardList, LogOut } from 'lucide-react';

const navItems = [
  { path: '/worker', label: 'Mesas', icon: UtensilsCrossed },
  { path: '/worker/pedido', label: 'Nuevo Pedido', icon: Receipt },
  { path: '/worker/historial', label: 'Historial', icon: ClipboardList },
];

export const WorkerLayout = () => {
  const { signOut, profile } = useAuthStore();
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
          <Wine className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold neon-text">DiscoBar</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{profile?.full_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="flex border-t border-border bg-card">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
