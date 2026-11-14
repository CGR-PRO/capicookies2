import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchRate, type RateQuote } from '../lib/currency';
import { useData } from './DataProvider';

/**
 * Cotação principal → secundária, mantida apenas em memória durante a sessão
 * (sem histórico nem armazenamento persistente). Atualiza a cada 30 minutos.
 */
interface RatesApi {
  quote: RateQuote | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

const RatesContext = createContext<RatesApi | null>(null);
const REFRESH_MS = 30 * 60 * 1000;

export function RatesProvider({ children }: { children: ReactNode }) {
  const { settings, ready } = useData();
  const { primaryCurrency: base, secondaryCurrency: target } = settings;
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const q = await fetchRate(base, target);
      if (id === reqId.current) setQuote(q);
    } catch (e) {
      if (id === reqId.current) {
        // Descarta cotação de outro par de moedas; nunca exibe valor inventado.
        setQuote((q) => (q && q.base === base && q.target === target ? q : null));
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
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [ready, refresh]);

  return <RatesContext.Provider value={{ quote, loading, error, refresh }}>{children}</RatesContext.Provider>;
}

export function useRates(): RatesApi {
  const ctx = useContext(RatesContext);
  if (!ctx) throw new Error('useRates fora do RatesProvider');
  return ctx;
}
