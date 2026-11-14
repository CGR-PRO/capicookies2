import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { Background } from './Background';
import { ReminderScheduler } from './ReminderScheduler';
import { useData } from '../../store/DataProvider';
import { LoadingBlock } from '../ui/Spinner';

export function AppLayout() {
  const { settings, updateSettings, loadError } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const current = NAV_ITEMS.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));

  useEffect(() => {
    document.title = current ? `${current.label} · Agenda & Finanças` : 'Agenda & Finanças';
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [current]);

  return (
    <div className={`app-shell${settings.sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <Background />
      <ReminderScheduler />
      <Sidebar
        collapsed={settings.sidebarCollapsed}
        onToggleCollapsed={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <header className="mobile-topbar liquid">
          <button className="btn btn--glass btn--icon btn--md" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" aria-controls="sidebar" aria-expanded={mobileOpen}>
            <Menu size={20} />
          </button>
          <span className="mobile-topbar__title">{current?.label ?? 'Agenda & Finanças'}</span>
          <img src="./favicon.svg" alt="" width={28} height={28} />
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {loadError && (
            <div className="glass alert alert--critical" role="alert">
              {loadError}
            </div>
          )}
          <Suspense fallback={<LoadingBlock />}>
            <div className="page-enter" key={location.pathname}>
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
