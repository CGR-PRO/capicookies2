import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Mede a largura disponível do contêiner para desenhar gráficos SVG responsivos. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Ticks "limpos" para um eixo. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

function compact(v: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: Math.abs(v) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(v);
}

interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ t }: { t: TooltipState | null }) {
  if (!t) return null;
  return (
    <div className="chart-tooltip" style={{ left: t.x, top: t.y }} role="presentation">
      {t.content}
    </div>
  );
}

/* ---------------- Colunas agrupadas (entradas × despesas por mês) ---------------- */

export interface GroupedDatum {
  label: string;
  fullLabel: string;
  values: number[];
}

interface GroupedProps {
  data: GroupedDatum[];
  series: { name: string; color: string }[];
  format(v: number): string;
  height?: number;
  caption: string;
}

export function GroupedColumns({ data, series, format, height = 220, caption }: GroupedProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 8, bottom: 26, left: 44 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const ticks = niceTicks(0, max, 4);
  const top = ticks[ticks.length - 1];
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.min(24, Math.max(4, (band * 0.7 - 2 * (series.length - 1)) / series.length));
  const groupW = barW * series.length + 2 * (series.length - 1);
  const y = (v: number) => innerH - (v / top) * innerH;

  return (
    <figure className="chart">
      <div className="chart-legend" aria-hidden>
        {series.map((s) => (
          <span key={s.name} className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div ref={ref} className="chart__plot" onMouseLeave={() => (setTip(null), setHover(null))}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={caption}>
            <g transform={`translate(${pad.left},${pad.top})`}>
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerW} className="chart-grid" />
                  <text x={-8} dy="0.32em" textAnchor="end" className="chart-axis">
                    {compact(t / 100)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const gx = i * band + (band - groupW) / 2;
                return (
                  <g key={d.fullLabel}>
                    {hover === i && <rect x={i * band} y={0} width={band} height={innerH} className="chart-hoverband" rx={8} />}
                    {d.values.map((v, si) => {
                      const h = Math.max(0, innerH - y(v));
                      const x = gx + si * (barW + 2);
                      const r = Math.min(4, h, barW / 2);
                      // Topo arredondado (4px), base reta.
                      const path = h <= 0 ? '' : `M${x},${innerH} V${innerH - h + r} Q${x},${innerH - h} ${x + r},${innerH - h} H${x + barW - r} Q${x + barW},${innerH - h} ${x + barW},${innerH - h + r} V${innerH} Z`;
                      return path ? <path key={si} d={path} fill={series[si].color} /> : null;
                    })}
                    <text x={i * band + band / 2} y={innerH + 18} textAnchor="middle" className="chart-axis">
                      {d.label}
                    </text>
                    <rect
                      x={i * band}
                      y={0}
                      width={band}
                      height={innerH}
                      fill="transparent"
                      onMouseMove={(e) => {
                        const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                        setHover(i);
                        setTip({
                          x: Math.min(e.clientX - box.left + 12, width - 170),
                          y: e.clientY - box.top - 10,
                          content: (
                            <>
                              <strong>{d.fullLabel}</strong>
                              {series.map((s, si) => (
                                <span key={s.name} className="chart-tooltip__row">
                                  <span className="chart-legend__swatch" style={{ background: s.color }} />
                                  {s.name}: <b>{format(d.values[si])}</b>
                                </span>
                              ))}
                            </>
                          ),
                        });
                      }}
                    />
                  </g>
                );
              })}
              <line y1={innerH} y2={innerH} x2={innerW} className="chart-baseline" />
            </g>
          </svg>
        )}
        <Tooltip t={tip} />
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Mês</th>
            {series.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.fullLabel}>
              <th>{d.fullLabel}</th>
              {d.values.map((v, i) => (
                <td key={i}>{format(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------------- Linha com área (evolução do saldo) ---------------- */

interface LineProps {
  points: { label: string; value: number }[];
  color: string;
  format(v: number): string;
  height?: number;
  caption: string;
}

export function AreaLine({ points, color, format, height = 180, caption }: LineProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 22, left: 48 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const vals = points.map((p) => p.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const ticks = niceTicks(min, max, 3);
  const lo = ticks[0];
  const top = ticks[ticks.length - 1];
  const x = (i: number) => (points.length < 2 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => innerH - ((v - lo) / (top - lo || 1)) * innerH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = points.length ? `${line} L${x(points.length - 1)},${y(Math.max(lo, 0))} L${x(0)},${y(Math.max(lo, 0))} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  useEffect(() => setHi(null), [points.length]);

  return (
    <figure className="chart">
      <div
        ref={ref}
        className="chart__plot"
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => {
          if (!points.length) return;
          const box = e.currentTarget.getBoundingClientRect();
          const rel = e.clientX - box.left - pad.left;
          const i = Math.round((rel / (innerW || 1)) * (points.length - 1));
          setHi(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={caption}>
            <g transform={`translate(${pad.left},${pad.top})`}>
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerW} className={t === 0 ? 'chart-baseline' : 'chart-grid'} />
                  <text x={-8} dy="0.32em" textAnchor="end" className="chart-axis">
                    {compact(t / 100)}
                  </text>
                </g>
              ))}
              <path d={area} fill={color} opacity={0.12} />
              <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) =>
                i % labelEvery === 0 || i === points.length - 1 ? (
                  <text key={i} x={x(i)} y={innerH + 16} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="chart-axis">
                    {p.label}
                  </text>
                ) : null,
              )}
              {points.length > 0 && hi === null && (
                <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={4.5} fill={color} className="chart-dot" />
              )}
              {hi !== null && (
                <>
                  <line x1={x(hi)} x2={x(hi)} y2={innerH} className="chart-crosshair" />
                  <circle cx={x(hi)} cy={y(points[hi].value)} r={5} fill={color} className="chart-dot" />
                </>
              )}
            </g>
          </svg>
        )}
        {hi !== null && points[hi] && (
          <div className="chart-tooltip" style={{ left: Math.min(pad.left + x(hi) + 12, width - 160), top: Math.max(0, pad.top + y(points[hi].value) - 44) }}>
            <strong>{points[hi].label}</strong>
            <span className="chart-tooltip__row">
              Saldo: <b>{format(points[hi].value)}</b>
            </span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <th>{p.label}</th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------------- Barras horizontais (gastos por categoria) ---------------- */

interface HBarProps {
  rows: { id: string; label: string; value: number; color?: string }[];
  format(v: number): string;
  caption: string;
}

export function HorizontalBars({ rows, format, caption }: HBarProps) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <figure className="hbars" aria-label={caption}>
      <ul>
        {rows.map((r) => {
          const pct = total ? Math.round((r.value / total) * 100) : 0;
          return (
            <li key={r.id} className="hbars__row" title={`${r.label}: ${format(r.value)} (${pct}%)`}>
              <span className="hbars__label">
                <span className="cat-dot" style={{ background: r.color ?? 'var(--text-muted)' }} aria-hidden />
                {r.label}
              </span>
              <span className="hbars__track" aria-hidden>
                <span className="hbars__bar" style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              <span className="hbars__value">
                {format(r.value)} <span className="muted">· {pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
