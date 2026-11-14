import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDBStore } from './storage';

describe('IndexedDBStore', () => {
  it('persiste, atualiza e remove registros', async () => {
    const s = new IndexedDBStore('test-db');
    const base = { type: 'income' as const, amount: 100, description: 'a', categoryId: null, date: '2026-11-01', createdAt: '', updatedAt: '' };
    await s.put('transactions', { id: '1', ...base });
    await s.put('transactions', { id: '1', ...base, amount: 250 });
    expect(await s.list('transactions')).toHaveLength(1);
    expect((await s.get('transactions', '1'))?.amount).toBe(250);
    await s.setKV('settings', { a: 1 });
    expect(await s.getKV('settings')).toEqual({ a: 1 });
    // nova instância lê os mesmos dados (persistência)
    const s2 = new IndexedDBStore('test-db');
    expect(await s2.list('transactions')).toHaveLength(1);
    await s2.remove('transactions', '1');
    expect(await s.list('transactions')).toHaveLength(0);
  });
});
