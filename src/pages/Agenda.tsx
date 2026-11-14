import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, ListTodo, Plus } from 'lucide-react';
import { useData } from '../store/DataProvider';
import { useToast } from '../store/ToastProvider';
import { GlassCard, PageHeader, Segmented, EmptyState } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { EventForm } from '../components/agenda/EventForm';
import { DayView, MonthView, WeekView, groupByDay } from '../components/agenda/CalendarViews';
import { addDays, addMonths, dateInTz, formatDate, monthName, parseDateStr, relativeDay, startOfWeek, timeInTz, WEEKDAYS } from '../lib/dates';
import type { AgendaEvent, EventKind } from '../lib/types';

type View = 'month' | 'week' | 'day';

export default function Agenda() {
  const { events, today, settings, setEventDone } = useData();
  const toast = useToast();
  const tz = settings.timezone;
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 720 ? 'day' : 'month'));
  const [anchor, setAnchor] = useState(today);
  const [form, setForm] = useState<{ open: boolean; editing: AgendaEvent | null; date?: string; time?: string; kind?: EventKind }>({ open: false, editing: null });
  const [taskFilter, setTaskFilter] = useState<'pending' | 'done'>('pending');

  const move = (dir: number) => {
    if (view === 'month') setAnchor(addMonths(anchor, dir));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(addDays(anchor, dir));
  };

  const title = useMemo(() => {
    const p = parseDateStr(anchor);
    if (view === 'month') return `${monthName(p.m)} de ${p.y}`;
    if (view === 'week') {
      const s = startOfWeek(anchor);
      const e = addDays(s, 6);
      return `${formatDate(s, { year: false })} – ${formatDate(e)}`;
    }
    return `${WEEKDAYS[new Date(`${anchor}T12:00:00Z`).getUTCDay()]}, ${formatDate(anchor)}`;
  }, [anchor, view]);

  const toggleDone = async (ev: AgendaEvent) => {
    try {
      await setEventDone(ev.id, !ev.done);
      toast.success(ev.done ? 'Tarefa reaberta.' : 'Tarefa concluída! ✨');
    } catch {
      toast.error('Não foi possível atualizar.');
    }
  };

  const tasks = useMemo(
    () =>
      events
        .filter((e) => e.kind === 'task' && (taskFilter === 'done' ? e.done : !e.done))
        .sort((a, b) => (taskFilter === 'done' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)))
        .slice(0, 30),
    [events, taskFilter],
  );

  const selectedDayEvents = groupByDay(events, tz).get(anchor) ?? [];

  const viewProps = {
    anchor,
    today,
    tz,
    events,
    onSelectDay: (d: string) => {
      setAnchor(d);
      setView('day');
    },
    onCreate: (d: string, t?: string) => setForm({ open: true, editing: null, date: d, time: t }),
    onOpen: (ev: AgendaEvent) => setForm({ open: true, editing: ev }),
    onToggleDone: toggleDone,
  };

  return (
    <div className="page">
      <PageHeader
        title="Agenda"
        subtitle={`Compromissos e tarefas · fuso ${tz}`}
        actions={
          <>
            <Button icon={<ListTodo size={18} />} onClick={() => setForm({ open: true, editing: null, date: anchor, kind: 'task' })}>
              Tarefa
            </Button>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setForm({ open: true, editing: null, date: anchor, kind: 'event' })}>
              Compromisso
            </Button>
          </>
        }
      />

      <div className="agenda-layout">
        <GlassCard className="calendar-card" padded={false}>
          <div className="calendar-toolbar">
            <div className="month-nav">
              <button className="icon-btn" onClick={() => move(-1)} aria-label="Anterior">
                <ChevronLeft size={18} />
              </button>
              <button className="icon-btn" onClick={() => move(1)} aria-label="Próximo">
                <ChevronRight size={18} />
              </button>
              <h2 className="calendar-title" aria-live="polite">
                {title}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>
                Hoje
              </Button>
            </div>
            <Segmented
              size="sm"
              label="Visualização"
              value={view}
              onChange={setView}
              options={[
                { value: 'month', label: 'Mês' },
                { value: 'week', label: 'Semana' },
                { value: 'day', label: 'Dia' },
              ]}
            />
          </div>
          {view === 'month' && <MonthView {...viewProps} />}
          {view === 'week' && <WeekView {...viewProps} />}
          {view === 'day' && <DayView {...viewProps} />}
        </GlassCard>

        <aside className="agenda-side">
          <GlassCard title={relativeDay(anchor, today) === 'hoje' ? 'Hoje' : formatDate(anchor, { weekday: true })} icon={<CalendarDays size={18} />}>
            {selectedDayEvents.length === 0 ? (
              <EmptyState title="Nada agendado">
                <button className="link-btn" onClick={() => setForm({ open: true, editing: null, date: anchor })}>
                  Adicionar evento
                </button>
              </EmptyState>
            ) : (
              <ul className="event-list">
                {selectedDayEvents.map((e) => (
                  <li key={e.id} className="event-row">
                    <span className="event-row__bar" style={{ background: e.color }} aria-hidden />
                    {e.kind === 'task' && (
                      <button className="icon-btn" onClick={() => toggleDone(e)} aria-label={e.done ? `Reabrir ${e.title}` : `Concluir ${e.title}`}>
                        {e.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>
                    )}
                    <button className={`event-row__main${e.done ? ' is-done' : ''}`} onClick={() => setForm({ open: true, editing: e })}>
                      <span className="event-row__title">{e.title}</span>
                      <span className="muted small">{e.allDay ? 'Dia inteiro' : `${timeInTz(e.start, tz)}–${timeInTz(e.end, tz)}`}{e.location ? ` · ${e.location}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <GlassCard
            title="Tarefas"
            icon={<ListTodo size={18} />}
            actions={
              <Segmented
                size="sm"
                label="Filtro de tarefas"
                value={taskFilter}
                onChange={setTaskFilter}
                options={[
                  { value: 'pending', label: 'Abertas' },
                  { value: 'done', label: 'Feitas' },
                ]}
              />
            }
          >
            {tasks.length === 0 ? (
              <p className="muted">{taskFilter === 'pending' ? 'Nenhuma tarefa pendente. 🎉' : 'Nenhuma tarefa concluída.'}</p>
            ) : (
              <ul className="event-list">
                {tasks.map((t) => {
                  const d = dateInTz(t.start, tz);
                  const late = !t.done && d < today;
                  return (
                    <li key={t.id} className="event-row">
                      <button className="icon-btn" onClick={() => toggleDone(t)} aria-label={t.done ? `Reabrir ${t.title}` : `Concluir ${t.title}`}>
                        {t.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>
                      <button className={`event-row__main${t.done ? ' is-done' : ''}`} onClick={() => setForm({ open: true, editing: t })}>
                        <span className="event-row__title">{t.title}</span>
                        <span className={`small ${late ? 'status-text status-text--critical' : 'muted'}`}>
                          {late ? 'Atrasada · ' : ''}
                          {relativeDay(d, today)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </aside>
      </div>

      <EventForm
        open={form.open}
        editing={form.editing}
        initialDate={form.date}
        initialTime={form.time}
        initialKind={form.kind}
        onClose={() => setForm({ open: false, editing: null })}
      />
    </div>
  );
}
