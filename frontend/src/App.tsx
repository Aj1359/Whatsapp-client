import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ErrorBoundary } from './components/ErrorBoundary';

import LoginPage from './pages/LoginPage';
import SimpleDashboard from './pages/SimpleDashboard';
import CustomersPage from './pages/CustomersPage';
import PostsTemplatesPage from './pages/PostsTemplatesPage';
import RepliesChatPage from './pages/RepliesChatPage';
import ProfileConnectorPage from './pages/ProfileConnectorPage';

function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* Exactly the 5 requested sections: */}
            {/* 1. Dashboard Entirely Stats */}
            <Route path="dashboard" element={<SimpleDashboard />} />
            {/* 2. Customers Data */}
            <Route path="customers" element={<CustomersPage />} />
            {/* 3. Posts & Templates (Day-wise + History + Repeat) */}
            <Route path="posts" element={<PostsTemplatesPage />} />
            {/* 4. Replies (Reply there to all or selected) */}
            <Route path="replies" element={<RepliesChatPage />} />
            {/* 5. Profile & Meta Connector */}
            <Route path="profile" element={<ProfileConnectorPage />} />

            {/* Fallbacks */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AppLayout />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
