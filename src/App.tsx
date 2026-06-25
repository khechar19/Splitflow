import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { useTheme } from './hooks/useTheme';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Expenses from './pages/Expenses';
import ProfilePage from './pages/Profile';

export default function App() {
  useTheme();
  const { user, profile, loading, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center relative">
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-primary/10 blur-[120px] pointer-events-none"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-accent/10 blur-[120px] pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center font-bold shadow-lg animate-pulse text-white text-lg">
            S
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary"></div>
        </div>
      </div>
    );
  }

  // Helper for Route Guarding
  const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return <Layout profile={profile}>{children}</Layout>;
  };

  const PublicRoute = ({ children }: { children: React.ReactElement }) => {
    if (user) {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  };

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />

        {/* Protected Dashboard/Features Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard currentProfile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <Groups currentProfile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group/:id"
          element={
            <ProtectedRoute>
              <GroupDetail currentProfile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <Expenses currentProfile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage currentProfile={profile} onRefreshProfile={refreshProfile} />
            </ProtectedRoute>
          }
        />

        {/* Fallbacks */}
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}
