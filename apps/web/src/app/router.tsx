import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthRoute, ProtectedLayout } from '@/components/auth-gate';
import { RootLayout } from '@/layouts/RootLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { ConnectionPage } from '@/pages/ConnectionPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GeneralPage } from '@/pages/GeneralPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ProcessingPage } from '@/pages/ProcessingPage';
import { PromptsPage } from '@/pages/PromptsPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { TagsPage } from '@/pages/TagsPage';

/** The regular app shell: connection gate + sidebar chrome around the routed page. */
function AppChrome() {
  return (
    <RootLayout>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </RootLayout>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes — redirect away when they don't apply. */}
        <Route path="/login" element={<AuthRoute mode="login" />} />
        <Route path="/register" element={<AuthRoute mode="setup" />} />

        {/* Everything else requires auth; the layout guard redirects otherwise. */}
        <Route element={<ProtectedLayout />}>
          {/* Guided setup lives outside the app chrome and the connection gate,
              so it's reachable before paperless is connected — and any time
              after, for re-running it by hand. The step is part of the URL
              (1-based); the page validates it and bounces junk back to step 1. */}
          <Route path="/onboarding" element={<Navigate to="/onboarding/1" replace />} />
          <Route path="/onboarding/:step" element={<OnboardingPage />} />

          <Route element={<AppChrome />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
            <Route path="/settings/general" element={<GeneralPage />} />
            <Route path="/settings/connection" element={<ConnectionPage />} />
            <Route path="/settings/api-keys" element={<ApiKeysPage />} />
            <Route path="/settings/processing" element={<ProcessingPage />} />
            <Route path="/settings/prompts" element={<PromptsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
