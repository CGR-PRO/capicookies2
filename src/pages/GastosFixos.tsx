import { useLayoutEffect as useResetEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Repeat, Trash2, Undo2 } from 'lucide-react';
import { useData } from '../store/DataProvider';
import { useToast } from '../store/ToastProvider';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { GlassCard, PageHeader, EmptyState, Badge, Segmented, CategoryDot } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Field, FormRow } from '../components/ui/Field';
import { Toggle } from '../components/ui/Toggle';
import { PayDialog } from '../components/finance/PayDialog';
import { buildOccurrences, FREQUENCY_LABELS, nextUnpaid, type Occurrence, type OccurrenceStatus } from '../lib/recurrence';
import { formatMoney } from '../lib/money';
import { MoneyInput } from '../components/ui/MoneyInput';
import { AccountSelect } from '../components/accounts/AccountSelect';
import { useFinance } from '../store/useFinance';
import { formatDate, isValidDateStr, relativeDay } from '../lib/dates';
import type { Frequency, RecurringExpense } from '../lib/types';

const STATUS_META: Record<OccurrenceStatus, { label: string; tone: 'good' | 'warning' | 'critical'; icon: ReactElement }> = {
  paid: { label: 'Paga', tone: 'good', icon: <CheckCircle2 size={12} /> },
  pending: { label: 'Pendente', tone: 'warning', icon: <Clock size={12} /> },
  overdue: { label: 'Vencida', tone: 'critical', icon: <AlertTriangle size={12} /> },
};

function RecurringForm({ open, editing, onClose }: { open: boolean; editing: RecurringExpense | null; onClose(): void }) {
  const { categories, saveRecurring, today, primaryAccount, accountById } = useData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [firstDue, setFirstDue] = useState(today);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useResetEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setAmount(editing ? editing.amount : null);
    setCategoryId(editing?.categoryId ?? '');
    setFirstDue(editing?.firstDue ?? today);
    setFrequency(editing?.frequency ?? 'monthly');
    setEndDate(editing?.endDate ?? '');
    setActive(editing?.active ?? true);
    setNotes(editing?.notes ?? '');
    const acc = editing?.accountId;
    setAccountId(acc && accountById(acc) ? acc : primaryAccount.id);
    setErrors({});
  }, [open, editing, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const currency = accountById(accountId)?.currency ?? primaryAccount.currency;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = amount;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Informe o nome da despesa.';
    if (cents === null || cents <= 0) errs.amount = 'Informe um valor válido.';
    if (!isValidDateStr(firstDue)) errs.firstDue = 'Informe a data de vencimento.';
    if (endDate && !isValidDateStr(endDate)) errs.endDate = 'Data inválida.';
    else if (endDate && endDate < firstDue) errs.endDate = 'Deve ser após o primeiro vencimento.';
    setErrors(errs);
    if (Object.keys(errs).length || cents === null) return;
    setSaving(true);
    try {
      await saveRecurring({
        id: editing?.id,
        name,
        amount: cents,
        accountId,
        categoryId: categoryId || null,
        firstDue,
        frequency,
        endDate: endDate || undefined,
        active,
        notes: notes.trim() || undefined,
      });
      toast.success(editing ? 'Gasto fixo atualizado.' : 'Gasto fixo cadastrado.');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar gasto fixo' : 'Novo gasto fixo'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="rec-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="rec-form" className="form" onSubmit={submit} noValidate>
        <Field label="Nome da despesa" error={errors.name} required>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Aluguel" />
        </Field>
        <Field label="Conta de pagamento" hint="O saldo desta conta só muda quando o pagamento for registrado.">
          <AccountSelect value={accountId} onChange={setAccountId} keepId={editing?.accountId} />
        </Field>
        <FormRow>
          <Field label={`Valor (${currency})`} error={errors.amount} required>
            <MoneyInput currency={currency} value={amount} onChange={setAmount} />
          </Field>
          <Field label="Frequência" required>
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Data de vencimento" error={errors.firstDue} required hint="Primeiro vencimento; os seguintes seguem a frequência.">
            <input className="input" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
          </Field>
          <Field label="Termina em (opcional)" error={errors.endDate}>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </FormRow>
        <Field label="Categoria">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories
              .filter((c) => c.type === 'expense')
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Observações">
          <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Toggle checked={active} onChange={setActive} label="Ativo" description="Gastos inativos não geram novos vencimentos." />
      </form>
    </Modal>
  );
}

