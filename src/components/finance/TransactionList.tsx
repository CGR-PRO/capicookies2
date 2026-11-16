import { Pencil, Repeat, Trash2 } from 'lucide-react';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { useConfirm } from '../ui/ConfirmDialog';
import { CategoryDot } from '../ui/Glass';
import { formatMoney } from '../../lib/money';
import { formatDate } from '../../lib/dates';
import type { Transaction } from '../../lib/types';

interface Props {
  items: Transaction[];
  onEdit?(t: Transaction): void;
  compact?: boolean;
  showActions?: boolean;
}

export function TransactionList({ items, onEdit, compact, showActions = true }: Props) {
  const { categoryById, accountById, accounts, primaryAccount, deleteTransaction } = useData();
  const showAccount = accounts.length > 1;
  const cur = (t: Transaction) => accountById(t.accountId)?.currency ?? primaryAccount.currency;
  const toast = useToast();
  const confirm = useConfirm();

  const remove = async (t: Transaction) => {
    const ok = await confirm({
      title: 'Excluir lançamento?',
      message: (
        <>
          <strong>{t.description}</strong> ({formatMoney(t.amount, cur(t))}) será removido e o saldo da conta recalculado.
          {t.recurringId && ' O vencimento do gasto fixo voltará a ficar pendente.'}
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTransaction(t.id);
      toast.success('Lançamento excluído.');
    } catch {
      toast.error('Não foi possível excluir.');
    }
  };

  return (
    <ul className={`tx-list${compact ? ' tx-list--compact' : ''}`}>
      {items.map((t) => {
        const cat = categoryById(t.categoryId);
        const acc = accountById(t.accountId);
        const sign = t.type === 'income' ? '+' : '−';
        return (
          <li key={t.id} className="tx-row">
            <CategoryDot color={cat?.color} />
            <div className="tx-row__main">
              <span className="tx-row__desc">
                {t.description}
                {t.recurringId && <Repeat size={13} className="tx-row__tag" aria-label="Gasto fixo" />}
              </span>
              <span className="tx-row__meta">
                {formatDate(t.date)} · {cat?.name ?? 'Sem categoria'}
                {showAccount && acc && (
                  <>
                    {' · '}
                    <span className="acc-chip" style={{ ['--acc-color' as string]: acc.color }}>
                      {acc.name}
                    </span>
                  </>
                )}
              </span>
            </div>
            <span className={`tx-row__amount amount--${t.type}`}>
              <span className="sr-only">{t.type === 'income' ? 'Entrada de' : 'Despesa de'}</span>
              {sign} {formatMoney(t.amount, cur(t))}
            </span>
            {showActions && (
              <div className="tx-row__actions">
                {onEdit && (
                  <button className="icon-btn" onClick={() => onEdit(t)} aria-label={`Editar ${t.description}`}>
                    <Pencil size={16} />
                  </button>
                )}
                <button className="icon-btn icon-btn--danger" onClick={() => remove(t)} aria-label={`Excluir ${t.description}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
