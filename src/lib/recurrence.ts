import { addDays, addMonths, diffDays, parseDateStr } from './dates';
import type { Frequency, RecurringExpense, Transaction } from './types';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  yearly: 'Anual',
};

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

/** n-ésima data de vencimento (n = 0 é a primeira). */
export function nthDue(r: Pick<RecurringExpense, 'firstDue' | 'frequency'>, n: number): string {
  if (r.frequency === 'weekly') return addDays(r.firstDue, 7 * n);
  if (r.frequency === 'biweekly') return addDays(r.firstDue, 14 * n);
  const step = MONTH_STEP[r.frequency] ?? 1;
  return addMonths(r.firstDue, step * n, parseDateStr(r.firstDue).d);
}

/** Todas as datas de vencimento dentro de [from, to] (inclusive). */
export function dueDatesBetween(r: Pick<RecurringExpense, 'firstDue' | 'frequency' | 'endDate'>, from: string, to: string, max = 500): string[] {
  const out: string[] = [];
  let n = 0;
  // Pula rapidamente para perto de "from".
  if (from > r.firstDue) {
    const approxDays = diffDays(r.firstDue, from);
    const perStep = r.frequency === 'weekly' ? 7 : r.frequency === 'biweekly' ? 14 : 28 * (MONTH_STEP[r.frequency] ?? 1);
    n = Math.max(0, Math.floor(approxDays / perStep) - 2);
  }
  for (let guard = 0; guard < max + 50; guard++, n++) {
    const due = nthDue(r, n);
    if (due > to) break;
    if (r.endDate && due > r.endDate) break;
    if (due >= from) out.push(due);
    if (out.length >= max) break;
  }
  return out;
}

export type OccurrenceStatus = 'paid' | 'pending' | 'overdue';

export interface Occurrence {
  recurring: RecurringExpense;
  due: string;
  status: OccurrenceStatus;
  payment?: Transaction;
}

export function paymentKey(recurringId: string, due: string): string {
  return `${recurringId}::${due}`;
}

export function indexPayments(transactions: Transaction[]): Map<string, Transaction> {
  const map = new Map<string, Transaction>();
  for (const t of transactions) {
    if (t.recurringId && t.recurringDue) map.set(paymentKey(t.recurringId, t.recurringDue), t);
  }
  return map;
}

/**
 * Gera as ocorrências relevantes de cada gasto fixo:
 * - todas as vencidas não pagas desde o início (limitado a `lookbackDays`);
 * - as pagas dentro da janela;
 * - as futuras até `horizonDays` após hoje.
 * Uma ocorrência só afeta o saldo quando existe um lançamento de pagamento vinculado.
 */
export function buildOccurrences(
  recurring: RecurringExpense[],
  transactions: Transaction[],
  today: string,
  opts: { lookbackDays?: number; horizonDays?: number } = {},
): Occurrence[] {
  const lookback = opts.lookbackDays ?? 365;
  const horizon = opts.horizonDays ?? 45;
  const payments = indexPayments(transactions);
  const from = addDays(today, -lookback);
  const to = addDays(today, horizon);
  const out: Occurrence[] = [];
  for (const r of recurring) {
    const dues = dueDatesBetween(r, from < r.firstDue ? r.firstDue : from, to);
    let futureCount = 0;
    for (const due of dues) {
      const payment = payments.get(paymentKey(r.id, due));
      if (payment) {
        out.push({ recurring: r, due, status: 'paid', payment });
        continue;
      }
      if (!r.active) continue;
      if (due < today) out.push({ recurring: r, due, status: 'overdue' });
      else {
        // Para o futuro mostra no máximo as duas próximas ocorrências de cada gasto.
        if (futureCount < 2) out.push({ recurring: r, due, status: 'pending' });
        futureCount++;
      }
    }
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.recurring.name.localeCompare(b.recurring.name)));
}

/** Próximo vencimento não pago (ou null). */
export function nextUnpaid(r: RecurringExpense, transactions: Transaction[], today: string): string | null {
  const occ = buildOccurrences([r], transactions, today, { horizonDays: 800 });
  const unpaid = occ.find((o) => o.status !== 'paid');
  return unpaid ? unpaid.due : null;
}
