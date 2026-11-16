import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createStore, newId, type DataStore } from '../lib/storage';
import { defaultCategories, mergeSettings } from '../lib/defaults';
import { todayInTz } from '../lib/dates';
import { paymentKey } from '../lib/recurrence';
import { accountHasMovements, migrateToAccounts, sortAccounts, validateTransfer } from '../lib/accounts';
import type { Account, AgendaEvent, Category, MediaRecord, RecurringExpense, Settings, Transaction, Transfer } from '../lib/types';

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type CategoryInput = Omit<Category, 'id' | 'createdAt'> & { id?: string };
export type RecurringInput = Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isPrimary' | 'archived' | 'order'> & { id?: string };
export type TransferInput = Omit<Transfer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type EventInput = Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt' | 'remindedAt'> & { id?: string };

export interface BackupFile {
  app: 'agenda-financeira';
  /** 1 = antes das contas (importado com migração automática); 2 = com contas e transferências. */
  version: 1 | 2;
  exportedAt: string;
  settings: Settings;
  accounts?: Account[];
  transfers?: Transfer[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringExpense[];
  events: AgendaEvent[];
}

interface DataState {
  ready: boolean;
  loadError: string | null;
  settings: Settings;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  recurring: RecurringExpense[];
  events: AgendaEvent[];
  media: Omit<MediaRecord, 'blob'>[];
  today: string;
}

interface DataApi extends DataState {
  store: DataStore;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  saveCategory(input: CategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  saveTransaction(input: TransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  saveAccount(input: AccountInput): Promise<Account>;
  setAccountArchived(id: string, archived: boolean): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  saveTransfer(input: TransferInput): Promise<Transfer>;
  deleteTransfer(id: string): Promise<void>;
  saveRecurring(input: RecurringInput): Promise<RecurringExpense>;
  deleteRecurring(id: string): Promise<void>;
  payOccurrence(recurringId: string, due: string, paidOn: string, amount: number, accountId?: string): Promise<Transaction>;
  saveEvent(input: EventInput): Promise<AgendaEvent>;
  deleteEvent(id: string): Promise<void>;
  setEventDone(id: string, done: boolean): Promise<void>;
  markReminded(id: string): Promise<void>;
  addMedia(file: File): Promise<string>;
  removeMedia(id: string): Promise<void>;
  getMediaBlob(id: string): Promise<Blob | undefined>;
  exportBackup(): BackupFile;
  importBackup(data: BackupFile): Promise<void>;
  resetAll(): Promise<void>;
  categoryById(id: string | null | undefined): Category | undefined;
  accountById(id: string | null | undefined): Account | undefined;
  /** Conta principal (sempre existe após o carregamento). */
  primaryAccount: Account;
  /** Contas não arquivadas, em ordem de exibição. */
  activeAccounts: Account[];
}

const DataContext = createContext<DataApi | null>(null);

const nowIso = () => new Date().toISOString();

const PLACEHOLDER_ACCOUNT: Account = {
  id: '',
  name: 'Conta Principal',
  initialBalance: 0,
  currency: 'EUR',
  color: '#2a78d6',
  icon: 'wallet',
  isPrimary: true,
  archived: false,
  order: 0,
  createdAt: '',
  updatedAt: '',
};

export function DataProvider({ children, store: injected }: { children: ReactNode; store?: DataStore }) {
  const storeRef = useRef<DataStore>(injected ?? createStore());
  const store = storeRef.current;
  const [state, setState] = useState<DataState>(() => ({
    ready: false,
    loadError: null,
    settings: mergeSettings(undefined),
    categories: [],
    accounts: [],
    transactions: [],
    transfers: [],
    recurring: [],
    events: [],
    media: [],
    today: todayInTz(mergeSettings(undefined).timezone),
  }));
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const [savedSettings, categories, savedAccounts, savedTransactions, transfers, savedRecurring, events, media, seeded] = await Promise.all([
        store.getKV<Partial<Settings>>('settings'),
        store.list('categories'),
        store.list('accounts'),
        store.list('transactions'),
        store.list('transfers'),
        store.list('recurring'),
        store.list('events'),
        store.list('media'),
        store.getKV<boolean>('seeded'),
      ]);
      let cats = categories;
      if (!seeded && cats.length === 0) {
        cats = defaultCategories(nowIso(), newId);
        await store.putMany('categories', cats);
        await store.setKV('seeded', true);
      }
      const settings = mergeSettings(savedSettings);
      // Migração segura para contas: cria a Conta Principal com o saldo inicial existente
      // e associa a ela os lançamentos antigos. Nada é apagado; rodar de novo não muda nada.
      const mig = migrateToAccounts(settings, savedAccounts, savedTransactions, savedRecurring, newId, nowIso());
      if (mig.created) await store.put('accounts', mig.created);
      if (mig.transactions.length) await store.putMany('transactions', mig.transactions);
      if (mig.recurring.length) await store.putMany('recurring', mig.recurring);
      const txFix = new Map(mig.transactions.map((t) => [t.id, t]));
      const recFix = new Map(mig.recurring.map((r) => [r.id, r]));
      setState({
        ready: true,
        loadError: null,
        settings,
        categories: cats,
        accounts: mig.accounts,
        transactions: savedTransactions.map((t) => txFix.get(t.id) ?? t),
        transfers,
        recurring: savedRecurring.map((r) => recFix.get(r.id) ?? r),
        events,
        media: media.map(({ blob: _b, ...m }) => m),
        today: todayInTz(settings.timezone),
      });
    } catch (e) {
      console.error(e);
      setState((s) => ({
        ...s,
        ready: true,
        loadError: 'Não foi possível acessar o armazenamento local do navegador. Verifique se o modo privado ou bloqueio de dados está ativo.',
      }));
    }
  }, [store]);

