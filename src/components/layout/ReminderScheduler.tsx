import { useEffect, useRef } from 'react';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { timeInTz } from '../../lib/dates';

/**
 * Verifica periodicamente os lembretes da agenda e avisa o usuário por notificação
 * do sistema (se permitida) e por aviso dentro do aplicativo.
 */
export function ReminderScheduler() {
  const data = useData();
  const toast = useToast();
  const ref = useRef(data);
  ref.current = data;

  useEffect(() => {
    const check = () => {
      const { events, settings, markReminded } = ref.current;
      const now = Date.now();
      for (const ev of events) {
        if (ev.reminderMinutes == null || ev.remindedAt || ev.done) continue;
        const start = new Date(ev.start).getTime();
        const fireAt = start - ev.reminderMinutes * 60_000;
        // Dispara no horário do lembrete; ignora eventos que já terminaram.
        if (now >= fireAt && now <= new Date(ev.end).getTime()) {
          const when = ev.allDay ? 'hoje' : `às ${timeInTz(ev.start, settings.timezone)}`;
          const msg = `${ev.kind === 'task' ? 'Tarefa' : 'Compromisso'}: ${ev.title} — ${when}`;
          toast.info(`🔔 ${msg}`);
          if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Lembrete', { body: msg, icon: './favicon.svg', tag: ev.id });
            } catch {
              /* alguns navegadores móveis não permitem o construtor */
            }
          }
          markReminded(ev.id).catch(() => undefined);
        }
      }
    };
    check();
    const t = setInterval(check, 20_000);
    return () => clearInterval(t);
  }, [toast]);

  return null;
}
