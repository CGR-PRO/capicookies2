import { describe, expect, it } from 'vitest';
import { computeBalance, filterTransactions, monthlySeries, summarizeMonth } from './finance';
import { buildOccurrences, dueDatesBetween, nthDue } from './recurrence';
import { parseMoney, formatMoney } from './money';
import { addMonths, dateInTz, timeInTz, zonedToUtc, startOfWeek } from './dates';
import { fetchRate, RateUnavailableError, convertCents } from './currency';
import type { RecurringExpense, Transaction } from './types';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  type: 'expense',
  amount: 100,
  description: 'x',
  categoryId: null,
  date: '2026-11-01',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...p,
});

describe('money', () => {
  it('interpreta formatos comuns', () => {
    expect(parseMoney('1.234,56')).toBe(123456);
    expect(parseMoney('1234.56')).toBe(123456);
    expect(parseMoney('12,5')).toBe(1250);
    expect(parseMoney('1,234.56')).toBe(123456);
    expect(parseMoney('1.234')).toBe(123400);
    expect(parseMoney('0.5')).toBe(50);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
  it('formata em pt-BR', () => {
    expect(formatMoney(123456, 'EUR').replace(/\s/g, ' ')).toMatch(/1\.234,56/);
  });
});

describe('saldo', () => {
  it('entradas somam e despesas subtraem', () => {
    const list = [tx({ type: 'income', amount: 5000 }), tx({ type: 'expense', amount: 1200 })];
    expect(computeBalance(1000, list)).toBe(4800);
  });
  it('editar/excluir recalcula sem duplicar (saldo é derivado)', () => {
    const a = tx({ id: 'a', type: 'income', amount: 5000 });
    let list = [a];
    list = list.map((t) => (t.id === 'a' ? { ...t, amount: 3000 } : t));
    expect(computeBalance(0, list)).toBe(3000);
    list = list.filter((t) => t.id !== 'a');
    expect(computeBalance(0, list)).toBe(0);
  });
  it('resumo mensal e série', () => {
    const list = [tx({ type: 'income', amount: 1000, date: '2026-10-05' }), tx({ amount: 300, date: '2026-11-02' })];
    expect(summarizeMonth(list, '2026-11')).toEqual({ month: '2026-11', income: 0, expense: 300, net: -300 });
    const s = monthlySeries(list, '2026-11', 3);
    expect(s.map((x) => x.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(s[1].income).toBe(1000);
  });
  it('filtra por período e categoria', () => {
    const list = [tx({ date: '2026-01-01', categoryId: 'c1' }), tx({ date: '2026-06-01', categoryId: 'c2' })];
    expect(filterTransactions(list, { from: '2026-05-01' })).toHaveLength(1);
    expect(filterTransactions(list, { categoryId: 'c1' })).toHaveLength(1);
  });
});

describe('recorrência', () => {
  const rec: RecurringExpense = {
    id: 'r1', name: 'Aluguel', amount: 90000, categoryId: null, firstDue: '2026-01-31', frequency: 'monthly', active: true,
    createdAt: '', updatedAt: '',
  };
  it('mantém o dia âncora no fim do mês', () => {
    expect(nthDue(rec, 1)).toBe('2026-02-28');
    expect(nthDue(rec, 2)).toBe('2026-03-31');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });
  it('gera datas na janela', () => {
    expect(dueDatesBetween(rec, '2026-03-01', '2026-05-31')).toEqual(['2026-03-31', '2026-04-30', '2026-05-31']);
    expect(dueDatesBetween({ ...rec, frequency: 'weekly', firstDue: '2026-11-02' }, '2026-11-01', '2026-11-20')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
  });
  it('status: paga, vencida, pendente — e só o pagamento afeta o saldo', () => {
    const r = { ...rec, firstDue: '2026-09-10' };
    const pay = tx({ amount: 90000, recurringId: 'r1', recurringDue: '2026-10-10', date: '2026-10-09' });
    const occ = buildOccurrences([r], [pay], '2026-11-14', { horizonDays: 30 });
    const map = Object.fromEntries(occ.map((o) => [o.due, o.status]));
    expect(map['2026-09-10']).toBe('overdue');
    expect(map['2026-10-10']).toBe('paid');
    expect(map['2026-11-10']).toBe('overdue');
    expect(map['2026-12-10']).toBe('pending');
    expect(computeBalance(100000, [pay])).toBe(10000);
  });
  it('gasto inativo não gera novas pendências mas mantém pagas', () => {
    const r = { ...rec, firstDue: '2026-10-10', active: false };
    const pay = tx({ recurringId: 'r1', recurringDue: '2026-10-10' });
    const occ = buildOccurrences([r], [pay], '2026-11-14');
    expect(occ.map((o) => o.status)).toEqual(['paid']);
  });
});

describe('fuso horário', () => {
  it('converte horário de Dublin no inverno e no verão', () => {
    expect(zonedToUtc('2026-01-15', '09:00', 'Europe/Dublin').toISOString()).toBe('2026-01-15T09:00:00.000Z');
    expect(zonedToUtc('2026-07-15', '09:00', 'Europe/Dublin').toISOString()).toBe('2026-07-15T08:00:00.000Z');
    expect(zonedToUtc('2026-07-15', '09:00', 'America/Sao_Paulo').toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });
  it('ida e volta', () => {
    const d = zonedToUtc('2026-03-29', '14:30', 'Europe/Dublin');
    expect(dateInTz(d, 'Europe/Dublin')).toBe('2026-03-29');
    expect(timeInTz(d, 'Europe/Dublin')).toBe('14:30');
  });
  it('semana começa na segunda', () => {
    expect(startOfWeek('2026-11-14')).toBe('2026-11-09');
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09');
  });
});

describe('câmbio', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it('usa o primeiro provedor disponível', async () => {
    const f = (() => ok({ date: '2026-11-13', rates: { BRL: 6.1 } })) as unknown as typeof fetch;
    const q = await fetchRate('EUR', 'BRL', f);
    expect(q.rate).toBe(6.1);
    expect(q.quotedAt.startsWith('2026-11-13')).toBe(true);
  });
  it('cai para o segundo provedor', async () => {
    const f = ((url: string) =>
      url.includes('frankfurter') ? Promise.reject(new Error('down')) : ok({ result: 'success', time_last_update_unix: 1763000000, rates: { BRL: 6.2 } })) as unknown as typeof fetch;
    expect((await fetchRate('EUR', 'BRL', f)).rate).toBe(6.2);
  });
  it('falha sem inventar valor', async () => {
    const f = (() => Promise.resolve(new Response('x', { status: 503 }))) as unknown as typeof fetch;
    await expect(fetchRate('EUR', 'BRL', f)).rejects.toBeInstanceOf(RateUnavailableError);
  });
  it('converte centavos', () => {
    expect(convertCents(10000, 6.1234)).toBe(61234);
  });
});
