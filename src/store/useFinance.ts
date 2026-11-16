import { useCallback, useMemo } from 'react';
import { useData } from './DataProvider';
import { useRates } from './RatesProvider';
import { accountBalances, buildLedger, identity, viewTransactions, type Converter, type Ledger } from '../lib/accounts';
import { convertCents, type RateQuote } from '../lib/currency';
import type { Account, Transaction } from '../lib/types';

/** Filtro de contas usado no dashboard e nas listas: todas ou uma conta específica. */
export type AccountFilter = 'all' | string;

export interface FinanceView {
  /** Moeda em que os valores do filtro são exibidos. */
  currency: string;
  accounts: Account[];
  /** Entradas e despesas do filtro, na moeda de exibição (sem transferências). */
  transactions: Transaction[];
  ledger: Ledger;
  /** Contas excluídas dos totais por falta de cotação. */
  missing: Account[];
}

/**
 * Visão financeira consolidada. Contas em outras moedas são convertidas para a moeda
 * principal com a cotação mais recente obtida nesta sessão (sem histórico de cotações).
 */
export function useFinance() {
  const { accounts, transactions, transfers, settings, accountById } = useData();
  const { accountQuotes } = useRates();
  const primary = settings.primaryCurrency;

  const toPrimary = useCallback(
    (cents: number, currency: string): number | null => {
      if (currency === primary) return cents;
      const q = accountQuotes[currency];
      return q && q.target === primary ? convertCents(cents, q.rate) : null;
    },
    [accountQuotes, primary],
  );

  const convAll: Converter = useCallback(
    (cents, accountId) => toPrimary(cents, accountById(accountId)?.currency ?? primary),
    [toPrimary, accountById, primary],
  );

  const balances = useMemo(() => accountBalances(accounts, transactions, transfers), [accounts, transactions, transfers]);

  const consolidated = useMemo(() => {
    let total = 0;
    const missing: Account[] = [];
    for (const a of accounts) {
      const v = toPrimary(balances.get(a.id) ?? 0, a.currency);
      if (v === null) missing.push(a);
      else total += v;
    }
    return { total, missing };
  }, [accounts, balances, toPrimary]);

  /** Cotações usadas na consolidação (para mostrar a data de cada uma). */
  const usedQuotes = useMemo(() => {
    const list: RateQuote[] = [];
    for (const c of new Set(accounts.map((a) => a.currency))) if (c !== primary && accountQuotes[c]) list.push(accountQuotes[c]);
    return list;
  }, [accounts, accountQuotes, primary]);

  const view = useCallback(
    (filter: AccountFilter): FinanceView => {
      const single = filter !== 'all' ? accountById(filter) : undefined;
      const accs = single ? [single] : accounts;
      const conv = single ? identity : convAll;
      const ids = new Set(accs.map((a) => a.id));
      const tx = viewTransactions(transactions, ids, conv);
      const ledger = buildLedger(accs, transactions, transfers, conv);
      const missingIds = new Set([...tx.missing, ...ledger.missing]);
      return {
        currency: single ? single.currency : primary,
        accounts: accs,
        transactions: tx.items.filter((t) => !missingIds.has(t.accountId)),
        ledger,
        missing: accs.filter((a) => missingIds.has(a.id)),
      };
    },
    [accountById, accounts, convAll, transactions, transfers, primary],
  );

  /** Lançamentos originais (valor na moeda da conta) — use em listas e edição, nunca o convertido. */
  const byId = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const originals = useCallback((items: Transaction[]) => items.map((t) => byId.get(t.id) ?? t), [byId]);

  return { primary, toPrimary, convAll, balances, consolidated, usedQuotes, view, originals };
}
