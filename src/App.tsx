import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/Home';
import AptosToolPage from './pages/AptosTool';
import BcsToolPage from './pages/BcsTool';

function NotFoundPage() {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-semibold text-slate-100">页面不存在</h2>
      <p className="text-sm text-slate-400">请从顶部导航选择一个工具。</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="aptos" element={<AptosToolPage />} />
        <Route path="bcs" element={<BcsToolPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
