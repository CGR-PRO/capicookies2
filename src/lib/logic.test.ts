import { describe, expect, it } from 'vitest';
import { computeBalance, filterTransactions, monthlySeries, summarizeMonth } from './finance';
import { buildOccurrences, dueDatesBetween, nthDue } from './recurrence';
import { parseMoney, formatMoney, digitsToCents, formatMaskedInput } from './money';
import { addMonths, dateInTz, timeInTz, zonedToUtc, startOfWeek } from './dates';
import { fetchRate, RateUnavailableError, convertCents, describeQuoteTime } from './currency';
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
  const awesome = { EURBRL: { code: 'EUR', codein: 'BRL', bid: '6.1834', ask: '6.1901', timestamp: '1763143140', create_date: '2025-11-14 14:59:00' } };

  it('usa a cotação intradiária da AwesomeAPI com o horário informado pela API', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = ((url: string, init?: RequestInit) => (calls.push({ url, init }), ok(awesome))) as unknown as typeof fetch;
    const q = await fetchRate('EUR', 'BRL', f);
    expect(q.rate).toBe(6.1834);
    expect(q.quotedAt).toBe(new Date(1763143140 * 1000).toISOString());
    expect(q.dateOnly).toBe(false);
    expect(q.provider).toBe('AwesomeAPI');
    // Sem cache: no-store + parâmetro único na URL.
    expect(calls[0].init?.cache).toBe('no-store');
    expect(calls[0].url).toMatch(/EUR-BRL\?_=\d+/);
  });
  it('separa horário da consulta do horário de referência', async () => {
    const f = (() => ok(awesome)) as unknown as typeof fetch;
    const q = await fetchRate('EUR', 'BRL', f);
    expect(q.fetchedAt).not.toBe(q.quotedAt);
  });
  it('cai para o BCE (somente data) quando a AwesomeAPI falha', async () => {
    const f = ((url: string) =>
      url.includes('awesomeapi') ? Promise.reject(new Error('down')) : ok({ date: '2026-11-13', rates: { BRL: 6.1 } })) as unknown as typeof fetch;
    const q = await fetchRate('EUR', 'BRL', f);
    expect(q.rate).toBe(6.1);
    expect(q.dateOnly).toBe(true);
    expect(q.quotedAt.startsWith('2026-11-13')).toBe(true);
  });
  it('cai para o terceiro provedor', async () => {
    const f = ((url: string) =>
      url.includes('er-api') ? ok({ result: 'success', time_last_update_unix: 1763000000, rates: { BRL: 6.2 } }) : Promise.resolve(new Response('x', { status: 500 }))) as unknown as typeof fetch;
    expect((await fetchRate('EUR', 'BRL', f)).rate).toBe(6.2);
  });
  it('falha sem inventar valor', async () => {
    const f = (() => Promise.resolve(new Response('x', { status: 503 }))) as unknown as typeof fetch;
    await expect(fetchRate('EUR', 'BRL', f)).rejects.toBeInstanceOf(RateUnavailableError);
  });
  it('identifica a última cotação disponível em fins de semana', () => {
    // sexta 13/11/2026 17:59 em Dublin, consultada no sábado 14/11
    const friday = { quotedAt: '2026-11-13T17:59:00Z', dateOnly: false };
    expect(describeQuoteTime(friday, 'Europe/Dublin', '2026-11-14').label).toBe('Última cotação disponível: sex, 13 nov 2026, 17:59');
    expect(describeQuoteTime(friday, 'Europe/Dublin', '2026-11-13').label).toBe('Cotação de sex, 13 nov 2026, 17:59');
    expect(describeQuoteTime({ quotedAt: '2026-11-13T12:00:00Z', dateOnly: true }, 'Europe/Dublin', '2026-11-13').label).toBe('Cotação de referência de sex, 13 nov 2026');
  });
  it('converte centavos e recalcula com a nova cotação', () => {
    expect(convertCents(10000, 6.1234)).toBe(61234);
    expect(convertCents(12345, 6.2)).toBe(76539);
  });
});

describe('máscara monetária', () => {
  const show = (digits: string) => formatMaskedInput(digitsToCents(digits), 'EUR');
  it('insere a vírgula decimal automaticamente', () => {
    expect(show('1')).toBe('€ 0,01');
    expect(show('12')).toBe('€ 0,12');
    expect(show('123')).toBe('€ 1,23');
    expect(show('1234')).toBe('€ 12,34');
    expect(show('12345')).toBe('€ 123,45');
    expect(show('123456')).toBe('€ 1.234,56');
  });
  it('lê o texto já formatado ao digitar mais um número', () => {
    expect(digitsToCents('€ 123,456')).toBe(123456);
    expect(digitsToCents('€ 0,012')).toBe(12);
    expect(digitsToCents('€ 1.234,5')).toBe(12345); // apagar o último dígito
    expect(digitsToCents('')).toBeNull();
    expect(digitsToCents('€ ')).toBeNull();
  });
  it('mantém o símbolo da moeda', () => {
    expect(formatMaskedInput(12345, 'BRL')).toBe('R$ 123,45');
  });
  it('lançamentos exatos: +123,45 e −12,30', () => {
    const inc = tx({ type: 'income', amount: digitsToCents('12345')! });
    const exp = tx({ type: 'expense', amount: digitsToCents('1230')! });
    expect(computeBalance(100000, [inc]) - 100000).toBe(12345);
    expect(computeBalance(100000, [inc, exp])).toBe(100000 + 12345 - 1230);
  });
  it('editar um valor não o multiplica nem divide', () => {
    const t = tx({ id: 'a', type: 'income', amount: 12345 });
    // reabrir o formulário mostra os centavos armazenados sem conversão
    expect(formatMaskedInput(t.amount, 'EUR')).toBe('€ 123,45');
    expect(digitsToCents(formatMaskedInput(t.amount, 'EUR'))).toBe(12345);
  });
});
