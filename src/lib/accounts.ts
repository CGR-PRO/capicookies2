/**
 * Contas, transferências e consolidação — lógica pura (sem React), coberta por testes.
 *
 * Regras:
 * - Saldo de uma conta = saldo inicial + entradas − despesas + transferências recebidas − enviadas.
 * - Transferências nunca são entradas nem despesas: não entram no resultado mensal.
 * - O saldo nunca é armazenado; é sempre derivado (editar/excluir recalcula sem duplicar).
 */
import { signed } from './finance';
import type { Account, RecurringExpense, Settings, Transaction, Transfer } from './types';

export const PRIMARY_ACCOUNT_NAME = 'Conta Principal';

/** Ícones disponíveis para as contas (nomes mapeados para componentes na interface). */
export const ACCOUNT_ICONS = ['wallet', 'landmark', 'piggy-bank', 'banknote', 'credit-card', 'shield', 'coins', 'briefcase', 'home', 'plane', 'gift', 'car'] as const;
export type AccountIconName = (typeof ACCOUNT_ICONS)[number];

/** Gradientes azuis primeiro (identidade visual), depois cores distinguíveis. */
export const ACCOUNT_COLORS = ['#2a78d6', '#1f5fa8', '#4f9be8', '#1baf7a', '#6250d6', '#eb6834', '#eda100', '#e87ba4'];

/** Converte um valor (centavos) de uma conta para a moeda de exibição; null = sem cotação. */
export type Converter = (cents: number, accountId: string) => number | null;

export const identity: Converter = (c) => c;

export interface LedgerEntry {
  date: string;
  delta: number;
}

export interface Ledger {
  initial: number;
  entries: LedgerEntry[];
  /** Ids das contas cujo valor não pôde ser convertido (sem cotação). */
  missing: string[];
}

/**
 * Movimentações que afetam o saldo de um conjunto de contas.
 * Para uma conta só, use `identity`; para várias moedas, um conversor para a moeda principal.
 */
export function buildLedger(accounts: Account[], transactions: Transaction[], transfers: Transfer[], conv: Converter = identity): Ledger {
  const ids = new Set(accounts.map((a) => a.id));
  const missing = new Set<string>();
  let initial = 0;
  for (const a of accounts) {
    const v = conv(a.initialBalance, a.id);
    if (v === null) missing.add(a.id);
    else initial += v;
  }
  const entries: LedgerEntry[] = [];
  const add = (date: string, cents: number, accountId: string) => {
    if (missing.has(accountId)) return;
    const v = conv(cents, accountId);
    if (v === null) missing.add(accountId);
    else entries.push({ date, delta: v });
  };
  for (const t of transactions) if (ids.has(t.accountId)) add(t.date, signed(t), t.accountId);
  for (const tr of transfers) {
    if (ids.has(tr.fromAccountId)) add(tr.date, -tr.amount, tr.fromAccountId);
    if (ids.has(tr.toAccountId)) add(tr.date, tr.toAmount, tr.toAccountId);
  }
  // Se uma conta ficou sem cotação no meio do caminho, refaz sem ela (nunca soma parcial).
  if (missing.size) {
    const rest = accounts.filter((a) => !missing.has(a.id));
    if (rest.length === accounts.length) return { initial, entries, missing: [...missing] };
    const again = buildLedger(rest, transactions, transfers, conv);
    return { ...again, missing: [...new Set([...missing, ...again.missing])] };
  }
  return { initial, entries, missing: [] };
}

/** Saldo na data `upTo` (inclusive) ou atual. */
export function ledgerBalance(ledger: Ledger, upTo?: string): number {
  let total = ledger.initial;
  for (const e of ledger.entries) if (!upTo || e.date <= upTo) total += e.delta;
  return total;
}

/** Saldo exato de uma conta, na moeda da própria conta. */
export function accountBalance(account: Account, transactions: Transaction[], transfers: Transfer[], upTo?: string): number {
  return ledgerBalance(buildLedger([account], transactions, transfers), upTo);
}

export function accountBalances(accounts: Account[], transactions: Transaction[], transfers: Transfer[]): Map<string, number> {
  const map = new Map<string, number>(accounts.map((a) => [a.id, a.initialBalance]));
  for (const t of transactions) if (map.has(t.accountId)) map.set(t.accountId, map.get(t.accountId)! + signed(t));
  for (const tr of transfers) {
    if (map.has(tr.fromAccountId)) map.set(tr.fromAccountId, map.get(tr.fromAccountId)! - tr.amount);
    if (map.has(tr.toAccountId)) map.set(tr.toAccountId, map.get(tr.toAccountId)! + tr.toAmount);
  }
  return map;
}

/**
 * Lançamentos (somente entradas e despesas) de um filtro de conta, com valores na moeda de exibição.
 * Transferências não participam: o resultado mensal nunca as considera.
 */
export function viewTransactions(transactions: Transaction[], accountIds: Set<string>, conv: Converter = identity): { items: Transaction[]; missing: string[] } {
  const items: Transaction[] = [];
  const missing = new Set<string>();
  for (const t of transactions) {
    if (!accountIds.has(t.accountId)) continue;
    const v = conv(t.amount, t.accountId);
    if (v === null) missing.add(t.accountId);
    else items.push(v === t.amount ? t : { ...t, amount: v });
  }
  return { items, missing: [...missing] };
}

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function accountHasMovements(id: string, transactions: Transaction[], transfers: Transfer[], recurring: RecurringExpense[]): boolean {
  return (
    transactions.some((t) => t.accountId === id) ||
    transfers.some((t) => t.fromAccountId === id || t.toAccountId === id) ||
    recurring.some((r) => r.accountId === id)
  );
}