export default function GastosFixos() {
  const { recurring, transactions, today, settings, categoryById, deleteRecurring, deleteTransaction, saveRecurring } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'dues' | 'list'>('dues');
  const [statusFilter, setStatusFilter] = useState<'open' | OccurrenceStatus | 'all'>('open');
  const [form, setForm] = useState<{ open: boolean; editing: RecurringExpense | null }>({ open: false, editing: null });
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const { accountById, primaryAccount } = useData();
  const { toPrimary } = useFinance();
  const fmt = (c: number) => formatMoney(c, settings.primaryCurrency);
  const curOf = (accountId?: string) => accountById(accountId)?.currency ?? primaryAccount.currency;
  const fmtIn = (c: number, accountId?: string) => formatMoney(c, curOf(accountId));
  /** Valor na moeda principal para os totais; null se a conta está em outra moeda sem cotação. */
  const inPrimary = (c: number, accountId?: string) => toPrimary(c, curOf(accountId)) ?? 0;
  const noRate = [...new Set(recurring.map((r) => curOf(r.accountId)))].filter((c) => toPrimary(100, c) === null);

  const occurrences = useMemo(() => buildOccurrences(recurring, transactions, today, { horizonDays: 60 }), [recurring, transactions, today]);
  const counts = useMemo(() => {
    const c = { pending: 0, overdue: 0, paidMonth: 0, pendingTotal: 0, overdueTotal: 0, paidMonthTotal: 0 };
    for (const o of occurrences) {
      if (o.status === 'pending' && o.due.slice(0, 7) <= today.slice(0, 7)) {
        c.pending++;
        c.pendingTotal += inPrimary(o.recurring.amount, o.recurring.accountId);
      }
      if (o.status === 'overdue') {
        c.overdue++;
        c.overdueTotal += inPrimary(o.recurring.amount, o.recurring.accountId);
      }
      if (o.status === 'paid' && o.payment && o.payment.date.slice(0, 7) === today.slice(0, 7)) {
        c.paidMonth++;
        c.paidMonthTotal += inPrimary(o.payment.amount, o.payment.accountId);
      }
    }
    return c;
  }, [occurrences, today, toPrimary]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = occurrences.filter((o) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return o.status !== 'paid';
    return o.status === statusFilter;
  });
  const sortedFiltered = statusFilter === 'paid' ? [...filtered].reverse() : filtered;

  const undoPayment = async (o: Occurrence) => {
    if (!o.payment) return;
    const ok = await confirm({
      title: 'Desfazer pagamento?',
      message: `O lançamento de ${fmtIn(o.payment.amount, o.payment.accountId)} será excluído, o saldo recalculado e o vencimento voltará a ficar pendente.`,
      confirmLabel: 'Desfazer',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTransaction(o.payment.id);
      toast.success('Pagamento desfeito.');
    } catch {
      toast.error('Não foi possível desfazer.');
    }
  };

  const remove = async (r: RecurringExpense) => {
    const ok = await confirm({
      title: 'Excluir gasto fixo?',
      message: `“${r.name}” deixará de gerar vencimentos. Pagamentos já registrados permanecem no histórico financeiro.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRecurring(r.id);
      toast.success('Gasto fixo excluído.');
    } catch {
      toast.error('Não foi possível excluir.');
    }
  };

  const monthlyEquivalent = recurring
    .filter((r) => r.active)
    .reduce((s, r) => {
      const factor = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, bimonthly: 1 / 2, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12 }[r.frequency];
      return s + inPrimary(r.amount, r.accountId) * factor;
    }, 0);

  return (
    <div className="page">
      <PageHeader
        title="Gastos Fixos"
        subtitle="Despesas recorrentes só afetam o saldo quando o pagamento é registrado."
        actions={
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setForm({ open: true, editing: null })}>
            Novo gasto fixo
          </Button>
        }
      />

      <div className="stats-row">
        <GlassCard className="stat-card" title="Vencidas" icon={<AlertTriangle size={18} />}>
          <p className="stat-value">{fmt(counts.overdueTotal)}</p>
          <p className="muted small">{counts.overdue} vencimento(s)</p>
        </GlassCard>
        <GlassCard className="stat-card" title="Pendentes no mês" icon={<Clock size={18} />}>
          <p className="stat-value">{fmt(counts.pendingTotal)}</p>
          <p className="muted small">{counts.pending} vencimento(s)</p>
        </GlassCard>
        <GlassCard className="stat-card" title="Pagas no mês" icon={<CheckCircle2 size={18} />}>
          <p className="stat-value">{fmt(counts.paidMonthTotal)}</p>
          <p className="muted small">{counts.paidMonth} pagamento(s)</p>
        </GlassCard>
        <GlassCard className="stat-card" title="Custo mensal estimado" icon={<Repeat size={18} />}>
          <p className="stat-value">{fmt(Math.round(monthlyEquivalent))}</p>
          <p className="muted small">{recurring.filter((r) => r.active).length} gasto(s) ativo(s)</p>
          {noRate.length > 0 && <p className="muted small">Totais em {settings.primaryCurrency}; sem cotação agora para {noRate.join(', ')} (não incluído).</p>}
        </GlassCard>
      </div>

      <div className="toolbar glass">
        <Segmented
          label="Visualização"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dues', label: 'Vencimentos' },
            { value: 'list', label: 'Cadastros' },
          ]}
        />
        {tab === 'dues' && (
          <Segmented
            size="sm"
            label="Situação"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'open', label: 'Em aberto' },
              { value: 'overdue', label: 'Vencidas' },
              { value: 'pending', label: 'Pendentes' },
              { value: 'paid', label: 'Pagas' },
              { value: 'all', label: 'Todas' },
            ]}
          />
        )}
      </div>

      {tab === 'dues' ? (
        <GlassCard>
          {sortedFiltered.length === 0 ? (
            <EmptyState
              icon={<Repeat size={28} />}
              title={recurring.length ? 'Nada por aqui' : 'Nenhum gasto fixo cadastrado'}
              action={
                !recurring.length && (
                  <Button size="sm" variant="primary" onClick={() => setForm({ open: true, editing: null })}>
                    Cadastrar
                  </Button>
                )
              }
            />
          ) : (
            <ul className="due-list">
              {sortedFiltered.map((o) => {
                const meta = STATUS_META[o.status];
                const cat = categoryById(o.recurring.categoryId);
                return (
                  <li key={`${o.recurring.id}-${o.due}`} className="due-row">
                    <CategoryDot color={cat?.color} />
                    <div className="due-row__main">
                      <span className="due-row__name">{o.recurring.name}</span>
                      <span className="muted small">
                        Vence {formatDate(o.due)} · {relativeDay(o.due, today)}
                        {o.payment && ` · pago em ${formatDate(o.payment.date)}`}
                      </span>
                    </div>
                    <Badge tone={meta.tone} icon={meta.icon}>
                      {meta.label}
                    </Badge>
                    <span className="due-row__amount">{o.payment ? fmtIn(o.payment.amount, o.payment.accountId) : fmtIn(o.recurring.amount, o.recurring.accountId)}</span>
                    {o.status === 'paid' ? (
                      <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={() => undoPayment(o)}>
                        Desfazer
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => setPaying(o)}>
                        Pagar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      ) : (
        <GlassCard>
          {recurring.length === 0 ? (
            <EmptyState icon={<Repeat size={28} />} title="Nenhum gasto fixo cadastrado" />
          ) : (
            <ul className="rec-list">
              {[...recurring]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((r) => {
                  const cat = categoryById(r.categoryId);
                  const next = r.active ? nextUnpaid(r, transactions, today) : null;
                  return (
                    <li key={r.id} className={`rec-row${r.active ? '' : ' is-inactive'}`}>
                      <CategoryDot color={cat?.color} />
                      <div className="rec-row__main">
                        <span className="due-row__name">{r.name}</span>
                        <span className="muted small">
                          {FREQUENCY_LABELS[r.frequency]} · {cat?.name ?? 'Sem categoria'}
                          {next ? ` · próximo: ${formatDate(next)}` : r.active ? ' · encerrado' : ''}
                        </span>
                      </div>
                      <span className="due-row__amount">{fmtIn(r.amount, r.accountId)}</span>
                      <Toggle
                        hideLabel
                        label={`${r.name} ativo`}
                        checked={r.active}
                        onChange={async (v) => {
                          try {
                            await saveRecurring({ ...r, active: v });
                            toast.success(v ? 'Gasto fixo ativado.' : 'Gasto fixo desativado.');
                          } catch {
                            toast.error('Não foi possível atualizar.');
                          }
                        }}
                      />
                      <button className="icon-btn" onClick={() => setForm({ open: true, editing: r })} aria-label={`Editar ${r.name}`}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-btn icon-btn--danger" onClick={() => remove(r)} aria-label={`Excluir ${r.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </GlassCard>
      )}

      <RecurringForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
      <PayDialog occurrence={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
