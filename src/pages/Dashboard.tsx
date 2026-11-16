import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  Minus,
  PieChart,
  Plus,
  RefreshCw,
  Repeat,
  TrendingDown,
  TrendingUp,
  Scale,
  Wallet,
} from 'lucide-react';
import { useFinance, type AccountFilter } from '../store/useFinance';
import { AccountsOverview } from '../components/accounts/AccountsOverview';
import { AccountForm } from '../components/accounts/AccountForm';
import { TransferForm } from '../components/accounts/TransferForm';
import { AccountFilterSelect } from '../components/accounts/AccountFilterSelect';
import { AccountIcon } from '../components/accounts/AccountIcon';
import { AnimatedMoney } from '../components/ui/AnimatedMoney';
import { MonthYearPicker } from '../components/ui/MonthYearPicker';
import { ledgerBalance } from '../lib/accounts';
import { useData } from '../store/DataProvider';
import { useRates } from '../store/RatesProvider';
import { GlassCard, PageHeader, EmptyState, Badge } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { TransactionForm } from '../components/finance/TransactionForm';
import { TransactionList } from '../components/finance/TransactionList';
import { PayDialog } from '../components/finance/PayDialog';
import { EventForm } from '../components/agenda/EventForm';
import { AreaLine, GroupedColumns, HorizontalBars } from '../components/charts/charts';
import { monthlySeries, sortByDateDesc, summarizeMonth, totalsByCategory } from '../lib/finance';
import { buildOccurrences, type Occurrence } from '../lib/recurrence';
import { convertCents, describeQuoteTime } from '../lib/currency';
import { formatMoney } from '../lib/money';
import { addDays, dateInTz, formatDate, formatMonth, monthShort, monthName, relativeDay, timeInTz, WEEKDAYS } from '../lib/dates';
import type { AgendaEvent, Transaction, TxType } from '../lib/types';

