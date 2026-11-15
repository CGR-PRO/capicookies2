import { dateInTz, formatDate, timeInTz } from './dates';
/**
 * Serviço de câmbio. Consulta cotações atuais em serviços públicos sem chave de API.
 * As cotações NÃO são armazenadas (nem histórico, nem cache persistente).
 * Em caso de falha, retorna erro — nunca um valor inventado.
 */

export interface RateQuote {
  base: string;
  target: string;
  rate: number;
  /** Instante (ISO) de referência da cotação, informado pelo provedor. */
  quotedAt: string;
  /** true quando o provedor informa apenas a data de referência (sem horário). */
  dateOnly: boolean;
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

/** Intervalo de atualização automática da cotação. */
export const RATE_REFRESH_MS = 5 * 60 * 1000;

async function fetchJson(fetcher: Fetcher, url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // Parâmetro único + no-store: impede que o navegador ou proxies devolvam cotação em cache.
  const sep = url.includes('?') ? '&' : '?';
  try {
    const res = await fetcher(`${url}${sep}_=${Date.now()}`, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface ProviderResult {
  rate: number;
  quotedAt: string;
  dateOnly: boolean;
}

interface Provider {
  name: string;
  get(fetcher: Fetcher, base: string, target: string): Promise<ProviderResult>;
}

function positive(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error('Cotação ausente');
  return v;
}

const providers: Provider[] = [
  {
    // Cotação comercial intradiária (atualizada ao longo do dia). Fora do horário de
    // negociação devolve a última cotação disponível, com o respectivo horário.
    name: 'AwesomeAPI',
    async get(fetcher, base, target) {
      const data = await fetchJson(fetcher, `https://economia.awesomeapi.com.br/json/last/${base}-${target}`, 8000);
      const q = data?.[`${base}${target}`];
      if (!q) throw new Error('Par indisponível');
      const rate = positive(q.bid);
      const ts = Number(q.timestamp);
      if (!Number.isFinite(ts) || ts <= 0) throw new Error('Horário ausente');
      return { rate, quotedAt: new Date(ts * 1000).toISOString(), dateOnly: false };
    },
  },
  {
    // Taxa de referência diária do Banco Central Europeu (somente data).
    name: 'Frankfurter (BCE)',
    async get(fetcher, base, target) {
      const data = await fetchJson(fetcher, `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`, 8000);
      const rate = positive(data?.rates?.[target]);
      if (typeof data?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error('Data ausente');
      return { rate, quotedAt: `${data.date}T12:00:00Z`, dateOnly: true };
    },
  },
  {
    name: 'ExchangeRate-API',
    async get(fetcher, base, target) {
      const data = await fetchJson(fetcher, `https://open.er-api.com/v6/latest/${base}`, 8000);
      if (data?.result !== 'success') throw new Error('Resposta inválida');
      const rate = positive(data?.rates?.[target]);
      const ts = Number(data.time_last_update_unix);
      if (!Number.isFinite(ts) || ts <= 0) throw new Error('Horário ausente');
      return { rate, quotedAt: new Date(ts * 1000).toISOString(), dateOnly: false };
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
  if (base === target) return { base, target, rate: 1, quotedAt: fetchedAt, dateOnly: false, fetchedAt, provider: '—' };
  for (const p of providers) {
    try {
      const r = await p.get(fetcher, base, target);
      return { base, target, ...r, fetchedAt: new Date().toISOString(), provider: p.name };
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

/**
 * Descreve o momento de referência da cotação. Quando a cotação não é do dia
 * (fim de semana, feriado), deixa claro que é a última disponível.
 */
export function describeQuoteTime(q: Pick<RateQuote, 'quotedAt' | 'dateOnly'>, tz: string, today: string): { label: string; isLatestOfPreviousDay: boolean } {
  const day = q.dateOnly ? q.quotedAt.slice(0, 10) : dateInTz(q.quotedAt, tz);
  const when = q.dateOnly ? formatDate(day, { weekday: true }) : `${formatDate(day, { weekday: true })}, ${timeInTz(q.quotedAt, tz)}`;
  const old = day < today;
  return {
    label: old ? `Última cotação disponível: ${when}` : `Cotação de ${q.dateOnly ? 'referência de ' : ''}${when}`,
    isLatestOfPreviousDay: old,
  };
}
