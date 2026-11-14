/**
 * Utilidades de data com suporte a fuso horário configurável (padrão Europe/Dublin).
 * Datas de calendário (YYYY-MM-DD) são tratadas como valores puros, sem fuso.
 * Instantes (eventos da agenda) são guardados em ISO UTC e exibidos no fuso escolhido.
 */

export const DEFAULT_TZ = 'Europe/Dublin';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function parseDateStr(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function makeDateStr(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(s: string, days: number): string {
  const { y, m, d } = parseDateStr(s);
  return makeDateStr(y, m, d + days);
}

/** Soma meses preservando o dia quando possível (31/jan + 1 mês = 28 ou 29/fev). */
export function addMonths(s: string, months: number, anchorDay?: number): string {
  const { y, m, d } = parseDateStr(s);
  const day = anchorDay ?? d;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth() + 1;
  const last = daysInMonth(ty, tm);
  return `${ty}-${pad(tm)}-${pad(Math.min(day, last))}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Diferença em dias (b - a). */
export function diffDays(a: string, b: string): number {
  const pa = parseDateStr(a);
  const pb = parseDateStr(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/** Dia da semana (0 = domingo) de uma data de calendário. */
export function weekday(s: string): number {
  const { y, m, d } = parseDateStr(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Início da semana (segunda-feira). */
export function startOfWeek(s: string): string {
  const wd = weekday(s);
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDays(s, delta);
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Data de calendário de um instante no fuso indicado. */
export function dateInTz(date: Date | string, tz: string): string {
  const p = zonedParts(typeof date === 'string' ? new Date(date) : date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Hora (HH:mm) de um instante no fuso indicado. */
export function timeInTz(date: Date | string, tz: string): string {
  const p = zonedParts(typeof date === 'string' ? new Date(date) : date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayInTz(tz: string): string {
  return dateInTz(new Date(), tz);
}

/** Minutos desde a meia-noite no fuso indicado. */
export function minutesInTz(date: Date | string, tz: string): number {
  const p = zonedParts(typeof date === 'string' ? new Date(date) : date, tz);
  return p.hour * 60 + p.minute;
}

/**
 * Converte uma data/hora "de parede" no fuso indicado para um instante UTC.
 * Usa iteração sobre o deslocamento para lidar com horário de verão.
 */
export function zonedToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const { y, m, d } = parseDateStr(dateStr);
  const [hh, mm] = timeStr.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wallAsUtc;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const seenAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const delta = wallAsUtc - seenAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(): string[] {
  const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    const list = anyIntl.supportedValuesOf?.('timeZone');
    if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    /* ignora */
  }
  return ['UTC', 'Europe/Dublin', 'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'America/Sao_Paulo', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function monthName(m: number): string {
  return MONTHS[m - 1];
}

export function monthShort(m: number): string {
  return MONTHS_SHORT[m - 1];
}

/** "14 nov 2026" */
export function formatDate(s: string, opts: { year?: boolean; weekday?: boolean } = { year: true }): string {
  if (!isValidDateStr(s)) return s;
  const { y, m, d } = parseDateStr(s);
  let out = `${d} ${MONTHS_SHORT[m - 1]}`;
  if (opts.year !== false) out += ` ${y}`;
  if (opts.weekday) out = `${WEEKDAYS_SHORT[weekday(s)]}, ${out}`;
  return out;
}

/** "novembro de 2026" */
export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function formatDateTime(iso: string, tz: string): string {
  return `${formatDate(dateInTz(iso, tz))}, ${timeInTz(iso, tz)}`;
}

/** Texto relativo curto: "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function relativeDay(target: string, today: string): string {
  const n = diffDays(today, target);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1) return `em ${n} dias`;
  return `há ${-n} dias`;
}
