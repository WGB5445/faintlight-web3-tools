import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { findToolByPath, TOOL_GROUPS } from '../../lib/tools';

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'group flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition',
    isActive
      ? 'border-sky-500/60 bg-sky-500/10 text-sky-200 shadow-lg shadow-sky-900/30'
      : 'border-slate-800/80 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60 hover:text-sky-100'
  ].join(' ');
}

export default function AppShell() {
  const location = useLocation();
  const activeContext = findToolByPath(location.pathname);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-12 pt-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Faintlight 工具箱</p>
          <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-100">Web3 多网络实验室</h1>
              <p className="max-w-2xl text-sm text-slate-400">
                以链路为维度组织工具，轻松扩展到 Aptos 之外的其他生态。左侧选择链与工具，右侧展示对应的交互界面。
              </p>
            </div>
            {activeContext ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-400">
                <span className="text-slate-500">当前链：</span>
                <span className="text-sky-300">{activeContext.group.label}</span>
                <span className="px-2 text-slate-600">|</span>
                <span className="text-slate-500">工具：</span>
                <span className="text-slate-200">{activeContext.item.label}</span>
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
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{group.label}</h2>
                    {group.hint ? <p className="text-xs text-slate-500">{group.hint}</p> : null}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <NavLink key={item.path} to={item.path} className={sidebarLinkClass} end>
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-slate-400 transition group-hover:text-slate-300">
                          {item.description}
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
          <p>
            需要扩展其他链？请在 <span className="text-sky-300">src/lib/tools.ts</span> 与相关页面中追加工具定义，即可无缝扩容。
          </p>
        </footer>
      </div>
    </div>
  );
}
