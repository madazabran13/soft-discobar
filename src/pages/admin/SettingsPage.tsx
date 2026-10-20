import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings, Save, CreditCard, Plus } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

const db = supabase as any;

interface PaymentMethod { id: string; name: string; is_active: boolean; sort_order: number }

const SettingsPage = () => {
  const { lowStockThreshold, setLowStockThreshold } = useSettingsStore();
  const [threshold, setThreshold] = useState(String(lowStockThreshold));
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [newMethod, setNewMethod] = useState('');

  const loadMethods = async () => {
    const { data } = await db.from('payment_methods').select('*').order('sort_order');
    setMethods(data || []);
  };
  useEffect(() => { loadMethods(); }, []);

  const handleSave = () => {
    const value = parseInt(threshold);
    if (isNaN(value) || value < 1) {
      toast.error('El umbral debe ser un número mayor a 0');
      return;
    }
    setLowStockThreshold(value);
    toast.success(`Umbral de stock bajo actualizado a ${value} unidades`);
  };

  const toggleMethod = async (m: PaymentMethod) => {
    const { error } = await db.from('payment_methods').update({ is_active: !m.is_active }).eq('id', m.id);
    if (error) return toast.error(error.message);
    loadMethods();
  };

  const addMethod = async () => {
    const name = newMethod.trim();
    if (!name) return;
    const { error } = await db.from('payment_methods').insert({ name, sort_order: methods.length + 1 });
    if (error) return toast.error(error.message.includes('duplicate') ? 'Ese medio de pago ya existe' : error.message);
    setNewMethod('');
    toast.success('Medio de pago agregado');
    loadMethods();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Card className="glass max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" />
            Inventario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Umbral de stock bajo</Label>
            <p className="text-xs text-muted-foreground">
              Se mostrará una alerta cuando un producto tenga menos de esta cantidad de unidades.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="bg-secondary/50 max-w-[120px]"
              />
              <Button onClick={handleSave} className="gradient-primary gap-2">
                <Save className="h-4 w-4" /> Guardar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            Medios de pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Estos medios aparecen al facturar un pedido. Puedes desactivarlos sin borrarlos.
          </p>
          <div className="divide-y divide-border">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <span className={m.is_active ? '' : 'text-muted-foreground line-through'}>{m.name}</span>
                <Switch checked={m.is_active} onCheckedChange={() => toggleMethod(m)} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nuevo medio (ej: Bono, Cortesía)"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              className="bg-secondary/50"
            />
            <Button onClick={addMethod} variant="outline" className="gap-1">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
