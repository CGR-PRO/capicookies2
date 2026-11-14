import { useLayoutEffect as useResetEffect, useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Field, FormRow } from '../ui/Field';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Glass';
import { Toggle } from '../ui/Toggle';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { useConfirm } from '../ui/ConfirmDialog';
import { addDays, dateInTz, isValidDateStr, isValidTimeStr, timeInTz, zonedToUtc } from '../../lib/dates';
import { EVENT_COLORS } from '../../lib/defaults';
import type { AgendaEvent, EventKind } from '../../lib/types';

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sem lembrete' },
  { value: '0', label: 'No horário' },
  { value: '5', label: '5 minutos antes' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 dia antes' },
  { value: '2880', label: '2 dias antes' },
];

interface Props {
  open: boolean;
  onClose(): void;
  editing?: AgendaEvent | null;
  /** Data/hora sugeridas para um novo evento. */
  initialDate?: string;
  initialTime?: string;
  initialKind?: EventKind;
}

export function EventForm({ open, onClose, editing, initialDate, initialTime, initialKind = 'event' }: Props) {
  const { saveEvent, deleteEvent, settings, today } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const tz = settings.timezone;
  const [kind, setKind] = useState<EventKind>(initialKind);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState('15');
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useResetEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind);
      setTitle(editing.title);
      setDate(dateInTz(editing.start, tz));
      setAllDay(editing.allDay);
      setStartTime(editing.allDay ? '09:00' : timeInTz(editing.start, tz));
      setEndTime(editing.allDay ? '10:00' : timeInTz(editing.end, tz));
      setLocation(editing.location ?? '');
      setNotes(editing.notes ?? '');
      setReminder(editing.reminderMinutes == null ? '' : String(editing.reminderMinutes));
      setColor(editing.color);
      setDone(editing.done);
    } else {
      const st = initialTime ?? '09:00';
      const [h, m] = st.split(':').map(Number);
      const endH = Math.min(23, h + 1);
      setKind(initialKind);
      setTitle('');
      setDate(initialDate ?? today);
      setAllDay(false);
      setStartTime(st);
      setEndTime(h >= 23 ? '23:59' : `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      setLocation('');
      setNotes('');
      setReminder(initialKind === 'task' ? '' : '15');
      setColor(initialKind === 'task' ? EVENT_COLORS[1] : EVENT_COLORS[0]);
      setDone(false);
    }
    setErrors({});
  }, [open, editing, initialDate, initialTime, initialKind, tz, today]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Informe um título.';
    if (!isValidDateStr(date)) errs.date = 'Informe uma data válida.';
    if (!allDay) {
      if (!isValidTimeStr(startTime)) errs.startTime = 'Horário inválido.';
      if (!isValidTimeStr(endTime)) errs.endTime = 'Horário inválido.';
      else if (isValidTimeStr(startTime) && endTime < startTime) errs.endTime = 'O término deve ser após o início.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const start = allDay ? zonedToUtc(date, '00:00', tz) : zonedToUtc(date, startTime, tz);
    const end = allDay ? new Date(zonedToUtc(addDays(date, 1), '00:00', tz).getTime() - 60_000) : zonedToUtc(date, endTime, tz);
    setSaving(true);
    try {
      await saveEvent({
        id: editing?.id,
        kind,
        title,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        reminderMinutes: reminder === '' ? null : Number(reminder),
        done,
        color,
      });
      if (reminder !== '' && settings.notificationsEnabled === false) {
        toast.success(editing ? 'Evento atualizado. Ative as notificações em Configurações para receber lembretes do sistema.' : 'Evento criado.');
      } else toast.success(editing ? 'Evento atualizado.' : kind === 'task' ? 'Tarefa criada.' : 'Compromisso criado.');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({ title: 'Excluir evento?', message: `“${editing.title}” será removido da agenda.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try {
      await deleteEvent(editing.id);
      toast.success('Evento excluído.');
      onClose();
    } catch {
      toast.error('Não foi possível excluir.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar evento' : kind === 'task' ? 'Nova tarefa' : 'Novo compromisso'}
      footer={
        <>
          {editing && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="event-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="event-form" className="form" onSubmit={submit} noValidate>
        <Segmented
          label="Tipo"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'event', label: 'Compromisso' },
            { value: 'task', label: 'Tarefa' },
          ]}
        />
        <Field label="Título" error={errors.title} required>
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'task' ? 'Ex.: Pagar a conta de luz' : 'Ex.: Consulta médica'} />
        </Field>
        <Field label="Data" error={errors.date} required>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Toggle checked={allDay} onChange={setAllDay} label="Dia inteiro" />
        {!allDay && (
          <FormRow>
            <Field label="Início" error={errors.startTime} required>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Término" error={errors.endTime} required>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </FormRow>
        )}
        <FormRow>
          <Field label="Lembrete">
            <select className="input" value={reminder} onChange={(e) => setReminder(e.target.value)}>
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local">
            <input className="input" value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </FormRow>
        <div className="field">
          <span className="field__label" id="ev-color">
            Cor
          </span>
          <div className="color-picker" role="radiogroup" aria-labelledby="ev-color">
            {EVENT_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Cor ${c}`} className={`color-swatch${color === c ? ' is-active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <Field label="Notas">
          <textarea className="input" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {kind === 'task' && <Toggle checked={done} onChange={setDone} label="Tarefa concluída" />}
        <p className="field__hint">Fuso horário: {tz}</p>
      </form>
    </Modal>
  );
}
