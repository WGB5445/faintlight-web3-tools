import { Navigate, Route, Routes } from 'react-router-dom';
import LanguageLayout from './components/layout/LanguageLayout';
import AppShell from './components/layout/AppShell';
import PreferredLanguageRedirect from './components/navigation/PreferredLanguageRedirect';
import AptosLayout from './components/layout/AptosLayout';
import HomePage from './pages/Home';
import AptosToolPage from './pages/AptosTool';
import BcsToolPage from './pages/BcsTool';
import { useLanguage } from './context/LanguageContext';

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
          <Route path="aptos" element={<AptosLayout />}>
            <Route index element={<Navigate to="contract-interaction" replace />} />
            <Route path="contract-interaction" element={<AptosToolPage />} />
            <Route path="bcs-tools" element={<BcsToolPage />} />
          </Route>
          <Route path="bcs" element={<Navigate to="aptos/bcs-tools" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
