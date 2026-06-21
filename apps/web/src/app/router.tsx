import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthRoute, ProtectedLayout } from '@/components/auth-gate';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { ConnectionPage } from '@/pages/ConnectionPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GeneralPage } from '@/pages/GeneralPage';
import { ProcessingPage } from '@/pages/ProcessingPage';
import { ReviewPage } from '@/pages/ReviewPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes — redirect away when they don't apply. */}
        <Route path="/login" element={<AuthRoute mode="login" />} />
        <Route path="/register" element={<AuthRoute mode="setup" />} />

        {/* Everything else requires auth; the layout guard redirects otherwise. */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
          <Route path="/settings/general" element={<GeneralPage />} />
          <Route path="/settings/connection" element={<ConnectionPage />} />
          <Route path="/settings/api-keys" element={<ApiKeysPage />} />
          <Route path="/settings/processing" element={<ProcessingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
