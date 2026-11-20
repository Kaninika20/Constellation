import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { NetworkPage } from './pages/NetworkPage';
import { ProfilePage } from './pages/ProfilePage';
import { StudentDirectoryPage } from './pages/StudentDirectoryPage';
import { MyNetworkPage } from './pages/MyNetworkPage';
import { ClubsPage } from './pages/ClubsPage';
import { CoursesPage } from './pages/CoursesPage';
import { EventsPage } from './pages/EventsPage';
import { FraudRadarPage } from './pages/FraudRadarPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { MutualConnectionsPage } from './pages/MutualConnectionsPage';
import { PathFinderPage } from './pages/PathFinderPage';
import { InterestsPage } from './pages/InterestsPage';
import { CommunityAnalysisPage } from './pages/CommunityAnalysisPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminCatalogPage } from './pages/AdminCatalogPage';
import { useAuth } from './context/AuthContext';

const AdminOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-center text-sm text-slate-500">Checking administrator access…</p>;
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Dashboard Layout Routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/my-network" element={<MyNetworkPage />} />
          <Route path="/directory" element={<StudentDirectoryPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/communities" element={<CommunityAnalysisPage />} />
          <Route path="/admin" element={<AdminOnlyRoute><AdminDashboardPage /></AdminOnlyRoute>} />
          <Route path="/admin/catalog" element={<AdminOnlyRoute><AdminCatalogPage /></AdminOnlyRoute>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/interests" element={<InterestsPage />} />
          <Route path="/fraud-radar" element={<FraudRadarPage />} />
          {/* Week 4 — Recommendation Engine */}
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/mutual-connections" element={<MutualConnectionsPage />} />
          <Route path="/path-finder" element={<PathFinderPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
