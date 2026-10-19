import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'superadmin' | 'admin' | 'trabajador';

export interface ModuleAccess { enabled: boolean; roles: string[] }

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { id: string; full_name: string; email: string | null; theme?: string | null } | null;
  tenantId: string | null;
  tenantName: string | null;
  modules: Record<string, ModuleAccess>;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  loadContext: () => Promise<void>;
  canAccess: (moduleKey: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  profile: null,
  tenantId: null,
  tenantName: null,
  modules: {},
  loading: true,
  initialized: false,

  loadContext: async () => {
    const uid = get().user?.id;
    if (!uid) return;
    const db = supabase as any;
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase.rpc('get_my_role'),
      db.from('profiles').select('id, full_name, email, tenant_id, theme').eq('id', uid).maybeSingle(),
    ]);
    let tenantName: string | null = null;
    const modules: Record<string, ModuleAccess> = {};
    if (profileData?.tenant_id) {
      const [{ data: t }, { data: tm }] = await Promise.all([
        db.from('tenants').select('name').eq('id', profileData.tenant_id).maybeSingle(),
        db.from('tenant_modules').select('module_key, enabled, allowed_roles').eq('tenant_id', profileData.tenant_id),
      ]);
      tenantName = t?.name ?? null;
      (tm || []).forEach((m: any) => { modules[m.module_key] = { enabled: m.enabled, roles: m.allowed_roles }; });
    }
    set({
      role: (roleData as AppRole) ?? null,
      profile: profileData,
      tenantId: profileData?.tenant_id ?? null,
      tenantName,
      modules,
      loading: false,
    });
  },

  canAccess: (key) => {
    const { role, modules } = get();
    if (role === 'superadmin') return true;
    const m = modules[key];
    if (!m || !role) return false;
    return m.enabled && m.roles.includes(role);
  },

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        setTimeout(() => { get().loadContext(); }, 0);
      } else {
        set({ role: null, profile: null, tenantId: null, tenantName: null, modules: {}, loading: false });
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) set({ loading: false });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, role: null, profile: null, tenantId: null, tenantName: null, modules: {} });
  },
}));

export const isAdminLike = (role: AppRole | null) => role === 'admin' || role === 'superadmin';
