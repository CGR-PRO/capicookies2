import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthName } from '../../lib/dates';

interface Props {
  /** Mês no formato YYYY-MM. */
  value: string;
  onChange(v: string): void;
  minYear: number;
  maxYear: number;
  current?: string;
}

/** Seletor de mês e ano com setas (anterior/próximo) e listas de mês e ano. */
export function MonthYearPicker({ value, onChange, minYear, maxYear, current }: Props) {
  const [y, m] = value.split('-').map(Number);
  const years: number[] = [];
  for (let i = Math.min(minYear, y); i <= Math.max(maxYear, y); i++) years.push(i);
  const set = (yy: number, mm: number) => onChange(`${yy}-${String(mm).padStart(2, '0')}`);
  return (
    <div className="month-picker" role="group" aria-label="Mês e ano">
      <button type="button" className="icon-btn" onClick={() => onChange(addMonths(`${value}-01`, -1).slice(0, 7))} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </button>
      <select className="input input--sm month-picker__month" value={m} onChange={(e) => set(y, Number(e.target.value))} aria-label="Mês">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
          <option key={mm} value={mm}>
            {monthName(mm).replace(/^./, (c) => c.toUpperCase())}
          </option>
        ))}
      </select>
      <select className="input input--sm month-picker__year" value={y} onChange={(e) => set(Number(e.target.value), m)} aria-label="Ano">
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
      <button type="button" className="icon-btn" onClick={() => onChange(addMonths(`${value}-01`, 1).slice(0, 7))} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </button>
      {current && value !== current && (
        <button type="button" className="link-btn" onClick={() => onChange(current)}>
          Mês atual
        </button>
      )}
    </div>
  );
}
