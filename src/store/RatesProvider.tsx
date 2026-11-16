import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /**
   * Cotações moeda-da-conta → moeda principal, para contas em outras moedas.
   * Só em memória; uma moeda que falhou fica ausente (nunca usa valor antigo).
   */
  accountQuotes: Record<string, RateQuote>;
  /** Moedas de contas cuja cotação não pôde ser obtida na última consulta. */
  accountQuoteErrors: string[];
  refresh(): Promise<void>;
}

const RatesContext = createContext<RatesApi | null>(null);

export function RatesProvider({ children }: { children: ReactNode }) {
  const { settings, ready, accounts } = useData();
  const { primaryCurrency: base, secondaryCurrency: target } = settings;
  const currencyKey = useMemo(
    () => [...new Set(accounts.map((a) => a.currency).filter((c) => c !== base))].sort().join(','),
    [accounts, base],
  );
  const [accountQuotes, setAccountQuotes] = useState<Record<string, RateQuote>>({});
  const [accountQuoteErrors, setAccountQuoteErrors] = useState<string[]>([]);
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
    const others = currencyKey ? currencyKey.split(',') : [];
    const crossP = Promise.allSettled(others.map((c) => fetchRate(c, base)));
    try {
      const q = await fetchRate(base, target);
      if (id === reqId.current) setQuote(q);
    } catch (e) {
      if (id === reqId.current) {
        setQuote(null);
        setError((e as Error).message);
      }
    }
    const cross = await crossP;
    if (id === reqId.current) {
      const ok: Record<string, RateQuote> = {};
      const failed: string[] = [];
      cross.forEach((r, i) => {
        if (r.status === 'fulfilled') ok[others[i]] = r.value;
        else failed.push(others[i]);
      });
      setAccountQuotes(ok);
      setAccountQuoteErrors(failed);
      setLoading(false);
    }
  }, [base, target, currencyKey]);

  useEffect(() => {
    if (!ready) return;
    setQuote(null);
    setAccountQuotes({});
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

  return <RatesContext.Provider value={{ quote, loading, error, lastAttemptAt, accountQuotes, accountQuoteErrors, refresh }}>{children}</RatesContext.Provider>;
}

export function useRates(): RatesApi {
  const ctx = useContext(RatesContext);
  if (!ctx) throw new Error('useRates fora do RatesProvider');
  return ctx;
}
