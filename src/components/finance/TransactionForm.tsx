import { useLayoutEffect as useResetEffect, useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Field, FormRow } from '../ui/Field';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Glass';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { centsToInput, parseMoney } from '../../lib/money';
import { isValidDateStr } from '../../lib/dates';
import type { Transaction, TxType } from '../../lib/types';

interface Props {
  open: boolean;
  onClose(): void;
  /** Lançamento a editar; ausente = novo. */
  editing?: Transaction | null;
  defaultType?: TxType;
  lockType?: boolean;
}

interface Errors {
  amount?: string;
  description?: string;
  date?: string;
}

export function TransactionForm({ open, onClose, editing, defaultType = 'expense', lockType }: Props) {
  const { categories, saveTransaction, today, settings } = useData();
  const toast = useToast();
  const [type, setType] = useState<TxType>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useResetEffect(() => {
    if (!open) return;
    setType(editing?.type ?? defaultType);
    setAmount(editing ? centsToInput(editing.amount) : '');
    setDescription(editing?.description ?? '');
    setCategoryId(editing?.categoryId ?? '');
    setDate(editing?.date ?? today);
    setNotes(editing?.notes ?? '');
    setErrors({});
  }, [open, editing, defaultType, today]);

  const cats = categories.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name));

  const validate = (): { ok: boolean; cents: number | null } => {
    const e: Errors = {};
    const cents = parseMoney(amount);
    if (cents === null) e.amount = 'Informe um valor válido (ex.: 125,90).';
    else if (cents <= 0) e.amount = 'O valor deve ser maior que zero.';
    else if (cents > 100_000_000_00) e.amount = 'Valor muito alto.';
    if (!description.trim()) e.description = 'Informe uma descrição.';
    else if (description.trim().length > 120) e.description = 'Máximo de 120 caracteres.';
    if (!isValidDateStr(date)) e.date = 'Informe uma data válida.';
    setErrors(e);
    return { ok: Object.keys(e).length === 0, cents };
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const { ok, cents } = validate();
    if (!ok || cents === null) return;
    setSaving(true);
    try {
      await saveTransaction({
        id: editing?.id,
        type,
        amount: cents,
        description,
        categoryId: categoryId || null,
        date,
        notes: notes.trim() || undefined,
        recurringId: editing?.recurringId,
        recurringDue: editing?.recurringDue,
      });
      toast.success(editing ? 'Lançamento atualizado.' : type === 'income' ? 'Entrada registrada.' : 'Despesa registrada.');
      onClose();
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? 'Editar lançamento' : type === 'income' ? 'Nova entrada' : 'Nova despesa';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="tx-form" loading={saving}>
            {editing ? 'Salvar alterações' : 'Registrar'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} noValidate className="form">
        {!lockType && !editing?.recurringId && (
          <Segmented
            label="Tipo de lançamento"
            value={type}
            onChange={(v) => {
              setType(v);
              setCategoryId('');
            }}
            options={[
              { value: 'income', label: 'Entrada' },
              { value: 'expense', label: 'Despesa' },
            ]}
          />
        )}
        {editing?.recurringId && <p className="field__hint">Pagamento de gasto fixo — vencimento {editing.recurringDue}.</p>}
        <FormRow>
          <Field label={`Valor (${settings.primaryCurrency})`} error={errors.amount} required>
            <input className="input input--money" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Data" error={errors.date} required hint="Pode ser uma data anterior.">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </FormRow>
        <Field label="Descrição" error={errors.description} required>
          <input className="input" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder={type === 'income' ? 'Ex.: Salário de novembro' : 'Ex.: Supermercado'} />
        </Field>
        <Field label="Categoria" hint={cats.length ? undefined : 'Cadastre categorias em Configurações.'}>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Observações">
          <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
