import { useLayoutEffect as useResetEffect, useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Field, FormRow } from '../ui/Field';
import { Button } from '../ui/Button';
import { MoneyInput } from '../ui/MoneyInput';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { ACCOUNT_COLORS, ACCOUNT_ICONS, accountHasMovements, type AccountIconName } from '../../lib/accounts';
import { CURRENCIES } from '../../lib/currency';
import { AccountIcon, ICON_COMPONENTS, ICON_LABELS } from './AccountIcon';
import type { Account } from '../../lib/types';

interface Props {
  open: boolean;
  onClose(): void;
  editing?: Account | null;
  onSaved?(a: Account): void;
}

/** Criação e edição de contas (nome, saldo inicial, moeda, cor e ícone). */
export function AccountForm({ open, onClose, editing, onSaved }: Props) {
  const { saveAccount, settings, accounts, transactions, transfers } = useData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [initial, setInitial] = useState<number | null>(0);
  const [currency, setCurrency] = useState(settings.primaryCurrency);
  const [color, setColor] = useState(ACCOUNT_COLORS[1]);
  const [icon, setIcon] = useState<AccountIconName>('piggy-bank');
  const [error, setError] = useState<{ name?: string; initial?: string }>({});
  const [saving, setSaving] = useState(false);

  useResetEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setInitial(editing ? editing.initialBalance : 0);
    setCurrency(editing?.currency ?? settings.primaryCurrency);
    setColor(editing?.color ?? ACCOUNT_COLORS[(accounts.length % (ACCOUNT_COLORS.length - 1)) + 1]);
    setIcon((editing?.icon as AccountIconName) ?? 'piggy-bank');
    setError({});
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const currencyLocked = !!editing && accountHasMovements(editing.id, transactions, transfers, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof error = {};
    if (!name.trim()) errs.name = 'Informe o nome da conta.';
    else if (name.trim().length > 40) errs.name = 'Máximo de 40 caracteres.';
    else if (accounts.some((a) => a.id !== editing?.id && a.name.toLowerCase() === name.trim().toLowerCase())) errs.name = 'Já existe uma conta com esse nome.';
    setError(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const acc = await saveAccount({ id: editing?.id, name, initialBalance: initial ?? 0, currency, color, icon });
      toast.success(editing ? 'Conta atualizada. Saldo recalculado.' : `Conta “${acc.name}” criada.`);
      onSaved?.(acc);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${editing.name}` : 'Nova conta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="account-form" loading={saving}>
            {editing ? 'Salvar alterações' : 'Criar conta'}
          </Button>
        </>
      }
    >
      <form id="account-form" className="form" onSubmit={submit} noValidate>
        <div className="acc-preview">
          <AccountIcon account={{ icon, color }} size={44} />
          <div>
            <strong>{name.trim() || 'Nome da conta'}</strong>
            <span className="muted small">{currency}</span>
          </div>
        </div>
        <Field label="Nome" error={error.name} required>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reserva de Emergência" />
        </Field>
        <FormRow>
          <Field label={`Saldo inicial (${currency})`} error={error.initial} hint="Digite só números; “-” para saldo negativo.">
            <MoneyInput currency={currency} value={initial} onChange={setInitial} allowNegative />
          </Field>
          <Field label="Moeda da conta" hint={currencyLocked ? 'Não pode mudar: a conta já tem movimentações.' : undefined}>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={currencyLocked}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
        </FormRow>
        <fieldset className="choice-group">
          <legend className="field__label">Cor</legend>
          <div className="swatches">
            {ACCOUNT_COLORS.map((c) => (
              <label key={c} className={`swatch${c === color ? ' is-selected' : ''}`} style={{ background: c }}>
                <input type="radio" name="acc-color" value={c} checked={c === color} onChange={() => setColor(c)} className="sr-only" />
                <span className="sr-only">Cor {c}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice-group">
          <legend className="field__label">Ícone</legend>
          <div className="icon-choices">
            {ACCOUNT_ICONS.map((name) => {
              const Icon = ICON_COMPONENTS[name];
              return (
                <label key={name} className={`icon-choice${name === icon ? ' is-selected' : ''}`} title={ICON_LABELS[name]}>
                  <input type="radio" name="acc-icon" value={name} checked={name === icon} onChange={() => setIcon(name)} className="sr-only" />
                  <Icon size={18} aria-hidden />
                  <span className="sr-only">{ICON_LABELS[name]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
