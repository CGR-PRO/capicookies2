import { useMemo, useState, type ReactElement } from 'react';
import { Archive, ArchiveRestore, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Landmark, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../store/DataProvider';
import { useFinance } from '../store/useFinance';
import { useToast } from '../store/ToastProvider';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { GlassCard, PageHeader, EmptyState, Badge } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { AnimatedMoney } from '../components/ui/AnimatedMoney';
import { AccountIcon } from '../components/accounts/AccountIcon';
import { AccountForm } from '../components/accounts/AccountForm';
import { TransferForm } from '../components/accounts/TransferForm';
import { TransactionForm } from '../components/finance/TransactionForm';
import { accountHasMovements, accountHistory, type HistoryRow } from '../lib/accounts';
import { formatMoney } from '../lib/money';
import { formatDate } from '../lib/dates';
import type { Account, Transaction, Transfer } from '../lib/types';

const PAGE = 40;

export default function Contas() {
  const { accounts, activeAccounts, transactions, transfers, recurring, settings, accountById, primaryAccount, setAccountArchived, deleteAccount, deleteTransfer } = useData();
  const { balances, toPrimary, consolidated } = useFinance();
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string>(primaryAccount.id);
  const [accountForm, setAccountForm] = useState<{ open: boolean; editing: Account | null }>({ open: false, editing: null });
  const [transferForm, setTransferForm] = useState<{ open: boolean; editing: Transfer | null; from?: string }>({ open: false, editing: null });
  const [txEditing, setTxEditing] = useState<Transaction | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const archived = accounts.filter((a) => a.archived);
  const selected = accountById(selectedId) ?? primaryAccount;
  const history = useMemo(() => accountHistory(selected, transactions, transfers), [selected, transactions, transfers]);
  const cur = settings.primaryCurrency;

  const archive = async (a: Account, value: boolean) => {
    if (value) {
      const bal = balances.get(a.id) ?? 0;
      const ok = await confirm({
        title: `Arquivar “${a.name}”?`,
        message:
          bal !== 0
            ? `A conta ainda tem saldo de ${formatMoney(bal, a.currency)}. Ela sai das listas e dos formulários, mas o histórico e o saldo continuam no total consolidado. Considere transferir o saldo antes.`
            : 'A conta sai das listas e dos formulários. O histórico é preservado e você pode reativá-la quando quiser.',
        confirmLabel: 'Arquivar',
      });
      if (!ok) return;
    }
    try {
      await setAccountArchived(a.id, value);
      toast.success(value ? 'Conta arquivada.' : 'Conta reativada.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (a: Account) => {
    const ok = await confirm({ title: `Excluir “${a.name}”?`, message: 'A conta não tem movimentações e será removida definitivamente.', confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try {
      await deleteAccount(a.id);
      if (selectedId === a.id) setSelectedId(primaryAccount.id);
      toast.success('Conta excluída.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeTransfer = async (tr: Transfer) => {
    const from = accountById(tr.fromAccountId);
    const ok = await confirm({
      title: 'Excluir transferência?',
      message: `A transferência de ${formatMoney(tr.amount, from?.currency ?? cur)} será desfeita e os saldos das duas contas recalculados.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTransfer(tr.id);
      toast.success('Transferência excluída.');
    } catch {
      toast.error('Não foi possível excluir.');
    }
  };

  const card = (a: Account) => {
    const bal = balances.get(a.id) ?? 0;
    const conv = a.currency !== cur ? toPrimary(bal, a.currency) : null;
    const canDelete = !a.isPrimary && !accountHasMovements(a.id, transactions, transfers, recurring);
    return (
      <li key={a.id}>
        <article className={`glass card card--padded account-card${a.id === selected.id ? ' is-selected' : ''}${a.archived ? ' is-archived' : ''}`} style={{ ['--acc-color' as string]: a.color }}>
          <button className="account-card__main" onClick={() => { setSelectedId(a.id); setLimit(PAGE); }} aria-pressed={a.id === selected.id} aria-label={`Ver movimentações de ${a.name}`}>
            <AccountIcon account={a} size={42} />
            <span className="account-card__text">
              <span className="account-card__name">{a.name}</span>
              <span className="muted small">
                {a.currency} · {a.isPrimary ? 'Conta principal' : a.archived ? 'Arquivada' : 'Secundária'}
              </span>
            </span>
          </button>
          <AnimatedMoney className={`account-card__balance${bal < 0 ? ' is-negative' : ''}`} cents={bal} currency={a.currency} />
          <p className="muted small">
            Saldo inicial {formatMoney(a.initialBalance, a.currency)}
            {a.currency !== cur && (conv !== null ? ` · ≈ ${formatMoney(conv, cur)}` : ' · sem cotação agora')}
          </p>
          <div className="account-card__actions">
            <button className="icon-btn" onClick={() => setAccountForm({ open: true, editing: a })} aria-label={`Editar ${a.name}`} title="Editar">
              <Pencil size={16} />
            </button>
            {!a.archived && activeAccounts.length > 1 && (
              <button className="icon-btn" onClick={() => setTransferForm({ open: true, editing: null, from: a.id })} aria-label={`Transferir de ${a.name}`} title="Transferir">
                <ArrowLeftRight size={16} />
              </button>
            )}
            {!a.isPrimary && (
              <button className="icon-btn" onClick={() => archive(a, !a.archived)} aria-label={a.archived ? `Reativar ${a.name}` : `Arquivar ${a.name}`} title={a.archived ? 'Reativar' : 'Arquivar'}>
                {a.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            )}
            {canDelete && (
              <button className="icon-btn icon-btn--danger" onClick={() => remove(a)} aria-label={`Excluir ${a.name}`} title="Excluir">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </article>
      </li>
    );
  };

  const rowMeta: Record<HistoryRow['kind'], { label: string; icon: ReactElement; cls: string }> = {
    income: { label: 'Entrada', icon: <TrendingUp size={14} />, cls: 'amount--income' },
    expense: { label: 'Despesa', icon: <TrendingDown size={14} />, cls: 'amount--expense' },
    'transfer-in': { label: 'Transferência recebida', icon: <ArrowDownLeft size={14} />, cls: 'amount--transfer' },
    'transfer-out': { label: 'Transferência enviada', icon: <ArrowUpRight size={14} />, cls: 'amount--transfer' },
  };

  return (
    <div className="page">
      <PageHeader
        title="Contas"
        subtitle="Contas manuais: cada movimentação altera somente a conta escolhida."
        actions={
          <>
            <Button variant="glass" icon={<ArrowLeftRight size={18} />} onClick={() => setTransferForm({ open: true, editing: null })} disabled={activeAccounts.length < 2}>
              Transferir
            </Button>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAccountForm({ open: true, editing: null })}>
              Nova conta
            </Button>
          </>
        }
      />

      <div className="stats-row">
        <GlassCard className="stat-card" title="Saldo total consolidado" icon={<Landmark size={18} />}>
          <p className="stat-value">
            <AnimatedMoney cents={consolidated.total} currency={cur} />
          </p>
          <p className="muted small">
            {accounts.length} conta(s){consolidated.missing.length ? ` · sem cotação: ${consolidated.missing.map((a) => a.name).join(', ')}` : ''}
          </p>
        </GlassCard>
      </div>

      <ul className="account-grid" aria-label="Contas ativas">
        {activeAccounts.map(card)}
      </ul>

      {archived.length > 0 && (
        <details className="archived-block">
          <summary>Contas arquivadas ({archived.length})</summary>
          <ul className="account-grid">{archived.map(card)}</ul>
        </details>
      )}

      <GlassCard
        title={
          <span className="inline-flex">
            Movimentações — {selected.name}
          </span>
        }
        icon={<AccountIcon account={selected} size={22} />}
        actions={<span className="total-pill">Saldo: {formatMoney(balances.get(selected.id) ?? 0, selected.currency)}</span>}
      >
        {history.length === 0 ? (
          <EmptyState icon={<Landmark size={28} />} title="Nenhuma movimentação nesta conta">
            Registre entradas, despesas ou transferências escolhendo esta conta.
          </EmptyState>
        ) : (
          <>
            <ul className="tx-list history-list">
              {history.slice(0, limit).map((r) => {
                const meta = rowMeta[r.kind];
                const other = r.counterpartId ? accountById(r.counterpartId) : undefined;
                return (
                  <li key={r.key} className="tx-row">
                    <span className={`history-kind history-kind--${r.kind}`} aria-hidden>
                      {meta.icon}
                    </span>
                    <div className="tx-row__main">
                      <span className="tx-row__desc">{r.description}</span>
                      <span className="tx-row__meta">
                        {formatDate(r.date)} · {meta.label}
                        {other && (r.kind === 'transfer-in' ? ` de ${other.name}` : ` para ${other.name}`)}
                      </span>
                    </div>
                    <span className="history-amounts">
                      <span className={`tx-row__amount ${meta.cls}`}>
                        {r.delta > 0 ? '+' : '−'} {formatMoney(Math.abs(r.delta), selected.currency)}
                      </span>
                      <span className="muted small">saldo {formatMoney(r.balanceAfter, selected.currency)}</span>
                    </span>
                    <div className="tx-row__actions">
                      <button
                        className="icon-btn"
                        onClick={() => (r.transaction ? setTxEditing(r.transaction) : r.transfer && setTransferForm({ open: true, editing: r.transfer }))}
                        aria-label={`Editar ${r.description}`}
                      >
                        <Pencil size={16} />
                      </button>
                      {r.transfer && (
                        <button className="icon-btn icon-btn--danger" onClick={() => removeTransfer(r.transfer!)} aria-label={`Excluir ${r.description}`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {history.length > limit && (
              <div className="row center">
                <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
                  Mostrar mais ({history.length - limit})
                </Button>
              </div>
            )}
            <p className="muted small">
              <Badge tone="info">Transferências</Badge> movem dinheiro entre suas contas e não contam como ganho nem gasto no resultado mensal.
            </p>
          </>
        )}
      </GlassCard>

      <AccountForm open={accountForm.open} editing={accountForm.editing} onClose={() => setAccountForm({ open: false, editing: null })} onSaved={(a) => setSelectedId(a.id)} />
      <TransferForm open={transferForm.open} editing={transferForm.editing} defaultFromId={transferForm.from} onClose={() => setTransferForm({ open: false, editing: null })} />
      <TransactionForm open={!!txEditing} editing={txEditing} onClose={() => setTxEditing(null)} />
    </div>
  );
}