export interface TransferCheck {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  toAmount: number;
}

/** Valida uma transferência; devolve a mensagem de erro ou null. */
export function validateTransfer(t: TransferCheck, accounts: Account[]): string | null {
  const from = accounts.find((a) => a.id === t.fromAccountId);
  const to = accounts.find((a) => a.id === t.toAccountId);
  if (!from || !to) return 'Selecione as contas de origem e de destino.';
  if (from.id === to.id) return 'A conta de origem e a de destino devem ser diferentes.';
  if (!Number.isInteger(t.amount) || t.amount <= 0) return 'O valor deve ser maior que zero.';
  if (!Number.isInteger(t.toAmount) || t.toAmount <= 0) return 'O valor recebido deve ser maior que zero.';
  if (from.currency === to.currency && t.amount !== t.toAmount) return 'Contas na mesma moeda devem receber exatamente o valor enviado.';
  return null;
}

export interface MigrationResult {
  accounts: Account[];
  /** Conta principal criada nesta migração (null se já existia). */
  created: Account | null;
  transactions: Transaction[];
  recurring: RecurringExpense[];
  primaryId: string;
}

/**
 * Migração segura v1 → v2: cria a "Conta Principal" a partir do saldo inicial e da moeda
 * principal já configurados e associa a ela todos os lançamentos sem conta.
 * Idempotente: rodar de novo não altera nada. Devolve apenas os registros que mudaram.
 */
export function migrateToAccounts(
  settings: Pick<Settings, 'initialBalance' | 'primaryCurrency'>,
  accounts: Account[],
  transactions: Transaction[],
  recurring: RecurringExpense[],
  makeId: () => string,
  now: string,
): MigrationResult {
  let list = accounts;
  let created: Account | null = null;
  let primary = list.find((a) => a.isPrimary) ?? null;
  if (!primary && list.length) {
    // Garante que exista exatamente uma conta principal.
    primary = { ...sortAccounts(list)[0], isPrimary: true, archived: false, updatedAt: now };
    list = list.map((a) => (a.id === primary!.id ? primary! : a));
    created = primary;
  }
  if (!primary) {
    primary = {
      id: makeId(),
      name: PRIMARY_ACCOUNT_NAME,
      initialBalance: Number.isInteger(settings.initialBalance) ? settings.initialBalance : 0,
      currency: settings.primaryCurrency,
      color: ACCOUNT_COLORS[0],
      icon: 'wallet',
      isPrimary: true,
      archived: false,
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    list = [primary];
    created = primary;
  }
  const ids = new Set(list.map((a) => a.id));
  const pid = primary.id;
  const txs = transactions.filter((t) => !t.accountId || !ids.has(t.accountId)).map((t) => ({ ...t, accountId: pid }));
  const recs = recurring.filter((r) => r.accountId !== undefined && !ids.has(r.accountId)).map((r) => ({ ...r, accountId: pid }));
  return { accounts: list, created, transactions: txs, recurring: recs, primaryId: pid };
}

export type HistoryKind = 'income' | 'expense' | 'transfer-in' | 'transfer-out';

export interface HistoryRow {
  key: string;
  kind: HistoryKind;
  date: string;
  /** Valor com sinal, na moeda da conta. */
  delta: number;
  description: string;
  transaction?: Transaction;
  transfer?: Transfer;
  /** Conta do outro lado da transferência. */
  counterpartId?: string;
  /** Saldo da conta logo após este movimento. */
  balanceAfter: number;
}

/** Histórico individual de uma conta (mais recente primeiro), com o saldo após cada movimento. */
export function accountHistory(account: Account, transactions: Transaction[], transfers: Transfer[]): HistoryRow[] {
  const rows: Omit<HistoryRow, 'balanceAfter'>[] = [];
  const created: Record<string, string> = {};
  for (const t of transactions) {
    if (t.accountId !== account.id) continue;
    rows.push({ key: `t-${t.id}`, kind: t.type, date: t.date, delta: signed(t), description: t.description, transaction: t });
    created[`t-${t.id}`] = t.createdAt;
  }
  for (const tr of transfers) {
    if (tr.fromAccountId === account.id) {
      rows.push({ key: `o-${tr.id}`, kind: 'transfer-out', date: tr.date, delta: -tr.amount, description: tr.description, transfer: tr, counterpartId: tr.toAccountId });
      created[`o-${tr.id}`] = tr.createdAt;
    }
    if (tr.toAccountId === account.id) {
      rows.push({ key: `i-${tr.id}`, kind: 'transfer-in', date: tr.date, delta: tr.toAmount, description: tr.description, transfer: tr, counterpartId: tr.fromAccountId });
      created[`i-${tr.id}`] = tr.createdAt;
    }
  }
  rows.sort((a, b) => (a.date === b.date ? created[a.key].localeCompare(created[b.key]) : a.date < b.date ? -1 : 1));
  let running = account.initialBalance;
  const out = rows.map((r) => {
    running += r.delta;
    return { ...r, balanceAfter: running };
  });
  return out.reverse();
}
