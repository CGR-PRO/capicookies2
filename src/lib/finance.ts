import { addMonths, monthKey } from './dates';
import type { Transaction, TxType } from './types';

/**
 * O saldo nunca é armazenado: é sempre derivado do saldo inicial e dos lançamentos.
 * Assim, editar ou excluir um lançamento recalcula tudo automaticamente, sem duplicações.
 */
export function signed(t: Pick<Transaction, 'type' | 'amount'>): number {
  return t.type === 'income' ? t.amount : -t.amount;
}

export function computeBalance(initialBalance: number, transactions: Transaction[], upTo?: string): number {
  let total = initialBalance;
  for (const t of transactions) {
    if (upTo && t.date > upTo) continue;
    total += signed(t);
  }
  return total;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export function summarizeMonth(transactions: Transaction[], month: string): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { month, income, expense, net: income - expense };
}

/** Resumo dos últimos `count` meses terminando em `endMonth` (YYYY-MM), em ordem cronológica. */
export function monthlySeries(transactions: Transaction[], endMonth: string, count: number): MonthSummary[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) months.push(addMonths(`${endMonth}-01`, -i).slice(0, 7));
  const map = new Map<string, MonthSummary>(months.map((m) => [m, { month: m, income: 0, expense: 0, net: 0 }]));
  for (const t of transactions) {
    const s = map.get(monthKey(t.date));
    if (!s) continue;
    if (t.type === 'income') s.income += t.amount;
    else s.expense += t.amount;
  }
  for (const s of map.values()) s.net = s.income - s.expense;
  return months.map((m) => map.get(m)!);
}

export interface CategoryTotal {
  categoryId: string | null;
  total: number;
}

export function totalsByCategory(transactions: Transaction[], type: TxType): CategoryTotal[] {
  const map = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total);
}

export interface TxFilter {
  from?: string;
  to?: string;
  type?: TxType | 'all';
  categoryId?: string | 'all';
  search?: string;
}

export function filterTransactions(list: Transaction[], f: TxFilter): Transaction[] {
  const q = f.search?.trim().toLowerCase();
  return list.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.type && f.type !== 'all' && t.type !== f.type) return false;
    if (f.categoryId && f.categoryId !== 'all') {
      if (f.categoryId === 'none' ? t.categoryId !== null : t.categoryId !== f.categoryId) return false;
    }
    if (q && !t.description.toLowerCase().includes(q) && !(t.notes ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortByDateDesc(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));
}
