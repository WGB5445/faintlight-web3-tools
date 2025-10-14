import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { findToolBySlug, TOOL_GROUPS } from '../../lib/tools';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../navigation/LanguageSwitcher';

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'group flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition',
    isActive
      ? 'border-sky-500/60 bg-sky-500/10 text-sky-200 shadow-lg shadow-sky-900/30'
      : 'border-slate-800/80 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60 hover:text-sky-100'
  ].join(' ');
}

function extractSlug(pathname: string, lang: string) {
  const prefix = `/${lang}`;
  if (pathname === prefix) return '';
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length + 1);
  }
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length);
  }
  return pathname.replace(/^\//, '');
}

export default function AppShell() {
  const location = useLocation();
  const { lang, t, buildPath } = useLanguage();
  const activeSlug = extractSlug(location.pathname, lang);
  const activeContext = findToolBySlug(activeSlug);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-12 pt-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('layout.badge')}</p>
            <LanguageSwitcher />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-100">{t('layout.title')}</h1>
              <p className="max-w-2xl text-sm text-slate-400">{t('layout.subtitle')}</p>
            </div>
            {activeContext ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-400">
                <span className="text-slate-500">{t('layout.status.chain')}：</span>
                <span className="text-sky-300">{t(activeContext.group.titleKey)}</span>
                <span className="px-2 text-slate-600">|</span>
                <span className="text-slate-500">{t('layout.status.tool')}：</span>
                <span className="text-slate-200">{t(activeContext.item.labelKey)}</span>
              </div>
            ) : null}
          </div>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-[280px]">
            <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-inner">
              {TOOL_GROUPS.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t(group.titleKey)}</h2>
                    {group.hintKey ? <p className="text-xs text-slate-500">{t(group.hintKey)}</p> : null}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.slug || 'root'}
                        to={buildPath(item.slug)}
                        className={sidebarLinkClass}
                        end={item.slug === ''}
                      >
                        <span className="text-sm font-medium">{t(item.labelKey)}</span>
                        <span className="text-xs text-slate-400 transition group-hover:text-slate-300">
                          {t(item.descriptionKey)}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="min-h-[60vh] flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl shadow-sky-950/20">
            <Outlet />
          </main>
        </div>

        <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500">
          <p>{t('layout.footer')}</p>
        </footer>
      </div>
    </div>
  );
}
