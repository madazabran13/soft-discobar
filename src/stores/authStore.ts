import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: 'admin' | 'trabajador' | null;
  profile: { id: string; full_name: string; email: string | null } | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        // Fetch role and profile without triggering RLS recursion
        setTimeout(async () => {
          const { data: roleData } = await supabase
            .rpc('get_my_role');
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', session.user.id)
            .maybeSingle();

          set({
            role: (roleData as 'admin' | 'trabajador') ?? null,
            profile: profileData,
            loading: false,
          });
        }, 0);
      } else {
        set({ role: null, profile: null, loading: false });
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      set({ loading: false, initialized: true });
    }
    set({ initialized: true });
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, role: null, profile: null });
  },
}));
