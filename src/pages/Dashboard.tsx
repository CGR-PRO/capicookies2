import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
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
  Wallet,
} from 'lucide-react';
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
import { computeBalance, monthlySeries, sortByDateDesc, summarizeMonth, totalsByCategory } from '../lib/finance';
import { buildOccurrences, type Occurrence } from '../lib/recurrence';
import { convertCents } from '../lib/currency';
import { formatMoney } from '../lib/money';
import { addDays, dateInTz, formatDate, formatDateTime, formatMonth, monthShort, monthName, relativeDay, timeInTz, WEEKDAYS } from '../lib/dates';
import type { AgendaEvent, Transaction, TxType } from '../lib/types';

export default function Dashboard() {
  const data = useData();
  const { settings, transactions, recurring, events, today, categoryById, setEventDone } = data;
  const { quote, loading: rateLoading, error: rateError, refresh } = useRates();
  const cur = settings.primaryCurrency;
  const fmt = (c: number) => formatMoney(c, cur);
  const month = today.slice(0, 7);

  const [txForm, setTxForm] = useState<{ open: boolean; type: TxType; editing: Transaction | null }>({ open: false, type: 'expense', editing: null });
  const [eventForm, setEventForm] = useState<{ open: boolean; editing: AgendaEvent | null }>({ open: false, editing: null });
  const [paying, setPaying] = useState<Occurrence | null>(null);

  const balance = useMemo(() => computeBalance(settings.initialBalance, transactions), [settings.initialBalance, transactions]);
  const summary = useMemo(() => summarizeMonth(transactions, month), [transactions, month]);
  const series = useMemo(() => monthlySeries(transactions, month, 6), [transactions, month]);
  const recent = useMemo(() => sortByDateDesc(transactions).slice(0, 6), [transactions]);
  const monthCats = useMemo(
    () => totalsByCategory(transactions.filter((t) => t.date.startsWith(month)), 'expense').slice(0, 6),
    [transactions, month],
  );

  const balancePoints = useMemo(() => {
    const pts: { label: string; value: number }[] = [];
    const start = addDays(today, -29);
    let running = computeBalance(settings.initialBalance, transactions, addDays(start, -1));
    const byDay = new Map<string, number>();
    for (const t of transactions) if (t.date >= start && t.date <= today) byDay.set(t.date, (byDay.get(t.date) ?? 0) + (t.type === 'income' ? t.amount : -t.amount));
    for (let i = 0; i < 30; i++) {
      const d = addDays(start, i);
      running += byDay.get(d) ?? 0;
      pts.push({ label: formatDate(d, { year: false }), value: running });
    }
    return pts;
  }, [transactions, settings.initialBalance, today]);

  const upcomingDues = useMemo(
    () => buildOccurrences(recurring, transactions, today, { horizonDays: 30 }).filter((o) => o.status !== 'paid').slice(0, 6),
    [recurring, transactions, today],
  );

  const openDues = useMemo(() => {
    const monthEnd = `${month}-31`;
    const list = buildOccurrences(recurring, transactions, today, { horizonDays: 31 }).filter((o) => o.status !== 'paid' && o.due <= monthEnd);
    return { total: list.reduce((s, o) => s + o.recurring.amount, 0), count: list.length, overdue: list.filter((o) => o.status === 'overdue').length };
  }, [recurring, transactions, today, month]);

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events
      .filter((e) => e.end >= now && !(e.kind === 'task' && e.done))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 6);
  }, [events, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const secondary = quote && quote.base === cur && quote.target === settings.secondaryCurrency ? convertCents(balance, quote.rate) : null;
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
            <Button variant="glass" icon={<Minus size={18} />} onClick={() => setTxForm({ open: true, type: 'expense', editing: null })}>
              Despesa
            </Button>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setTxForm({ open: true, type: 'income', editing: null })}>
              Entrada
            </Button>
          </>
        }
      />

      <div className="dash-grid">
        <GlassCard className="hero-card span-2 row-2" title="Saldo atual" icon={<Wallet size={18} />}>
          <p className="hero-value" aria-live="polite">
            {fmt(balance)}
          </p>
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
                  1 {cur} = {quote.rate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {settings.secondaryCurrency} · cotação de {formatDateTime(quote.quotedAt, tz)}
                </span>
              </>
            )}
            {rateError && (
              <span className="status-text status-text--warning" role="status">
                <AlertTriangle size={14} aria-hidden /> {secondary === null ? `Não foi possível obter a cotação ${cur}→${settings.secondaryCurrency}.` : 'Cotação não pôde ser atualizada.'}
              </span>
            )}
            <button className="link-btn" onClick={refresh} disabled={rateLoading} aria-label="Atualizar cotação">
              <RefreshCw size={14} className={rateLoading ? 'spin' : ''} /> Atualizar
            </button>
          </div>
        </GlassCard>

        <GlassCard className="stat-card" title="Entradas do mês" icon={<TrendingUp size={18} />}>
          <p className="stat-value">{fmt(summary.income)}</p>
          <p className="muted small">{formatMonth(month)}</p>
        </GlassCard>

        <GlassCard className="stat-card" title="Despesas do mês" icon={<TrendingDown size={18} />}>
          <p className="stat-value">{fmt(summary.expense)}</p>
          <p className="muted small">{formatMonth(month)}</p>
        </GlassCard>

        <GlassCard className="stat-card" title="Resultado mensal" icon={summary.net >= 0 ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}>
          <p className="stat-value">
            {summary.net > 0 ? '+' : summary.net < 0 ? '−' : ''}
            {fmt(Math.abs(summary.net))}
          </p>
          <Badge tone={summary.net >= 0 ? 'good' : 'critical'} icon={summary.net >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}>
            {summary.net >= 0 ? 'Superávit' : 'Déficit'}
          </Badge>
        </GlassCard>

        <GlassCard className="stat-card" title="Vencimentos em aberto" icon={<Repeat size={18} />}>
          <p className="stat-value">{fmt(openDues.total)}</p>
          {openDues.overdue > 0 ? (
            <Badge tone="critical" icon={<AlertTriangle size={12} />}>
              {openDues.overdue} vencida{openDues.overdue > 1 ? 's' : ''}
            </Badge>
          ) : (
            <p className="muted small">{openDues.count} até o fim do mês</p>
          )}
        </GlassCard>

        <GlassCard className="span-2" title="Entradas × Despesas" icon={<TrendingUp size={18} />} actions={<span className="muted small">últimos 6 meses</span>}>
          <GroupedColumns
            caption="Entradas e despesas nos últimos 6 meses"
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
                  <span className="due-row__amount">{fmt(o.recurring.amount)}</span>
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

      <TransactionForm open={txForm.open} defaultType={txForm.type} editing={txForm.editing} onClose={() => setTxForm((s) => ({ ...s, open: false, editing: null }))} />
      <EventForm open={eventForm.open} editing={eventForm.editing} onClose={() => setEventForm({ open: false, editing: null })} />
      <PayDialog occurrence={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
