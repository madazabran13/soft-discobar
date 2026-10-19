import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute, ModuleGuard } from '@/components/ProtectedRoute';
import { ThemeProvider } from 'next-themes';
import { ThemeSync } from '@/components/ThemeToggle';
import PlatformPage from './pages/superadmin/PlatformPage';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { WorkerLayout } from '@/components/layout/WorkerLayout';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/admin/Dashboard';
import TablesPage from './pages/admin/TablesPage';
import OrdersPage from './pages/admin/OrdersPage';
import ProductsPage from './pages/admin/ProductsPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import UsersPage from './pages/admin/UsersPage';
import SalesPage from './pages/admin/SalesPage';
import SettingsPage from './pages/admin/SettingsPage';
import InventoryPage from './pages/admin/InventoryPage';
import WorkerTables from './pages/worker/WorkerTables';
import NewOrder from './pages/worker/NewOrder';
import OrderHistory from './pages/worker/OrderHistory';
import WorkerProfile from './pages/worker/WorkerProfile';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { user, role, loading } = useAuthStore();
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin' || role === 'superadmin') return <Navigate to="/admin" replace />;
  if (role === 'trabajador') return <Navigate to="/worker" replace />;
  return <Navigate to="/login" replace />;
};

const AppContent = () => {
  const { initialize } = useAuthStore();
  useOrderNotifications();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Routes>
      <Route path="/" element={<AuthRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Admin routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<ModuleGuard moduleKey="dashboard"><Dashboard /></ModuleGuard>} />
        <Route path="mesas" element={<ModuleGuard moduleKey="mesas"><TablesPage /></ModuleGuard>} />
        <Route path="pedidos" element={<ModuleGuard moduleKey="pedidos"><OrdersPage /></ModuleGuard>} />
        <Route path="productos" element={<ModuleGuard moduleKey="productos"><ProductsPage /></ModuleGuard>} />
        <Route path="categorias" element={<ModuleGuard moduleKey="categorias"><CategoriesPage /></ModuleGuard>} />
        <Route path="usuarios" element={<ModuleGuard moduleKey="usuarios"><UsersPage /></ModuleGuard>} />
        <Route path="ventas" element={<ModuleGuard moduleKey="ventas"><SalesPage /></ModuleGuard>} />
        <Route path="inventario" element={<ModuleGuard moduleKey="inventario"><InventoryPage /></ModuleGuard>} />
        <Route path="plataforma" element={<ProtectedRoute allowedRoles={['superadmin']}><PlatformPage /></ProtectedRoute>} />
        <Route path="configuracion" element={<ModuleGuard moduleKey="configuracion"><SettingsPage /></ModuleGuard>} />
      </Route>

      {/* Worker routes */}
      <Route path="/worker" element={<ProtectedRoute allowedRoles={['trabajador']}><WorkerLayout /></ProtectedRoute>}>
        <Route index element={<ModuleGuard moduleKey="mesas"><WorkerTables /></ModuleGuard>} />
        <Route path="pedido" element={<ModuleGuard moduleKey="pedidos"><NewOrder /></ModuleGuard>} />
        <Route path="historial" element={<ModuleGuard moduleKey="pedidos"><OrderHistory /></ModuleGuard>} />
        <Route path="perfil" element={<WorkerProfile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" themes={['light', 'dark']} enableSystem={false}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeSync />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
