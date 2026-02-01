import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TabLayout from './components/TabLayout';
import Login from './pages/Login';
import CustomerList from './pages/customers/CustomerList';
import CustomerDetail from './pages/customers/CustomerDetail';
import CustomerForm from './pages/customers/CustomerForm';
import PoolList from './pages/pool/PoolList';
import Profile from './pages/me/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<AuthGuard><TabLayout /></AuthGuard>}>
        <Route index element={<Navigate to="/customers" replace />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="pool" element={<PoolList />} />
        <Route path="me" element={<Profile />} />
      </Route>
      <Route path="/customer/add" element={<AuthGuard><CustomerForm /></AuthGuard>} />
      <Route path="/customer/:id" element={<AuthGuard><CustomerDetail /></AuthGuard>} />
      <Route path="/customer/:id/edit" element={<AuthGuard><CustomerForm /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
