import { useLayoutEffect as useResetEffect, useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Field, FormRow } from '../ui/Field';
import { Button } from '../ui/Button';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money';
import { formatDate, isValidDateStr } from '../../lib/dates';
import type { Occurrence } from '../../lib/recurrence';

/** Registra o pagamento de um vencimento de gasto fixo (somente então o saldo é afetado). */
export function PayDialog({ occurrence, onClose }: { occurrence: Occurrence | null; onClose(): void }) {
  const { payOccurrence, today, settings } = useData();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});
  const [saving, setSaving] = useState(false);

  useResetEffect(() => {
    if (!occurrence) return;
    setDate(today);
    setAmount(centsToInput(occurrence.recurring.amount));
    setErrors({});
  }, [occurrence, today]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!occurrence) return;
    const cents = parseMoney(amount);
    const errs: typeof errors = {};
    if (cents === null || cents <= 0) errs.amount = 'Informe um valor válido.';
    if (!isValidDateStr(date)) errs.date = 'Informe uma data válida.';
    setErrors(errs);
    if (Object.keys(errs).length || cents === null) return;
    setSaving(true);
    try {
      await payOccurrence(occurrence.recurring.id, occurrence.due, date, cents);
      toast.success(`Pagamento de “${occurrence.recurring.name}” registrado.`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!occurrence}
      onClose={onClose}
      title="Registrar pagamento"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="pay-form" loading={saving}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      {occurrence && (
        <form id="pay-form" className="form" onSubmit={submit} noValidate>
          <p>
            <strong>{occurrence.recurring.name}</strong>
            <br />
            <span className="muted">
              Vencimento em {formatDate(occurrence.due)} · valor previsto {formatMoney(occurrence.recurring.amount, settings.primaryCurrency)}
            </span>
          </p>
          <FormRow>
            <Field label={`Valor pago (${settings.primaryCurrency})`} error={errors.amount} required>
              <input className="input input--money" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Data do pagamento" error={errors.date} required>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </FormRow>
          <p className="field__hint">O valor será lançado como despesa e descontado do saldo uma única vez.</p>
        </form>
      )}
    </Modal>
  );
}
