import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  accountBalances,
  accountHistory,
  buildLedger,
  ledgerBalance,
  migrateToAccounts,
  validateTransfer,
  viewTransactions,
  type Converter,
} from './accounts';
import { monthlySeries, summarizeMonth } from './finance';
import { convertCents } from './currency';
import { buildOccurrences } from './recurrence';
import type { Account, RecurringExpense, Transaction, Transfer } from './types';

let seq = 0;
const acc = (p: Partial<Account>): Account => ({
  id: `acc${++seq}`,
  name: `Conta ${seq}`,
  initialBalance: 0,
  currency: 'EUR',
  color: '#2a78d6',
  icon: 'wallet',
  isPrimary: false,
  archived: false,
  order: seq,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...p,
});
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `tx${++seq}`,
  type: 'expense',
  accountId: 'main',
  amount: 100,
  description: 'x',
  categoryId: null,
  date: '2026-11-10',
  createdAt: `2026-11-10T00:00:${String(seq % 60).padStart(2, '0')}Z`,
  updatedAt: '2026-11-10T00:00:00Z',
  ...p,
});
const tr = (p: Partial<Transfer>): Transfer => ({
  id: `tr${++seq}`,
  fromAccountId: 'main',
  toAccountId: 'sec',
  amount: 20000,
  toAmount: 20000,
  date: '2026-11-12',
  description: 'Transferência',
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
  ...p,
});

const main = acc({ id: 'main', name: 'Conta Principal', isPrimary: true, initialBalance: 100000 });
const sec = acc({ id: 'sec', name: 'Conta Secundária', initialBalance: 5000 });

describe('saldos por conta', () => {
  it('entrada e despesa alteram somente a conta selecionada', () => {
    const txs = [tx({ type: 'income', amount: 12345, accountId: 'main' }), tx({ type: 'expense', amount: 1230, accountId: 'sec' })];
    expect(accountBalance(main, txs, [])).toBe(100000 + 12345);
    expect(accountBalance(sec, txs, [])).toBe(5000 - 1230);
  });

  it('transferência de € 200,00: principal −200, secundária +200, consolidado igual', () => {
    const before = accountBalances([main, sec], [], []);
    const transfers = [tr({ amount: 20000, toAmount: 20000 })];
    const after = accountBalances([main, sec], [], transfers);
    expect(after.get('main')).toBe(before.get('main')! - 20000);
    expect(after.get('sec')).toBe(before.get('sec')! + 20000);
    const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    expect(total(after)).toBe(total(before));
    expect(ledgerBalance(buildLedger([main, sec], [], transfers))).toBe(105000);
  });

  it('transferência não entra no resultado mensal', () => {
    const txs = [tx({ type: 'income', amount: 300000, accountId: 'main' }), tx({ type: 'expense', amount: 45050, accountId: 'main' })];
    const transfers = [tr({ amount: 20000, toAmount: 20000 })];
    const all = viewTransactions(txs, new Set(['main', 'sec'])).items;
    const s = summarizeMonth(all, '2026-11');
    expect(s).toEqual({ month: '2026-11', income: 300000, expense: 45050, net: 254950 });
    // Mesmo com a transferência registrada, só a conta de destino tem saldo maior.
    expect(accountBalance(sec, txs, transfers)).toBe(25000);
    expect(summarizeMonth(viewTransactions(txs, new Set(['sec'])).items, '2026-11').net).toBe(0);
  });

  it('resultado mensal: positivo (sobrou) e negativo (faltou), mês anterior consultável', () => {
    const txs = [
      tx({ type: 'income', amount: 100000, date: '2026-10-05' }),
      tx({ type: 'expense', amount: 130000, date: '2026-10-20' }),
      tx({ type: 'income', amount: 250000, date: '2026-11-01' }),
      tx({ type: 'expense', amount: 99999, date: '2026-11-02' }),
    ];
    expect(summarizeMonth(txs, '2026-10').net).toBe(-30000);
    expect(summarizeMonth(txs, '2026-11').net).toBe(150001);
    const series = monthlySeries(txs, '2026-11', 2);
    expect(series.map((x) => [x.income, x.expense])).toEqual([
      [100000, 130000],
      [250000, 99999],
    ]);
    // O saldo inclui o acumulado (saldo inicial + todos os meses), diferente do resultado do mês.
    expect(accountBalance(main, txs, [])).toBe(100000 + 100000 - 130000 + 250000 - 99999);
  });

  it('editar um lançamento (mesmo id) não duplica nem muda saldo indevidamente', () => {
    const t = tx({ type: 'income', amount: 12345 });
    const edited = [{ ...t, amount: 12345 }];
    expect(accountBalance(main, edited, [])).toBe(112345);
    const moved = [{ ...t, accountId: 'sec' }];
    expect(accountBalance(main, moved, [])).toBe(100000);
    expect(accountBalance(sec, moved, [])).toBe(5000 + 12345);
  });

  it('gastos fixos não pagos não reduzem o saldo', () => {
    const rec: RecurringExpense = {
      id: 'r1', name: 'Aluguel', amount: 90000, categoryId: null, firstDue: '2026-11-05', frequency: 'monthly', accountId: 'main', active: true, createdAt: '', updatedAt: '',
    };
    const occ = buildOccurrences([rec], [], '2026-11-16', { horizonDays: 30 });
    expect(occ.some((o) => o.status === 'overdue')).toBe(true);
    expect(accountBalance(main, [], [])).toBe(100000);
  });
});

