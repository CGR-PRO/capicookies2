/**
 * Serviço de câmbio. Consulta cotações atuais em serviços públicos sem chave de API.
 * As cotações NÃO são armazenadas (nem histórico, nem cache persistente).
 * Em caso de falha, retorna erro — nunca um valor inventado.
 */

export interface RateQuote {
  base: string;
  target: string;
  rate: number;
  /** Instante (ISO) da cotação informada pelo provedor. */
  quotedAt: string;
  /** Instante (ISO) em que a consulta foi feita. */
  fetchedAt: string;
  provider: string;
}

export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'EUR', name: 'Euro' },
  { code: 'BRL', name: 'Real brasileiro' },
  { code: 'USD', name: 'Dólar americano' },
  { code: 'GBP', name: 'Libra esterlina' },
  { code: 'CHF', name: 'Franco suíço' },
  { code: 'JPY', name: 'Iene japonês' },
  { code: 'CAD', name: 'Dólar canadense' },
  { code: 'AUD', name: 'Dólar australiano' },
  { code: 'NZD', name: 'Dólar neozelandês' },
  { code: 'CNY', name: 'Yuan chinês' },
  { code: 'SEK', name: 'Coroa sueca' },
  { code: 'NOK', name: 'Coroa norueguesa' },
  { code: 'DKK', name: 'Coroa dinamarquesa' },
  { code: 'PLN', name: 'Zlóti polonês' },
  { code: 'CZK', name: 'Coroa tcheca' },
  { code: 'HUF', name: 'Florim húngaro' },
  { code: 'MXN', name: 'Peso mexicano' },
  { code: 'INR', name: 'Rupia indiana' },
  { code: 'ZAR', name: 'Rand sul-africano' },
  { code: 'TRY', name: 'Lira turca' },
];

export function currencyName(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

type Fetcher = typeof fetch;

async function fetchJson(fetcher: Fetcher, url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface Provider {
  name: string;
  get(fetcher: Fetcher, base: string, target: string): Promise<{ rate: number; quotedAt: string }>;
}

const providers: Provider[] = [
  {
    name: 'Frankfurter (BCE)',
    async get(fetcher, base, target) {
      const data = await fetchJson(fetcher, `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`, 8000);
      const rate = Number(data?.rates?.[target]);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotação ausente');
      // Frankfurter informa apenas a data de referência (publicação do BCE ~16h CET).
      const quotedAt = typeof data.date === 'string' ? `${data.date}T14:00:00Z` : new Date().toISOString();
      return { rate, quotedAt };
    },
  },
  {
    name: 'ExchangeRate-API',
    async get(fetcher, base, target) {
      const data = await fetchJson(fetcher, `https://open.er-api.com/v6/latest/${base}`, 8000);
      if (data?.result !== 'success') throw new Error('Resposta inválida');
      const rate = Number(data?.rates?.[target]);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotação ausente');
      const quotedAt = data.time_last_update_unix ? new Date(data.time_last_update_unix * 1000).toISOString() : new Date().toISOString();
      return { rate, quotedAt };
    },
  },
];

export class RateUnavailableError extends Error {
  constructor() {
    super('Não foi possível atualizar a cotação. Verifique sua conexão e tente novamente.');
    this.name = 'RateUnavailableError';
  }
}

export async function fetchRate(base: string, target: string, fetcher: Fetcher = fetch.bind(globalThis)): Promise<RateQuote> {
  const fetchedAt = new Date().toISOString();
  if (base === target) return { base, target, rate: 1, quotedAt: fetchedAt, fetchedAt, provider: '—' };
  for (const p of providers) {
    try {
      const { rate, quotedAt } = await p.get(fetcher, base, target);
      return { base, target, rate, quotedAt, fetchedAt, provider: p.name };
    } catch {
      // tenta o próximo provedor
    }
  }
  throw new RateUnavailableError();
}

/** Converte centavos usando a cotação (arredondado ao centavo). */
export function convertCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}
