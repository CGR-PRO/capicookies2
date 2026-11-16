import { useLayoutEffect as useResetEffect, useState, type FormEvent } from 'react';
import { ArrowDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Field, FormRow } from '../ui/Field';
import { Button } from '../ui/Button';
import { MoneyInput } from '../ui/MoneyInput';
import { AccountSelect } from './AccountSelect';
import { useData } from '../../store/DataProvider';
import { useRates } from '../../store/RatesProvider';
import { useToast } from '../../store/ToastProvider';
import { convertCents } from '../../lib/currency';
import { validateTransfer } from '../../lib/accounts';
import { formatMoney } from '../../lib/money';
import { isValidDateStr } from '../../lib/dates';
import type { Transfer } from '../../lib/types';

interface Props {
  open: boolean;
  onClose(): void;
  editing?: Transfer | null;
  defaultFromId?: string;
  defaultToId?: string;
}

/**
 * Transferência entre contas: debita a origem e credita o destino. Não é entrada
 * nem despesa, então o saldo consolidado e o resultado mensal não mudam.
 */
export function TransferForm({ open, onClose, editing, defaultFromId, defaultToId }: Props) {
  const { accounts, activeAccounts, primaryAccount, saveTransfer, today, accountById } = useData();
  const { accountQuotes, quote } = useRates();
  const toast = useToast();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [toAmount, setToAmount] = useState<number | null>(null);
  const [toTouched, setToTouched] = useState(false);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useResetEffect(() => {
    if (!open) return;
    const from = editing?.fromAccountId ?? defaultFromId ?? primaryAccount.id;
    setFromId(from);
    setToId(editing?.toAccountId ?? defaultToId ?? activeAccounts.find((a) => a.id !== from)?.id ?? '');
    setAmount(editing?.amount ?? null);
    setToAmount(editing?.toAmount ?? null);
    setToTouched(!!editing);
    setDate(editing?.date ?? today);
    setDescription(editing?.description ?? '');
    setError(null);
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = accountById(fromId);
  const to = accountById(toId);
  const crossCurrency = !!from && !!to && from.currency !== to.currency;

  /** Cotação direta origem → destino, a partir das cotações da sessão (nunca de histórico). */
  const suggestedRate = (() => {
    if (!from || !to || !crossCurrency) return null;
    const direct = [quote, ...Object.values(accountQuotes)].find((q) => q && q.base === from.currency && q.target === to.currency);
    if (direct) return direct.rate;
    const inverse = [quote, ...Object.values(accountQuotes)].find((q) => q && q.base === to.currency && q.target === from.currency);
    if (inverse) return 1 / inverse.rate;
    const a = accountQuotes[from.currency];
    const b = accountQuotes[to.currency];
    if (a && b) return a.rate / b.rate;
    if (a && quote && a.target === quote.base && quote.target === to.currency) return a.rate * quote.rate;
    return null;
  })();

  const effectiveTo = crossCurrency ? (toTouched ? toAmount : amount !== null && suggestedRate ? convertCents(amount, suggestedRate) : null) : amount;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (activeAccounts.length < 2 && !editing) {
      setError('Crie uma segunda conta para poder transferir.');
      return;
    }
    if (!isValidDateStr(date)) {
      setError('Informe uma data válida.');
      return;
    }
    const input = { fromAccountId: fromId, toAccountId: toId, amount: amount ?? 0, toAmount: effectiveTo ?? 0 };
    const err = validateTransfer(input, accounts);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveTransfer({ id: editing?.id, ...input, date, description });
      toast.success(editing ? 'Transferência atualizada.' : `Transferência de ${formatMoney(input.amount, from!.currency)} registrada.`);
      onClose();
    } catch (er) {
      toast.error((er as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar transferência' : 'Transferir entre contas'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="transfer-form" loading={saving}>
            {editing ? 'Salvar alterações' : 'Transferir'}
          </Button>
        </>
      }
    >
      <form id="transfer-form" className="form" onSubmit={submit} noValidate>
        <Field label="De (conta de origem)" required>
          <AccountSelect
            value={fromId}
            keepId={editing?.fromAccountId}
            onChange={(id) => {
              setFromId(id);
              if (id === toId) setToId(activeAccounts.find((a) => a.id !== id)?.id ?? '');
              setToTouched(false);
            }}
          />
        </Field>
        <div className="transfer-arrow" aria-hidden>
          <ArrowDown size={18} />
        </div>
        <Field label="Para (conta de destino)" required>
          <AccountSelect value={toId} keepId={editing?.toAccountId} excludeId={fromId} onChange={(id) => { setToId(id); setToTouched(false); }} />
        </Field>
        <FormRow>
          <Field label={`Valor enviado${from ? ` (${from.currency})` : ''}`} required>
            <MoneyInput currency={from?.currency ?? 'EUR'} value={amount} onChange={setAmount} />
          </Field>
          <Field label="Data" required>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </FormRow>
        {crossCurrency && to && (
          <Field
            label={`Valor recebido (${to.currency})`}
            required
            hint={suggestedRate ? `Calculado pela cotação atual (1 ${from!.currency} = ${suggestedRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${to.currency}). Ajuste se o valor real foi outro.` : 'Sem cotação disponível agora: informe o valor que chegou na conta de destino.'}
          >
            <MoneyInput
              currency={to.currency}
              value={effectiveTo}
              onChange={(v) => {
                setToTouched(true);
                setToAmount(v);
              }}
            />
          </Field>
        )}
        <Field label="Descrição">
          <input className="input" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Reserva do mês" />
        </Field>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <p className="field__hint">Transferências não contam como ganho nem como gasto: só movem dinheiro entre suas contas.</p>
      </form>
    </Modal>
  );
}
