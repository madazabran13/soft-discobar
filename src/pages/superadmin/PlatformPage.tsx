import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const db = supabase as any;
const ROLES = ['admin', 'trabajador'];

const PlatformPage = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [tm, setTm] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const load = async () => {
    const [t, m, x] = await Promise.all([
      db.from('tenants').select('*').order('created_at'),
      db.from('modules').select('*').order('sort_order'),
      db.from('tenant_modules').select('*'),
    ]);
    setTenants(t.data || []); setModules(m.data || []); setTm(x.data || []);
    if (!selected && t.data?.[0]) setSelected(t.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const createTenant = async () => {
    if (!newName.trim()) return;
    const { data, error } = await db.from('tenants').insert({ name: newName.trim() }).select().single();
    if (error) return toast.error(error.message);
    await db.from('tenant_modules').insert(modules.map((m) => ({ tenant_id: data.id, module_key: m.key, enabled: true, allowed_roles: m.default_roles })));
    setNewName(''); toast.success('Negocio creado'); load();
  };

  const save = async (key: string, patch: any) => {
    const cur = tm.find((r) => r.tenant_id === selected && r.module_key === key);
    const row = { tenant_id: selected, module_key: key, enabled: cur?.enabled ?? true, allowed_roles: cur?.allowed_roles ?? ['admin'], ...patch };
    const { error } = await db.from('tenant_modules').upsert(row);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plataforma INGEMD</h1>
      <Card className="glass">
        <CardHeader><CardTitle>Negocios</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tenants.map((t) => (
              <Button key={t.id} variant={t.id === selected ? 'default' : 'outline'} onClick={() => setSelected(t.id)}>{t.name}</Button>
            ))}
          </div>
          <div className="flex max-w-md gap-2">
            <Input placeholder="Nombre del nuevo negocio" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button onClick={createTenant}>Crear</Button>
          </div>
        </CardContent>
      </Card>
      {selected && (
        <Card className="glass">
          <CardHeader><CardTitle>Módulos</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {modules.map((m) => {
              const r = tm.find((x) => x.tenant_id === selected && x.module_key === m.key);
              const roles: string[] = r?.allowed_roles ?? [];
              return (
                <div key={m.key} className="flex flex-wrap items-center gap-4 py-3">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  {ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <Switch checked={roles.includes(role)} onCheckedChange={(v) => save(m.key, { allowed_roles: v ? [...roles, role] : roles.filter((x) => x !== role) })} />
                      {role}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Switch checked={!!r?.enabled} onCheckedChange={(v) => save(m.key, { enabled: v })} /> Activo
                  </label>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlatformPage;