  useEffect(() => {
    load();
    // Pede ao navegador armazenamento persistente (evita limpeza automática dos dados).
    navigator.storage?.persist?.().catch(() => undefined);
  }, [load]);

  // Mantém "hoje" atualizado no fuso configurado.
  useEffect(() => {
    const tick = () => {
      const t = todayInTz(stateRef.current.settings.timezone);
      if (t !== stateRef.current.today) setState((s) => ({ ...s, today: t }));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [state.settings.timezone]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = mergeSettings({ ...stateRef.current.settings, ...patch });
      await store.setKV('settings', next);
      setState((s) => ({ ...s, settings: next, today: todayInTz(next.timezone) }));
    },
    [store],
  );

  const saveCategory = useCallback(
    async (input: CategoryInput) => {
      const name = input.name.trim();
      if (!name) throw new Error('Informe o nome da categoria.');
      const dup = stateRef.current.categories.find(
        (c) => c.type === input.type && c.name.toLowerCase() === name.toLowerCase() && c.id !== input.id,
      );
      if (dup) throw new Error('Já existe uma categoria com esse nome.');
      const existing = input.id ? stateRef.current.categories.find((c) => c.id === input.id) : undefined;
      const cat: Category = { ...input, name, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? nowIso() };
      await store.put('categories', cat);
      setState((s) => ({ ...s, categories: existing ? s.categories.map((c) => (c.id === cat.id ? cat : c)) : [...s.categories, cat] }));
      return cat;
    },
    [store],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const s0 = stateRef.current;
      const now = nowIso();
      const affectedTx = s0.transactions.filter((t) => t.categoryId === id).map((t) => ({ ...t, categoryId: null, updatedAt: now }));
      const affectedRec = s0.recurring.filter((r) => r.categoryId === id).map((r) => ({ ...r, categoryId: null, updatedAt: now }));
      if (affectedTx.length) await store.putMany('transactions', affectedTx);
      if (affectedRec.length) await store.putMany('recurring', affectedRec);
      await store.remove('categories', id);
      const txMap = new Map(affectedTx.map((t) => [t.id, t]));
      const recMap = new Map(affectedRec.map((r) => [r.id, r]));
      setState((s) => ({
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        transactions: s.transactions.map((t) => txMap.get(t.id) ?? t),
        recurring: s.recurring.map((r) => recMap.get(r.id) ?? r),
      }));
    },
    [store],
  );