export default function Dashboard() {
  const data = useData();
  const { settings, transactions: allTransactions, recurring, events, today, categoryById, setEventDone, accountById, accounts } = data;
  const { view, originals, toPrimary } = useFinance();
  const { quote, loading: rateLoading, error: rateError, lastAttemptAt, refresh } = useRates();

  // Consulta a cotação ao abrir o dashboard (sem duplicar a consulta feita na inicialização).
  useEffect(() => {
    if (!lastAttemptAt || Date.now() - new Date(lastAttemptAt).getTime() > 15_000) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const selectedAccount = accountFilter !== 'all' ? accountById(accountFilter) : undefined;
  // Se a conta filtrada deixar de existir, volta para todas.
  useEffect(() => {
    if (accountFilter !== 'all' && !selectedAccount) setAccountFilter('all');
  }, [accountFilter, selectedAccount]);
  const v = useMemo(() => view(accountFilter), [view, accountFilter]);
  const transactions = v.transactions;
  const cur = v.currency;
  const fmt = (c: number) => formatMoney(c, cur);
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const firstYear = useMemo(() => allTransactions.reduce((y, t) => Math.min(y, Number(t.date.slice(0, 4))), Number(today.slice(0, 4))), [allTransactions, today]);
  const [accountForm, setAccountForm] = useState(false);
  const [transferForm, setTransferForm] = useState(false);

  const [txForm, setTxForm] = useState<{ open: boolean; type: TxType; editing: Transaction | null }>({ open: false, type: 'expense', editing: null });
  const [eventForm, setEventForm] = useState<{ open: boolean; editing: AgendaEvent | null }>({ open: false, editing: null });
  const [paying, setPaying] = useState<Occurrence | null>(null);

  // Saldo disponível (acumulado de todos os meses, inclui transferências) ≠ resultado do mês.
  const balance = useMemo(() => ledgerBalance(v.ledger), [v.ledger]);
  const summary = useMemo(() => summarizeMonth(transactions, month), [transactions, month]);
  const series = useMemo(() => monthlySeries(transactions, month, 6), [transactions, month]);
  const recent = useMemo(() => originals(sortByDateDesc(transactions).slice(0, 6)), [transactions, originals]);
  const monthCats = useMemo(
    () => totalsByCategory(transactions.filter((t) => t.date.startsWith(month)), 'expense').slice(0, 6),
    [transactions, month],
  );

  const balancePoints = useMemo(() => {
    const pts: { label: string; value: number }[] = [];
    const start = addDays(today, -29);
    let running = ledgerBalance(v.ledger, addDays(start, -1));
    const byDay = new Map<string, number>();
    for (const e of v.ledger.entries) if (e.date >= start && e.date <= today) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.delta);
    for (let i = 0; i < 30; i++) {
      const d = addDays(start, i);
      running += byDay.get(d) ?? 0;
      pts.push({ label: formatDate(d, { year: false }), value: running });
    }
    return pts;
  }, [v.ledger, today]);

  const upcomingDues = useMemo(
    () => buildOccurrences(recurring, allTransactions, today, { horizonDays: 30 }).filter((o) => o.status !== 'paid').slice(0, 6),
    [recurring, allTransactions, today],
  );

  const openDues = useMemo(() => {
    const monthEnd = `${currentMonth}-31`;
    const inView = (accId?: string) => accountFilter === 'all' || (accId ?? accounts.find((a) => a.isPrimary)?.id) === accountFilter;
    const list = buildOccurrences(recurring, allTransactions, today, { horizonDays: 31 }).filter((o) => o.status !== 'paid' && o.due <= monthEnd && inView(o.recurring.accountId));
    let total = 0;
    for (const o of list) {
      const c = accountById(o.recurring.accountId)?.currency ?? data.primaryAccount.currency;
      total += c === cur ? o.recurring.amount : toPrimary(o.recurring.amount, c) ?? 0;
    }
    return { total, count: list.length, overdue: list.filter((o) => o.status === 'overdue').length };
  }, [recurring, allTransactions, today, currentMonth, accountFilter, accounts, accountById, toPrimary, cur, data.primaryAccount]);
  const dueCurrency = (accId?: string) => accountById(accId)?.currency ?? data.primaryAccount.currency;

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events
      .filter((e) => e.end >= now && !(e.kind === 'task' && e.done))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 6);
  }, [events, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const secondary = quote && quote.base === cur && quote.target === settings.secondaryCurrency ? convertCents(balance, quote.rate) : null;
  /** Conta filtrada em moeda diferente da principal: mostra o equivalente na principal. */
  const inPrimary = selectedAccount && selectedAccount.currency !== settings.primaryCurrency ? toPrimary(balance, selectedAccount.currency) : null;
  const net = summary.net;
  const monthLabel = formatMonth(month);
  const tz = settings.timezone;
  const [, m, d] = today.split('-').map(Number);
  const wd = new Date(`${today}T12:00:00Z`).getUTCDay();

  return (
    <div className="page">
      <PageHeader
        title="Olá! 👋"
        subtitle={`${WEEKDAYS[wd]}, ${d} de ${monthName(m)} · ${tz}`}
        actions={
          <>
            <Button variant="glass" icon={<CalendarPlus size={18} />} onClick={() => setEventForm({ open: true, editing: null })}>
              Compromisso
            </Button>
            {data.activeAccounts.length > 1 && (
              <Button variant="glass" icon={<ArrowLeftRight size={18} />} onClick={() => setTransferForm(true)}>
                Transferir
              </Button>
            )}
            <Button variant="glass" icon={<Minus size={18} />} onClick={() => setTxForm({ open: true, type: 'expense', editing: null })}>
              Despesa
            </Button>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setTxForm({ open: true, type: 'income', editing: null })}>
              Entrada
            </Button>
          </>
        }
      />

      <div className="toolbar glass dash-toolbar">
        <div className="dash-toolbar__group">
          <span className="dash-toolbar__label">Exibindo</span>
          {accounts.length > 1 ? (
            <AccountFilterSelect value={accountFilter} onChange={setAccountFilter} />
          ) : (
            <span className="dash-toolbar__value">{data.primaryAccount.name}</span>
          )}
        </div>
        <div className="dash-toolbar__group">
          <span className="dash-toolbar__label">Resultado de</span>
          <MonthYearPicker value={month} onChange={setMonth} minYear={firstYear} maxYear={Number(today.slice(0, 4)) + 1} current={currentMonth} />
        </div>
      </div>

      <div className="dash-grid">
        <GlassCard
          className="hero-card span-2 row-2"
          title={selectedAccount ? `Saldo — ${selectedAccount.name}` : accounts.length > 1 ? 'Saldo total consolidado' : 'Saldo atual'}
          icon={selectedAccount ? <AccountIcon account={selectedAccount} size={22} /> : <Wallet size={18} />}
        >
          <p className="hero-value" aria-live="polite">
            <AnimatedMoney cents={balance} currency={cur} />
          </p>
          <p className="muted small hero-note">Dinheiro disponível hoje, acumulado de todos os meses{accounts.length > 1 && !selectedAccount ? ' e de todas as contas' : ''}. Não é o resultado do mês.</p>
          {v.missing.length > 0 && (
            <span className="status-text status-text--warning" role="status">
              <AlertTriangle size={14} aria-hidden /> Sem cotação para {v.missing.map((a) => a.name).join(', ')}: fora do total até a consulta funcionar.
            </span>
          )}
          {inPrimary !== null && <span className="hero-secondary__value">≈ {formatMoney(inPrimary, settings.primaryCurrency)}</span>}
          <div className="hero-secondary">
            {rateLoading && !quote && (
              <span className="muted inline-flex">
                <Spinner size={14} /> Atualizando cotação…
              </span>
            )}
            {secondary !== null && quote && (
              <>
                <span className="hero-secondary__value">≈ {formatMoney(secondary, settings.secondaryCurrency)}</span>
                <span className="muted small">
                  1 {cur} = {quote.rate.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {settings.secondaryCurrency} · {describeQuoteTime(quote, tz, today).label}
                </span>
                <span className="muted small">
                  Consultada às {timeInTz(quote.fetchedAt, tz)} · fonte: {quote.provider}
                </span>
              </>
            )}
            {rateError && (
              <span className="status-text status-text--warning" role="status">
                <AlertTriangle size={14} aria-hidden /> Não foi possível atualizar a cotação {cur}→{settings.secondaryCurrency}. O valor em {settings.secondaryCurrency} será exibido quando a consulta funcionar.
              </span>
            )}
            <button className="link-btn" onClick={refresh} disabled={rateLoading} aria-label="Atualizar cotação">
              <RefreshCw size={14} className={rateLoading ? 'spin' : ''} /> Atualizar
            </button>
          </div>
        </GlassCard>

        <GlassCard className="stat-card stat-card--income" title="Ganhos do mês" icon={<TrendingUp size={18} />}>
          <p className="stat-value amount--income">
            <AnimatedMoney cents={summary.income} currency={cur} />
          </p>
          <p className="muted small">Entradas em {monthLabel}</p>
        </GlassCard>

        <GlassCard className="stat-card stat-card--expense" title="Gastos do mês" icon={<TrendingDown size={18} />}>
          <p className="stat-value amount--expense">
            <AnimatedMoney cents={summary.expense} currency={cur} />
          </p>
          <p className="muted small">Despesas em {monthLabel}</p>
        </GlassCard>

        <GlassCard className={`stat-card stat-card--net ${net >= 0 ? 'is-positive' : 'is-negative'}`} title="Resultado líquido" icon={<Scale size={18} />}>
          <p className={`stat-value ${net >= 0 ? 'amount--income' : 'amount--expense'}`}>
            <AnimatedMoney cents={net} currency={cur} signed />
          </p>
          <Badge tone={net > 0 ? 'good' : net < 0 ? 'critical' : 'neutral'} icon={net >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}>
            {net > 0 ? `Sobrou ${fmt(net)}` : net < 0 ? `Faltou ${fmt(-net)}` : 'Ganhos = gastos'}
          </Badge>
          <p className="muted small">Ganhos − gastos · sem transferências</p>
        </GlassCard>

        <GlassCard className="stat-card" title="Vencimentos em aberto" icon={<Repeat size={18} />}>
          <p className="stat-value">{fmt(openDues.total)}</p>
          <p className="muted small">Ainda não descontados do saldo</p>
          {openDues.overdue > 0 ? (
            <Badge tone="critical" icon={<AlertTriangle size={12} />}>
              {openDues.overdue} vencida{openDues.overdue > 1 ? 's' : ''}
            </Badge>
          ) : (
            <p className="muted small">{openDues.count} até o fim do mês</p>
          )}
        </GlassCard>

        <AccountsOverview selected={accountFilter} onSelect={setAccountFilter} onNewAccount={() => setAccountForm(true)} onTransfer={() => setTransferForm(true)} />

        <GlassCard className="span-2" title="Entradas × Despesas" icon={<TrendingUp size={18} />} actions={<span className="muted small">6 meses até {formatMonth(month)}</span>}>
          <GroupedColumns
            caption={`Entradas e despesas nos 6 meses até ${formatMonth(month)}`}
            series={[
              { name: 'Entradas', color: 'var(--series-1)' },
              { name: 'Despesas', color: 'var(--series-2)' },
            ]}
            data={series.map((s) => {
              const mm = Number(s.month.slice(5));
              return { label: monthShort(mm), fullLabel: formatMonth(s.month), values: [s.income, s.expense] };
            })}
            format={fmt}
          />
        </GlassCard>

        <GlassCard className="span-2" title="Evolução do saldo" icon={<Wallet size={18} />} actions={<span className="muted small">últimos 30 dias</span>}>
          <AreaLine caption="Saldo diário nos últimos 30 dias" points={balancePoints} color="var(--series-1)" format={fmt} />
        </GlassCard>

        <GlassCard
          className="span-2"
          title="Próximos vencimentos"
          icon={<Repeat size={18} />}
          actions={
            <Link to="/gastos-fixos" className="link-btn">
              Ver todos
            </Link>
          }
        >
          {upcomingDues.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={28} />} title="Nenhum vencimento pendente">
              Cadastre seus gastos fixos para acompanhar os vencimentos.
            </EmptyState>
          ) : (
            <ul className="due-list">
              {upcomingDues.map((o) => (
                <li key={`${o.recurring.id}-${o.due}`} className="due-row">
                  <div className="due-row__main">
                    <span className="due-row__name">{o.recurring.name}</span>
                    <span className="muted small">
                      {formatDate(o.due)} · {relativeDay(o.due, today)}
                    </span>
                  </div>
                  <Badge tone={o.status === 'overdue' ? 'critical' : 'warning'} icon={o.status === 'overdue' ? <AlertTriangle size={12} /> : <Clock size={12} />}>
                    {o.status === 'overdue' ? 'Vencida' : 'Pendente'}
                  </Badge>
                  <span className="due-row__amount">{formatMoney(o.recurring.amount, dueCurrency(o.recurring.accountId))}</span>
                  <Button size="sm" variant="primary" onClick={() => setPaying(o)}>
                    Pagar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard
          className="span-2"
          title="Próximos compromissos"
          icon={<CalendarClock size={18} />}
          actions={
            <Link to="/agenda" className="link-btn">
              Abrir agenda
            </Link>
          }
        >
          {upcomingEvents.length === 0 ? (
            <EmptyState icon={<CalendarClock size={28} />} title="Agenda livre" action={<Button size="sm" onClick={() => setEventForm({ open: true, editing: null })}>Novo compromisso</Button>} />
          ) : (
            <ul className="event-list">
              {upcomingEvents.map((e) => {
                const day = dateInTz(e.start, tz);
                return (
                  <li key={e.id} className="event-row">
                    <span className="event-row__bar" style={{ background: e.color }} aria-hidden />
                    {e.kind === 'task' ? (
                      <button className="icon-btn" onClick={() => setEventDone(e.id, !e.done)} aria-label={`Marcar “${e.title}” como concluída`}>
                        <Circle size={18} />
                      </button>
                    ) : null}
                    <button className="event-row__main" onClick={() => setEventForm({ open: true, editing: e })}>
                      <span className="event-row__title">{e.title}</span>
                      <span className="muted small">
                        {relativeDay(day, today)} · {formatDate(day, { year: false })}
                        {e.allDay ? ' · dia inteiro' : ` · ${timeInTz(e.start, tz)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        <GlassCard
          className="span-2"
          title="Últimas movimentações"
          icon={<RefreshCw size={18} />}
          actions={
            <Link to="/historico" className="link-btn">
              Histórico
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState icon={<Wallet size={28} />} title="Sem lançamentos ainda">
              Registre sua primeira entrada ou despesa.
            </EmptyState>
          ) : (
            <TransactionList items={recent} compact onEdit={(t) => setTxForm({ open: true, type: t.type, editing: t })} />
          )}
        </GlassCard>

        <GlassCard className="span-2" title="Despesas por categoria" icon={<PieChart size={18} />} actions={<span className="muted small">{formatMonth(month)}</span>}>
          {monthCats.length === 0 ? (
            <EmptyState icon={<PieChart size={28} />} title="Nenhuma despesa neste mês" />
          ) : (
            <HorizontalBars
              caption="Despesas do mês por categoria"
              format={fmt}
              rows={monthCats.map((c) => {
                const cat = categoryById(c.categoryId);
                return { id: c.categoryId ?? 'none', label: cat?.name ?? 'Sem categoria', color: cat?.color, value: c.total };
              })}
            />
          )}
        </GlassCard>
      </div>

      <AccountForm open={accountForm} onClose={() => setAccountForm(false)} onSaved={(a) => setAccountFilter(a.id)} />
      <TransferForm open={transferForm} onClose={() => setTransferForm(false)} defaultFromId={selectedAccount && !selectedAccount.archived ? selectedAccount.id : undefined} />
      <TransactionForm open={txForm.open} defaultType={txForm.type} editing={txForm.editing} defaultAccountId={selectedAccount?.id} onClose={() => setTxForm((s) => ({ ...s, open: false, editing: null }))} />
      <EventForm open={eventForm.open} editing={eventForm.editing} onClose={() => setEventForm({ open: false, editing: null })} />
      <PayDialog occurrence={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
