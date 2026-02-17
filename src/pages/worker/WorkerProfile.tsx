import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Lock, Save } from 'lucide-react';

const WorkerProfile = () => {
  const { user, profile } = useAuthStore();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || !fullName.trim()) return;
    setSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (authErr) throw authErr;

      toast.success('Perfil actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setChangingPassword(true);
    try {
      // Re-authenticate with current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });
      if (signInErr) {
        toast.error('Contraseña actual incorrecta');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Mi Perfil</h1>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre Completo</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="bg-secondary/30 opacity-60" />
          </div>
          <Button onClick={handleUpdateProfile} disabled={saving} className="w-full gradient-primary">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Cambiar Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contraseña Actual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Nueva Contraseña</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar Contraseña</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-secondary/50"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            variant="outline"
            className="w-full"
          >
            {changingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerProfile;
