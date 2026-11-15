import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchRate, RATE_REFRESH_MS, type RateQuote } from '../lib/currency';
import { useData } from './DataProvider';

/**
 * Cotação principal → secundária, mantida apenas em memória
 * (sem histórico nem armazenamento persistente).
 * - Consulta ao iniciar, a cada 5 minutos e quando o app volta a ficar visível.
 * - Se a consulta falhar, a cotação anterior é descartada: o app nunca exibe uma
 *   cotação antiga como se fosse atual.
 */
interface RatesApi {
  quote: RateQuote | null;
  loading: boolean;
  error: string | null;
  /** Instante (ISO) da última tentativa de consulta. */
  lastAttemptAt: string | null;
  refresh(): Promise<void>;
}

const RatesContext = createContext<RatesApi | null>(null);

export function RatesProvider({ children }: { children: ReactNode }) {
  const { settings, ready } = useData();
  const { primaryCurrency: base, secondaryCurrency: target } = settings;
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setLastAttemptAt(new Date().toISOString());
    try {
      const q = await fetchRate(base, target);
      if (id === reqId.current) setQuote(q);
    } catch (e) {
      if (id === reqId.current) {
        setQuote(null);
        setError((e as Error).message);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [base, target]);

  useEffect(() => {
    if (!ready) return;
    setQuote(null);
    refresh();
    const t = setInterval(refresh, RATE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, refresh]);

  return <RatesContext.Provider value={{ quote, loading, error, lastAttemptAt, refresh }}>{children}</RatesContext.Provider>;
}

export function useRates(): RatesApi {
  const ctx = useContext(RatesContext);
  if (!ctx) throw new Error('useRates fora do RatesProvider');
  return ctx;
}
