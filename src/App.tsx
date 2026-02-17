import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
  if (role === 'admin') return <Navigate to="/admin" replace />;
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
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="ventas" element={<SalesPage />} />
      </Route>

      {/* Worker routes */}
      <Route path="/worker" element={<ProtectedRoute allowedRoles={['trabajador']}><WorkerLayout /></ProtectedRoute>}>
        <Route index element={<WorkerTables />} />
        <Route path="pedido" element={<NewOrder />} />
        <Route path="historial" element={<OrderHistory />} />
        <Route path="perfil" element={<WorkerProfile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
