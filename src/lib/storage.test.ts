import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { IndexedDBStore } from './storage';

describe('IndexedDBStore', () => {
  it('persiste, atualiza e remove registros', async () => {
    const s = new IndexedDBStore('test-db');
    const base = { type: 'income' as const, accountId: 'main', amount: 100, description: 'a', categoryId: null, date: '2026-11-01', createdAt: '', updatedAt: '' };
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

  it('atualiza um banco v1 para v2 sem perder dados', async () => {
    // Simula o banco da versão anterior (sem contas nem transferências).
    const old = await openDB('upgrade-db', 1, {
      upgrade(db) {
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('transactions', { keyPath: 'id' }).createIndex('by_date', 'date');
        db.createObjectStore('recurring', { keyPath: 'id' });
        db.createObjectStore('events', { keyPath: 'id' }).createIndex('by_start', 'start');
        db.createObjectStore('media', { keyPath: 'id' });
        db.createObjectStore('kv');
      },
    });
    await old.put('transactions', { id: 'old', type: 'income', amount: 5000, description: 'antigo', categoryId: null, date: '2026-10-01', createdAt: '', updatedAt: '' });
    await old.put('kv', { initialBalance: 100000, primaryCurrency: 'EUR' }, 'settings');
    old.close();

    const s = new IndexedDBStore('upgrade-db');
    expect(await s.list('transactions')).toHaveLength(1);
    expect(await s.getKV('settings')).toEqual({ initialBalance: 100000, primaryCurrency: 'EUR' });
    expect(await s.list('accounts')).toEqual([]);
    await s.put('accounts', { id: 'a', name: 'Conta Principal', initialBalance: 100000, currency: 'EUR', color: '#000', icon: 'wallet', isPrimary: true, archived: false, order: 0, createdAt: '', updatedAt: '' });
    expect(await s.list('accounts')).toHaveLength(1);
    expect(await s.list('transfers')).toEqual([]);
  });
});