describe('várias moedas', () => {
  const brl = acc({ id: 'brl', currency: 'BRL', initialBalance: 100000 });
  const rates: Record<string, number> = { BRL: 0.17 };
  const conv: Converter = (c, id) => {
    const cur = [main, sec, brl].find((a) => a.id === id)!.currency;
    if (cur === 'EUR') return c;
    return rates[cur] ? convertCents(c, rates[cur]) : null;
  };

  it('consolida na moeda principal pela cotação', () => {
    const l = buildLedger([main, brl], [tx({ type: 'income', amount: 50000, accountId: 'brl' })], [], conv);
    expect(ledgerBalance(l)).toBe(100000 + 17000 + 8500);
    expect(l.missing).toEqual([]);
  });

  it('sem cotação: conta fica de fora e é sinalizada (nunca valor inventado)', () => {
    const noRate: Converter = (c, id) => (id === 'brl' ? null : c);
    const l = buildLedger([main, brl], [tx({ type: 'income', amount: 50000, accountId: 'brl' })], [], noRate);
    expect(ledgerBalance(l)).toBe(100000);
    expect(l.missing).toEqual(['brl']);
    const v = viewTransactions([tx({ type: 'income', amount: 50000, accountId: 'brl' })], new Set(['main', 'brl']), noRate);
    expect(v.items).toEqual([]);
    expect(v.missing).toEqual(['brl']);
  });

  it('transferência entre moedas usa valores enviado e recebido', () => {
    const t = tr({ fromAccountId: 'main', toAccountId: 'brl', amount: 10000, toAmount: 58800 });
    expect(accountBalance(main, [], [t])).toBe(90000);
    expect(accountBalance(brl, [], [t])).toBe(158800);
  });
});

describe('validação de transferências', () => {
  it('rejeita mesma conta, valor zero e valores diferentes na mesma moeda', () => {
    expect(validateTransfer({ fromAccountId: 'main', toAccountId: 'main', amount: 1, toAmount: 1 }, [main, sec])).toMatch(/diferentes/);
    expect(validateTransfer({ fromAccountId: 'main', toAccountId: 'sec', amount: 0, toAmount: 0 }, [main, sec])).toMatch(/maior que zero/);
    expect(validateTransfer({ fromAccountId: 'main', toAccountId: 'sec', amount: 100, toAmount: 99 }, [main, sec])).toMatch(/mesma moeda/);
    expect(validateTransfer({ fromAccountId: 'main', toAccountId: 'sec', amount: 20000, toAmount: 20000 }, [main, sec])).toBeNull();
  });
});

describe('histórico individual', () => {
  it('lista entradas, despesas e transferências com saldo após cada movimento', () => {
    const txs = [tx({ type: 'income', amount: 1000, date: '2026-11-01' }), tx({ type: 'expense', amount: 300, date: '2026-11-03' })];
    const h = accountHistory(main, txs, [tr({ amount: 200, toAmount: 200, date: '2026-11-02' })]);
    expect(h.map((r) => [r.kind, r.delta, r.balanceAfter])).toEqual([
      ['expense', -300, 100500],
      ['transfer-out', -200, 100800],
      ['income', 1000, 101000],
    ]);
  });
});

describe('migração para contas', () => {
  const settings = { initialBalance: 123456, primaryCurrency: 'EUR' };
  let n = 0;
  const makeId = () => `new${++n}`;

  it('cria a Conta Principal com o saldo inicial e associa os lançamentos antigos', () => {
    const legacy = [{ ...tx({ amount: 500 }), accountId: undefined as unknown as string }, { ...tx({ type: 'income', amount: 900 }), accountId: '' }];
    const r = migrateToAccounts(settings, [], legacy, [], makeId, '2026-11-16T00:00:00Z');
    expect(r.created).not.toBeNull();
    expect(r.accounts).toHaveLength(1);
    expect(r.accounts[0]).toMatchObject({ name: 'Conta Principal', initialBalance: 123456, currency: 'EUR', isPrimary: true, archived: false });
    expect(r.transactions.every((t) => t.accountId === r.primaryId)).toBe(true);
    // Saldo preservado exatamente: 1234,56 − 5,00 + 9,00
    expect(accountBalance(r.accounts[0], r.transactions, [])).toBe(123456 - 500 + 900);
  });

  it('é idempotente: rodar de novo não muda nada', () => {
    const first = migrateToAccounts(settings, [], [{ ...tx({}), accountId: '' }], [], makeId, 'now');
    const again = migrateToAccounts(settings, first.accounts, first.transactions, [], makeId, 'later');
    expect(again.created).toBeNull();
    expect(again.transactions).toEqual([]);
    expect(again.accounts).toEqual(first.accounts);
  });

  it('não altera saldos de contas existentes', () => {
    const r = migrateToAccounts(settings, [main, sec], [tx({ accountId: 'sec' })], [], makeId, 'now');
    expect(r.created).toBeNull();
    expect(r.transactions).toEqual([]);
    expect(r.primaryId).toBe('main');
  });
});
