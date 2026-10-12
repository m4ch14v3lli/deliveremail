import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Loader2 } from 'lucide-react';
import { History } from './pages/History';
import { BulkAudit } from './pages/BulkAudit';
import { Outreach } from './pages/Outreach';
import { CallerAccess } from './pages/CallerAccess';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Dashboard />} />
          <Route 
            path="/history" 
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/bulk" 
            element={
              <ProtectedRoute>
                <BulkAudit />
              </ProtectedRoute>
            } 
          />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/caller-access" element={<CallerAccess />} />
          <Route path="/caller" element={<CallerAccess />} />
          <Route path="/caller-login" element={<CallerAccess />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
