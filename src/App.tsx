import { lazy, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DataProvider, useData } from './store/DataProvider';
import { ToastProvider } from './store/ToastProvider';
import { RatesProvider } from './store/RatesProvider';
import { AuthProvider } from './auth/AuthProvider';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingBlock } from './components/ui/Spinner';

// Cada módulo é carregado sob demanda: navegação rápida e fácil adição de novas seções.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Entradas = lazy(() => import('./pages/Entradas'));
const Despesas = lazy(() => import('./pages/Despesas'));
const GastosFixos = lazy(() => import('./pages/GastosFixos'));
const Historico = lazy(() => import('./pages/Historico'));
const Conversor = lazy(() => import('./pages/Conversor'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));

function ThemeSync() {
  const { settings } = useData();
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);
  return null;
}

function Gate() {
  const { ready } = useData();
  if (!ready) return <div className="boot"><LoadingBlock label="Carregando seus dados…" /></div>;
  return (
    <AuthProvider>
      <RatesProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="entradas" element={<Entradas />} />
              <Route path="despesas" element={<Despesas />} />
              <Route path="gastos-fixos" element={<GastosFixos />} />
              <Route path="historico" element={<Historico />} />
              <Route path="conversor" element={<Conversor />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </RatesProvider>
    </AuthProvider>
  );
}

export function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <ConfirmProvider>
          <ThemeSync />
          <Gate />
        </ConfirmProvider>
      </DataProvider>
    </ToastProvider>
  );
}
