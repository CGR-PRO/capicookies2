import { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Bell } from 'lucide-react';
import { addDays, dateInTz, minutesInTz, parseDateStr, startOfWeek, timeInTz, WEEKDAYS_SHORT, weekday, monthShort } from '../../lib/dates';
import type { AgendaEvent } from '../../lib/types';

export interface ViewProps {
  anchor: string;
  today: string;
  tz: string;
  events: AgendaEvent[];
  onSelectDay(date: string): void;
  onCreate(date: string, time?: string): void;
  onOpen(ev: AgendaEvent): void;
  onToggleDone(ev: AgendaEvent): void;
}

export function groupByDay(events: AgendaEvent[], tz: string): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const d = dateInTz(e.start, tz);
    const arr = map.get(d) ?? [];
    arr.push(e);
    map.set(d, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
  return map;
}

/* ---------------- Mês ---------------- */

export function MonthView({ anchor, today, tz, events, onSelectDay, onCreate, onOpen }: ViewProps) {
  const { y, m } = parseDateStr(anchor);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Remove a última semana se estiver toda no mês seguinte.
  const visible = days.slice(35).every((d) => parseDateStr(d).m !== m) ? days.slice(0, 35) : days;
  const byDay = groupByDay(events, tz);
  const heads = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="month-view" role="grid" aria-label="Calendário mensal">
      <div className="month-view__head" role="row">
        {heads.map((d) => (
          <span key={d} role="columnheader">
            {WEEKDAYS_SHORT[d]}
          </span>
        ))}
      </div>
      <div className="month-view__grid">
        {visible.map((d) => {
          const p = parseDateStr(d);
          const list = byDay.get(d) ?? [];
          const outside = p.m !== m;
          return (
            <div
              key={d}
              role="gridcell"
              className={`month-cell${outside ? ' is-outside' : ''}${d === today ? ' is-today' : ''}${weekday(d) % 6 === 0 ? ' is-weekend' : ''}`}
              onDoubleClick={() => onCreate(d)}
            >
              <button className="month-cell__day" onClick={() => onSelectDay(d)} aria-label={`${p.d} de ${monthShort(p.m)}, ${list.length} evento(s)`}>
                {p.d}
              </button>
              <ul className="month-cell__events">
                {list.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <button className={`chip${e.done ? ' is-done' : ''}`} style={{ '--chip': e.color } as React.CSSProperties} onClick={() => onOpen(e)} title={e.title}>
                      {!e.allDay && <span className="chip__time">{timeInTz(e.start, tz)}</span>}
                      <span className="chip__title">{e.title}</span>
                    </button>
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <button className="chip chip--more" onClick={() => onSelectDay(d)}>
                      +{list.length - 3} mais
                    </button>
                  </li>
                )}
              </ul>
              {list.length > 0 && <span className="month-cell__dots" aria-hidden>{list.slice(0, 4).map((e) => <i key={e.id} style={{ background: e.color }} />)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Grade de horários (semana e dia) ---------------- */

const HOUR_PX = 48;

interface Placed {
  ev: AgendaEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

function layoutDay(list: AgendaEvent[], tz: string): Placed[] {
  const timed = list.filter((e) => !e.allDay).map((ev) => {
    const s = minutesInTz(ev.start, tz);
    let en = minutesInTz(ev.end, tz);
    if (dateInTz(ev.end, tz) !== dateInTz(ev.start, tz)) en = 24 * 60;
    return { ev, s, en: Math.max(en, s + 20) };
  });
  timed.sort((a, b) => a.s - b.s);
  const out: Placed[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const assigned = cluster.map((c) => {
      let lane = laneEnds.findIndex((end) => end <= c.s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(c.en);
      } else laneEnds[lane] = c.en;
      return { c, lane };
    });
    for (const { c, lane } of assigned) out.push({ ev: c.ev, top: (c.s / 60) * HOUR_PX, height: ((c.en - c.s) / 60) * HOUR_PX, lane, lanes: laneEnds.length });
    cluster = [];
  };
  for (const t of timed) {
    if (t.s >= clusterEnd && cluster.length) flush();
    cluster.push(t);
    clusterEnd = Math.max(clusterEnd, t.en);
  }
  if (cluster.length) flush();
  return out;
}

function TimeGrid({ days, today, tz, events, onCreate, onOpen, onSelectDay, onToggleDone }: ViewProps & { days: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const byDay = groupByDay(events, tz);
  const nowMin = minutesInTz(new Date(), tz);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_PX * 7 });
  }, []);

  return (
    <div className={`time-grid${days.length === 1 ? ' time-grid--day' : ''}`} style={{ '--cols': days.length } as React.CSSProperties}>
      <div className="time-grid__header">
        <span />
        {days.map((d) => {
          const p = parseDateStr(d);
          return (
            <button key={d} className={`time-grid__dayhead${d === today ? ' is-today' : ''}`} onClick={() => onSelectDay(d)}>
              <span className="muted small">{WEEKDAYS_SHORT[weekday(d)]}</span>
              <strong>{p.d}</strong>
            </button>
          );
        })}
      </div>
      <div className="time-grid__allday">
        <span className="muted small">dia todo</span>
        {days.map((d) => (
          <div key={d} className="time-grid__allday-cell">
            {(byDay.get(d) ?? [])
              .filter((e) => e.allDay)
              .map((e) => (
                <button key={e.id} className={`chip${e.done ? ' is-done' : ''}`} style={{ '--chip': e.color } as React.CSSProperties} onClick={() => onOpen(e)}>
                  <span className="chip__title">{e.title}</span>
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="time-grid__body" ref={scrollRef}>
        <div className="time-grid__hours" aria-hidden>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ top: h * HOUR_PX }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="time-grid__col" style={{ height: HOUR_PX * 24 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                className="time-grid__slot"
                style={{ top: h * HOUR_PX, height: HOUR_PX }}
                onClick={() => onCreate(d, `${String(h).padStart(2, '0')}:00`)}
                aria-label={`Criar evento em ${d} às ${h}h`}
                tabIndex={-1}
              />
            ))}
            {d === today && <span className="time-grid__now" style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden />}
            {layoutDay(byDay.get(d) ?? [], tz).map(({ ev, top, height, lane, lanes }) => (
              <div
                key={ev.id}
                className={`tg-event${ev.done ? ' is-done' : ''}`}
                style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, '--chip': ev.color } as React.CSSProperties}
              >
                <button className="tg-event__body" onClick={() => onOpen(ev)}>
                  <strong>{ev.title}</strong>
                  <span>
                    {timeInTz(ev.start, tz)}–{timeInTz(ev.end, tz)}
                  </span>
                </button>
                {ev.kind === 'task' && (
                  <button className="tg-event__check" onClick={() => onToggleDone(ev)} aria-label={ev.done ? 'Marcar como pendente' : 'Marcar como concluída'}>
                    {ev.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  </button>
                )}
                {ev.reminderMinutes != null && height > 40 && <Bell size={11} className="tg-event__bell" aria-label="Com lembrete" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeekView(props: ViewProps) {
  const start = startOfWeek(props.anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return <TimeGrid {...props} days={days} />;
}

export function DayView(props: ViewProps) {
  return <TimeGrid {...props} days={[props.anchor]} />;
}
