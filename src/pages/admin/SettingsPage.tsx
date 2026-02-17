import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings, Save } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

const SettingsPage = () => {
  const { lowStockThreshold, setLowStockThreshold } = useSettingsStore();
  const [threshold, setThreshold] = useState(String(lowStockThreshold));

  const handleSave = () => {
    const value = parseInt(threshold);
    if (isNaN(value) || value < 1) {
      toast.error('El umbral debe ser un número mayor a 0');
      return;
    }
    setLowStockThreshold(value);
    toast.success(`Umbral de stock bajo actualizado a ${value} unidades`);
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
    </div>
  );
};

export default SettingsPage;
