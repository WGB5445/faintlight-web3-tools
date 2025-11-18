import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LanguageLayout from './components/layout/LanguageLayout';
import AppShell from './components/layout/AppShell';
import PreferredLanguageRedirect from './components/navigation/PreferredLanguageRedirect';
import HomePage from './pages/Home';
import { useLanguage } from './context/LanguageContext';

const AptosLayout = lazy(() => import('./components/layout/AptosLayout'));
const AptosToolPage = lazy(() => import('./pages/AptosTool'));
const BcsToolPage = lazy(() => import('./pages/BcsTool'));
const AptosAbiViewerPage = lazy(() => import('./pages/AptosAbiViewer'));
const GasScheduleToolPage = lazy(() => import('./pages/GasScheduleTool'));

function RouteLoader() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10 text-sm text-slate-400">
      Loading…
    </div>
  );
}

function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-semibold text-slate-100">{t('notFound.title')}</h2>
      <p className="text-sm text-slate-400">{t('notFound.message')}</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PreferredLanguageRedirect />} />
      <Route path="/:lang" element={<LanguageLayout />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route
            path="aptos"
            element={
              <Suspense fallback={<RouteLoader />}>
                <AptosLayout />
              </Suspense>
            }
          >
            <Route index element={<Navigate to="contract-interaction" replace />} />
            <Route
              path="contract-interaction"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <AptosToolPage />
                </Suspense>
              }
            />
            <Route
              path="bcs-tools"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <BcsToolPage />
                </Suspense>
              }
            />
            <Route
              path="abi-viewer"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <AptosAbiViewerPage />
                </Suspense>
              }
            />
            <Route
              path="gas-schedule"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <GasScheduleToolPage />
                </Suspense>
              }
            />
          </Route>
          <Route path="bcs" element={<Navigate to="aptos/bcs-tools" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
