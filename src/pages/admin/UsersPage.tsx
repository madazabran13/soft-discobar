import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Edit, Search } from 'lucide-react';
import { SortableHeader, useSortableData } from '@/components/SortableHeader';
import { PaginationControls, usePagination } from '@/components/PaginationControls';

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  user_roles: { role: string }[];
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'trabajador' });
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*, user_roles(role)');
    if (data) setUsers(data as any);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const { sorted, sort, toggleSort } = useSortableData(filtered);
  const { paged, currentPage, totalItems, pageSize, setCurrentPage } = usePagination(sorted);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Completa todos los campos');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: form.email, password: form.password, full_name: form.full_name, role: form.role },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Error al crear usuario');
      return;
    }
    toast.success('Usuario creado y confirmado');
    closeDialog();
    fetchUsers();
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    const body: any = { action: 'update', user_id: editUser.id, full_name: form.full_name, role: form.role };
    if (form.password) body.password = form.password;
    if (form.email && form.email !== editUser.email) body.email = form.email;

    const { data, error } = await supabase.functions.invoke('manage-user', { body });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Error al actualizar');
      return;
    }
    toast.success('Usuario actualizado');
    closeDialog();
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('¿Eliminar este usuario permanentemente?')) return;
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'delete', user_id: userId },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Error al eliminar');
      return;
    }
    toast.success('Usuario eliminado completamente');
    fetchUsers();
  };

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setForm({ email: u.email || '', password: '', full_name: u.full_name, role: u.user_roles?.[0]?.role || 'trabajador' });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditUser(null);
    setForm({ email: '', password: '', full_name: '', role: 'trabajador' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2"><Plus className="h-4 w-4" /> Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>{editUser ? 'Editar' : 'Nuevo'} Usuario</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre Completo</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="bg-secondary/50" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-secondary/50" /></div>
              <div><Label>{editUser ? 'Nueva Contraseña (vacío = mantener)' : 'Contraseña'}</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="bg-secondary/50" /></div>
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
              <Button onClick={editUser ? handleUpdate : handleCreate} className="w-full gradient-primary">
                {editUser ? 'Actualizar' : 'Crear'} Usuario
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50" />
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortableHeader label="Usuario" sortKey="full_name" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Rol" sortKey="role" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Acciones" sortKey="" currentSort={null} onSort={() => {}} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((u) => (
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
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay usuarios</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