  const saveTransaction = useCallback(
    async (input: TransactionInput) => {
      if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('O valor deve ser maior que zero.');
      if (!input.description.trim()) throw new Error('Informe uma descrição.');
      if (!stateRef.current.accounts.some((a) => a.id === input.accountId)) throw new Error('Selecione uma conta válida.');
      const existing = input.id ? stateRef.current.transactions.find((t) => t.id === input.id) : undefined;
      const now = nowIso();
      const tx: Transaction = {
        ...input,
        description: input.description.trim(),
        id: existing?.id ?? newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await store.put('transactions', tx);
      // Substitui pelo id (nunca acrescenta um duplicado ao editar).
      setState((s) => ({
        ...s,
        transactions: existing ? s.transactions.map((t) => (t.id === tx.id ? tx : t)) : [...s.transactions, tx],
      }));
      return tx;
    },
    [store],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await store.remove('transactions', id);
      setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
    },
    [store],
  );

  const saveAccount = useCallback(
    async (input: AccountInput) => {
      const name = input.name.trim();
      if (!name) throw new Error('Informe o nome da conta.');
      if (name.length > 40) throw new Error('O nome deve ter no máximo 40 caracteres.');
      if (!Number.isInteger(input.initialBalance)) throw new Error('Saldo inicial inválido.');
      const s0 = stateRef.current;
      if (s0.accounts.some((a) => a.id !== input.id && a.name.toLowerCase() === name.toLowerCase())) throw new Error('Já existe uma conta com esse nome.');
      const existing = input.id ? s0.accounts.find((a) => a.id === input.id) : undefined;
      if (existing && existing.currency !== input.currency && accountHasMovements(existing.id, s0.transactions, s0.transfers, [])) {
        throw new Error('A moeda não pode ser alterada em uma conta que já tem movimentações.');
      }
      const now = nowIso();
      const acc: Account = {
        ...input,
        name,
        id: existing?.id ?? newId(),
        isPrimary: existing?.isPrimary ?? false,
        archived: existing?.archived ?? false,
        order: existing?.order ?? Math.max(0, ...s0.accounts.map((a) => a.order)) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await store.put('accounts', acc);
      setState((s) => ({ ...s, accounts: existing ? s.accounts.map((a) => (a.id === acc.id ? acc : a)) : [...s.accounts, acc] }));
      return acc;
    },
    [store],
  );

  const setAccountArchived = useCallback(
    async (id: string, archived: boolean) => {
      const acc = stateRef.current.accounts.find((a) => a.id === id);
      if (!acc) throw new Error('Conta não encontrada.');
      if (acc.isPrimary && archived) throw new Error('A conta principal não pode ser arquivada.');
      const next = { ...acc, archived, updatedAt: nowIso() };
      await store.put('accounts', next);
      setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? next : a)) }));
    },
    [store],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const s0 = stateRef.current;
      const acc = s0.accounts.find((a) => a.id === id);
      if (!acc) return;
      if (acc.isPrimary) throw new Error('A conta principal não pode ser excluída.');
      if (accountHasMovements(id, s0.transactions, s0.transfers, s0.recurring)) {
        throw new Error('Esta conta tem movimentações. Arquive-a para preservar o histórico.');
      }
      await store.remove('accounts', id);
      setState((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }));
    },
    [store],
  );

  const saveTransfer = useCallback(
    async (input: TransferInput) => {
      const err = validateTransfer(input, stateRef.current.accounts);
      if (err) throw new Error(err);
      const existing = input.id ? stateRef.current.transfers.find((t) => t.id === input.id) : undefined;
      const now = nowIso();
      const tr: Transfer = {
        ...input,
        description: input.description.trim() || 'Transferência entre contas',
        id: existing?.id ?? newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await store.put('transfers', tr);
      setState((s) => ({ ...s, transfers: existing ? s.transfers.map((t) => (t.id === tr.id ? tr : t)) : [...s.transfers, tr] }));
      return tr;
    },
    [store],
  );

  const deleteTransfer = useCallback(
    async (id: string) => {
      await store.remove('transfers', id);
      setState((s) => ({ ...s, transfers: s.transfers.filter((t) => t.id !== id) }));
    },
    [store],
  );

  const saveRecurring = useCallback(
    async (input: RecurringInput) => {
      if (!input.name.trim()) throw new Error('Informe o nome da despesa.');
      if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('O valor deve ser maior que zero.');
      const existing = input.id ? stateRef.current.recurring.find((r) => r.id === input.id) : undefined;
      const now = nowIso();
      const rec: RecurringExpense = {
        ...input,
        name: input.name.trim(),
        id: existing?.id ?? newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await store.put('recurring', rec);
      setState((s) => ({ ...s, recurring: existing ? s.recurring.map((r) => (r.id === rec.id ? rec : r)) : [...s.recurring, rec] }));
      return rec;
    },
    [store],
  );

  const deleteRecurring = useCallback(
    async (id: string) => {
      // Os pagamentos já realizados permanecem no histórico (o dinheiro realmente saiu).
      await store.remove('recurring', id);
      setState((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id) }));
    },
    [store],
  );

  const payOccurrence = useCallback(
    async (recurringId: string, due: string, paidOn: string, amount: number, accountId?: string) => {
      const s0 = stateRef.current;
      const rec = s0.recurring.find((r) => r.id === recurringId);
      if (!rec) throw new Error('Despesa fixa não encontrada.');
      const already = s0.transactions.find((t) => t.recurringId && paymentKey(t.recurringId, t.recurringDue ?? '') === paymentKey(recurringId, due));
      if (already) throw new Error('Este vencimento já foi pago.');
      const primaryId = s0.accounts.find((a) => a.isPrimary)?.id ?? '';
      return saveTransaction({
        type: 'expense',
        accountId: accountId ?? rec.accountId ?? primaryId,
        amount,
        description: rec.name,
        categoryId: rec.categoryId,
        date: paidOn,
        recurringId,
        recurringDue: due,
      });
    },
    [saveTransaction],
  );

  const saveEvent = useCallback(
    async (input: EventInput) => {
      if (!input.title.trim()) throw new Error('Informe um título.');
      if (input.end < input.start) throw new Error('O término deve ser posterior ao início.');
      const existing = input.id ? stateRef.current.events.find((e) => e.id === input.id) : undefined;
      const now = nowIso();
      const reminderChanged = !existing || existing.start !== input.start || existing.reminderMinutes !== input.reminderMinutes;
      const ev: AgendaEvent = {
        ...input,
        title: input.title.trim(),
        id: existing?.id ?? newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        remindedAt: reminderChanged ? undefined : existing?.remindedAt,
      };
      await store.put('events', ev);
      setState((s) => ({ ...s, events: existing ? s.events.map((e) => (e.id === ev.id ? ev : e)) : [...s.events, ev] }));
      return ev;
    },
    [store],
  );

  const patchEvent = useCallback(
    async (id: string, patch: Partial<AgendaEvent>) => {
      const ev = stateRef.current.events.find((e) => e.id === id);
      if (!ev) return;
      const next = { ...ev, ...patch, updatedAt: nowIso() };
      await store.put('events', next);
      setState((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? next : e)) }));
    },
    [store],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await store.remove('events', id);
      setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
    },
    [store],
  );

  const addMedia = useCallback(
    async (file: File) => {
      const rec: MediaRecord = { id: newId(), name: file.name, type: file.type, size: file.size, blob: file, createdAt: nowIso() };
      await store.put('media', rec);
      const { blob: _b, ...meta } = rec;
      setState((s) => ({ ...s, media: [...s.media, meta] }));
      return rec.id;
    },
    [store],
  );

  const removeMedia = useCallback(
    async (id: string) => {
      await store.remove('media', id);
      setState((s) => ({ ...s, media: s.media.filter((m) => m.id !== id) }));
    },
    [store],
  );

  const getMediaBlob = useCallback(async (id: string) => (await store.get('media', id))?.blob, [store]);

  const exportBackup = useCallback((): BackupFile => {
    const s = stateRef.current;
    return {
      app: 'agenda-financeira',
      version: 2,
      exportedAt: nowIso(),
      settings: s.settings,
      categories: s.categories,
      accounts: s.accounts,
      transactions: s.transactions,
      transfers: s.transfers,
      recurring: s.recurring,
      events: s.events,
    };
  }, []);

  const importBackup = useCallback(
    async (data: BackupFile) => {
      if (data?.app !== 'agenda-financeira' || !Array.isArray(data.transactions)) throw new Error('Arquivo de backup inválido.');
      const media = await store.list('media');
      await store.clearAll();
      await store.putMany('media', media);
      await store.setKV('seeded', true);
      const settings = mergeSettings(data.settings);
      await store.setKV('settings', settings);
      await store.putMany('categories', data.categories ?? []);
      // Backups antigos (v1) não têm contas: a migração em load() cria a Conta Principal.
      await store.putMany('accounts', data.accounts ?? []);
      await store.putMany('transfers', data.transfers ?? []);
      await store.putMany('transactions', data.transactions ?? []);
      await store.putMany('recurring', data.recurring ?? []);
      await store.putMany('events', data.events ?? []);
      await load();
    },
    [store, load],
  );

  const resetAll = useCallback(async () => {
    await store.clearAll();
    await load();
  }, [store, load]);

  const api = useMemo<DataApi>(() => {
    const catMap = new Map(state.categories.map((c) => [c.id, c]));
    const accMap = new Map(state.accounts.map((a) => [a.id, a]));
    const sorted = sortAccounts(state.accounts);
    return {
      ...state,
      store,
      updateSettings,
      saveCategory,
      deleteCategory,
      saveTransaction,
      deleteTransaction,
      saveAccount,
      setAccountArchived,
      deleteAccount,
      saveTransfer,
      deleteTransfer,
      saveRecurring,
      deleteRecurring,
      payOccurrence,
      saveEvent,
      deleteEvent,
      setEventDone: (id, done) => patchEvent(id, { done }),
      markReminded: (id) => patchEvent(id, { remindedAt: nowIso() }),
      addMedia,
      removeMedia,
      getMediaBlob,
      exportBackup,
      importBackup,
      resetAll,
      categoryById: (id) => (id ? catMap.get(id) : undefined),
      accountById: (id) => (id ? accMap.get(id) : undefined),
      // Antes do carregamento ainda não há contas: um marcador neutro evita checagens de null.
      primaryAccount: sorted.find((a) => a.isPrimary) ?? sorted[0] ?? PLACEHOLDER_ACCOUNT,
      activeAccounts: sorted.filter((a) => !a.archived),
    };
  }, [state, store, updateSettings, saveCategory, deleteCategory, saveTransaction, deleteTransaction, saveAccount, setAccountArchived, deleteAccount, saveTransfer, deleteTransfer, saveRecurring, deleteRecurring, payOccurrence, saveEvent, deleteEvent, patchEvent, addMedia, removeMedia, getMediaBlob, exportBackup, importBackup, resetAll]);

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useData(): DataApi {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData fora do DataProvider');
  return ctx;
}
