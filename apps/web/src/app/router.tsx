import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { RootLayout } from '@/layouts/RootLayout';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { ConnectionPage } from '@/pages/ConnectionPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GeneralPage } from '@/pages/GeneralPage';
import { ProcessingPage } from '@/pages/ProcessingPage';
import { ReviewPage } from '@/pages/ReviewPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <RootLayout>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
            <Route path="/settings/general" element={<GeneralPage />} />
            <Route path="/settings/connection" element={<ConnectionPage />} />
            <Route path="/settings/api-keys" element={<ApiKeysPage />} />
            <Route path="/settings/processing" element={<ProcessingPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </DashboardLayout>
      </RootLayout>
    </BrowserRouter>
  );
}
