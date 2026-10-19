import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

/** Syncs the saved per-user theme once the profile loads. */
export const ThemeSync = () => {
  const { setTheme } = useTheme();
  const theme = useAuthStore((s) => s.profile?.theme);
  useEffect(() => { if (theme === 'light' || theme === 'dark') setTheme(theme); }, [theme, setTheme]);
  return null;
};

export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isDark = resolvedTheme !== 'light';

  const toggle = async () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    if (user) await (supabase as any).from('profiles').update({ theme: next }).eq('id', user.id);
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};
