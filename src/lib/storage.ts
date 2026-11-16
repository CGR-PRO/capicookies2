/**
 * Camada de persistência.
 *
 * `DataStore` é a interface usada por todo o aplicativo. A implementação padrão grava
 * localmente no IndexedDB do navegador (os dados sobrevivem a recarregamentos e ao
 * fechamento do navegador e nunca ficam no código-fonte).
 *
 * Para sincronizar entre dispositivos, basta criar outra implementação de `DataStore`
 * (por exemplo, sobre uma API autenticada ou Supabase/Firebase) e registrá-la em
 * `createStore()`. Nenhum componente precisa ser alterado.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Account, AgendaEvent, Category, MediaRecord, RecurringExpense, Transaction, Transfer } from './types';

export interface Collections {
  categories: Category;
  transactions: Transaction;
  recurring: RecurringExpense;
  events: AgendaEvent;
  media: MediaRecord;
  accounts: Account;
  transfers: Transfer;
}

export type CollectionName = keyof Collections;

export interface DataStore {
  list<C extends CollectionName>(col: C): Promise<Collections[C][]>;
  get<C extends CollectionName>(col: C, id: string): Promise<Collections[C] | undefined>;
  put<C extends CollectionName>(col: C, item: Collections[C]): Promise<void>;
  putMany<C extends CollectionName>(col: C, items: Collections[C][]): Promise<void>;
  remove<C extends CollectionName>(col: C, id: string): Promise<void>;
  getKV<T>(key: string): Promise<T | undefined>;
  setKV<T>(key: string, value: T): Promise<void>;
  clearAll(): Promise<void>;
}

interface AppDB extends DBSchema {
  categories: { key: string; value: Category };
  transactions: { key: string; value: Transaction; indexes: { by_date: string } };
  recurring: { key: string; value: RecurringExpense };
  events: { key: string; value: AgendaEvent; indexes: { by_start: string } };
  media: { key: string; value: MediaRecord };
  accounts: { key: string; value: Account };
  transfers: { key: string; value: Transfer; indexes: { by_date: string } };
  kv: { key: string; value: unknown };
}

const DB_NAME = 'agenda-financeira';
/** v1: dados originais · v2: contas e transferências (migração não destrutiva). */
const DB_VERSION = 2;

export class IndexedDBStore implements DataStore {
  private dbp: Promise<IDBPDatabase<AppDB>>;

  constructor(name = DB_NAME) {
    this.dbp = openDB<AppDB>(name, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Só cria o que falta: os dados existentes nunca são apagados na atualização.
        if (oldVersion < 1) {
          db.createObjectStore('categories', { keyPath: 'id' });
          const tx = db.createObjectStore('transactions', { keyPath: 'id' });
          tx.createIndex('by_date', 'date');
          db.createObjectStore('recurring', { keyPath: 'id' });
          const ev = db.createObjectStore('events', { keyPath: 'id' });
          ev.createIndex('by_start', 'start');
          db.createObjectStore('media', { keyPath: 'id' });
          db.createObjectStore('kv');
        }
        if (oldVersion < 2) {
          db.createObjectStore('accounts', { keyPath: 'id' });
          const tr = db.createObjectStore('transfers', { keyPath: 'id' });
          tr.createIndex('by_date', 'date');
        }
      },
    });
  }

  async list<C extends CollectionName>(col: C): Promise<Collections[C][]> {
    const db = await this.dbp;
    return (await db.getAll(col as any)) as Collections[C][];
  }

  async get<C extends CollectionName>(col: C, id: string): Promise<Collections[C] | undefined> {
    const db = await this.dbp;
    return (await db.get(col as any, id)) as Collections[C] | undefined;
  }

  async put<C extends CollectionName>(col: C, item: Collections[C]): Promise<void> {
    const db = await this.dbp;
    await db.put(col as any, item as any);
  }

  async putMany<C extends CollectionName>(col: C, items: Collections[C][]): Promise<void> {
    const db = await this.dbp;
    const tx = db.transaction(col as any, 'readwrite');
    await Promise.all([...items.map((i) => tx.store.put(i as any)), tx.done]);
  }

  async remove<C extends CollectionName>(col: C, id: string): Promise<void> {
    const db = await this.dbp;
    await db.delete(col as any, id);
  }

  async getKV<T>(key: string): Promise<T | undefined> {
    const db = await this.dbp;
    return (await db.get('kv', key)) as T | undefined;
  }

  async setKV<T>(key: string, value: T): Promise<void> {
    const db = await this.dbp;
    await db.put('kv', value, key);
  }

  async clearAll(): Promise<void> {
    const db = await this.dbp;
    const names = ['categories', 'transactions', 'recurring', 'events', 'media', 'accounts', 'transfers', 'kv'] as const;
    const tx = db.transaction(names as any, 'readwrite');
    await Promise.all([...names.map((n) => tx.objectStore(n as any).clear()), tx.done]);
  }
}

export function createStore(): DataStore {
  return new IndexedDBStore();
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
