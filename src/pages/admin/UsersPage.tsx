import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Users } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  user_roles: { role: string }[];
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'trabajador' });

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*, user_roles(role)');
    if (data) setUsers(data as any);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Completa todos los campos');
      return;
    }

    // Sign up user via auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    });
    if (authErr || !authData.user) {
      toast.error(authErr?.message || 'Error al crear usuario');
      return;
    }

    // Assign role
    const { error: roleErr } = await supabase.from('user_roles').insert({
      user_id: authData.user.id,
      role: form.role as any,
    });
    if (roleErr) toast.error('Usuario creado pero error asignando rol: ' + roleErr.message);
    else toast.success('Usuario creado exitosamente');

    setOpen(false);
    setForm({ email: '', password: '', full_name: '', role: 'trabajador' });
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    // Only delete role and profile (can't delete auth user from client)
    await supabase.from('user_roles').delete().eq('user_id', userId);
    toast.success('Rol de usuario eliminado');
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2"><Plus className="h-4 w-4" /> Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre Completo</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="bg-secondary/50" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-secondary/50" /></div>
              <div><Label>Contraseña</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="bg-secondary/50" /></div>
              <div>
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="trabajador">Trabajador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full gradient-primary">Crear Usuario</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      {u.full_name || '—'}
                    </div>
                  </TableCell>
                  <TableCell>{u.email || '—'}</TableCell>
                  <TableCell>
                    {u.user_roles?.map(r => (
                      <Badge key={r.role} variant="outline" className="capitalize">{r.role}</Badge>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
