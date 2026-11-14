import { NavLink } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  History,
  LayoutDashboard,
  Repeat,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/entradas', label: 'Entradas', icon: ArrowDownCircle },
  { to: '/despesas', label: 'Despesas', icon: ArrowUpCircle },
  { to: '/gastos-fixos', label: 'Gastos Fixos', icon: Repeat },
  { to: '/historico', label: 'Histórico Financeiro', icon: History },
  { to: '/conversor', label: 'Conversor de Moedas', icon: ArrowLeftRight },
  { to: '/configuracoes', label: 'Configurações', icon: SettingsIcon },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed(): void;
  mobileOpen: boolean;
  onCloseMobile(): void;
}

/** Barra lateral em "liquid glass", recolhível no desktop e retrátil no celular. */
export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  return (
    <>
      <div className={`sidebar-scrim${mobileOpen ? ' is-visible' : ''}`} onClick={onCloseMobile} aria-hidden />
      <aside id="sidebar" className={`sidebar liquid${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar__brand">
          <img src="./favicon.svg" alt="" width={34} height={34} />
          <span className="sidebar__brand-text">
            Agenda <em>&</em> Finanças
          </span>
          <button className="sidebar__close" onClick={onCloseMobile} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar__nav">
          <ul>
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                  onClick={onCloseMobile}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-link__icon">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="nav-link__label">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          className="sidebar__collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          <span className="nav-link__label">Recolher</span>
        </button>
      </aside>
    </>
  );
}
