import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ChurchDataProvider } from './contexts/ChurchDataContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './layouts/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { OfflineConnectivityBanner } from './components/OfflineConnectivityBanner';

// Code-split pages with React.lazy for fast initial bundle and optimal performance
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then(m => ({ default: m.MembersPage })));
const VisitorsPage = lazy(() => import('./pages/VisitorsPage').then(m => ({ default: m.VisitorsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then(m => ({ default: m.FinancePage })));
const PledgesPage = lazy(() => import('./pages/PledgesPage').then(m => ({ default: m.PledgesPage })));
const MinistriesPage = lazy(() => import('./pages/MinistriesPage').then(m => ({ default: m.MinistriesPage })));
const SmallGroupsPage = lazy(() => import('./pages/SmallGroupsPage').then(m => ({ default: m.SmallGroupsPage })));
const EventsPage = lazy(() => import('./pages/EventsPage').then(m => ({ default: m.EventsPage })));
const PastoralCarePage = lazy(() => import('./pages/PastoralCarePage').then(m => ({ default: m.PastoralCarePage })));
const CommunicationPage = lazy(() => import('./pages/CommunicationPage').then(m => ({ default: m.CommunicationPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const WelfarePage = lazy(() => import('./pages/WelfarePage').then(m => ({ default: m.WelfarePage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const AiAssistantPage = lazy(() => import('./pages/AiAssistantPage').then(m => ({ default: m.AiAssistantPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const MemberPortalPage = lazy(() => import('./pages/MemberPortalPage').then(m => ({ default: m.MemberPortalPage })));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ChurchDataProvider>
            <ToastProvider>
              <OfflineConnectivityBanner />
              <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/portal" element={<MemberPortalPage />} />
                  <Route path="/member-portal" element={<MemberPortalPage />} />
                  <Route path="/" element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="members/:memberId" element={<MembersPage />} />
                    <Route path="visitors" element={<VisitorsPage />} />
                    <Route path="attendance" element={<AttendancePage />} />
                    <Route path="services" element={<ServicesPage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="welfare" element={<WelfarePage />} />
                    <Route path="inventory" element={<InventoryPage />} />
                    <Route path="pledges" element={<PledgesPage />} />
                    <Route path="ministries" element={<MinistriesPage />} />
                    <Route path="small-groups" element={<SmallGroupsPage />} />
                    <Route path="events" element={<EventsPage />} />
                    <Route path="pastoral-care" element={<PastoralCarePage />} />
                    <Route path="communication" element={<CommunicationPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="audit-logs" element={<AuditLogsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="assistant" element={<AiAssistantPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </ChurchDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
  );
}
