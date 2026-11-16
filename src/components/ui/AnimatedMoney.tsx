import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/money';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Valor monetário com transição discreta quando muda (contagem curta + leve destaque).
 * Leitores de tela recebem apenas o valor final.
 */
export function AnimatedMoney({ cents, currency, signed = false, className = '' }: { cents: number; currency: string; signed?: boolean; className?: string }) {
  const [shown, setShown] = useState(cents);
  const [pulse, setPulse] = useState(0);
  const from = useRef(cents);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (from.current === cents) return;
    const start = from.current;
    from.current = cents;
    setPulse((p) => p + 1);
    if (reduceMotion()) {
      setShown(cents);
      return;
    }
    const t0 = performance.now();
    const dur = 450;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(k >= 1 ? cents : Math.round(start + (cents - start) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [cents]);

  const text = (v: number) => (signed ? (v > 0 ? '+ ' : v < 0 ? '− ' : '') + formatMoney(Math.abs(v), currency) : formatMoney(v, currency));
  return (
    <span className={`money-anim ${className}`} key={pulse} data-pulse={pulse > 0 || undefined}>
      <span aria-hidden>{text(shown)}</span>
      <span className="sr-only">{text(cents)}</span>
    </span>
  );
}
