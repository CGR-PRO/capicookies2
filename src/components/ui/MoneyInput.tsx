import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';
import { digitsToCents, formatMaskedInput } from '../../lib/money';

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor em centavos inteiros (null = vazio). */
  value: number | null;
  onChange(cents: number | null): void;
  currency: string;
  /** Permite valores negativos (digitar "-" alterna o sinal). */
  allowNegative?: boolean;
}

/**
 * Campo monetário com máscara automática: o usuário digita apenas números e a vírgula
 * decimal é inserida automaticamente (1 → € 0,01 · 12345 → € 123,45).
 * O valor é sempre entregue em centavos inteiros, nunca como texto formatado.
 */
export function MoneyInput({ value, onChange, currency, allowNegative, className = '', placeholder, ...rest }: MoneyInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const display = formatMaskedInput(value, currency);

  // Mantém o cursor no fim: os dígitos sempre entram pela direita.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  }, [display]);

  const handleChange = (raw: string) => {
    const abs = digitsToCents(raw);
    if (abs === null) {
      onChange(null);
      return;
    }
    let negative = false;
    if (allowNegative) {
      const minus = (raw.match(/-/g) ?? []).length;
      const wasNegative = value !== null && value < 0;
      // Digitar "-" alterna o sinal; apagar o "-" torna o valor positivo.
      negative = wasNegative ? minus === 1 : minus >= 1;
    }
    onChange(negative ? -abs : abs);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={`input input--money ${className}`}
      placeholder={placeholder ?? formatMaskedInput(0, currency)}
      value={display}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => {
        const el = e.currentTarget;
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
      onKeyDown={(e) => {
        // Backspace/Delete removem sempre o último dígito, mesmo com o cursor em outra posição.
        if ((e.key === 'Backspace' || e.key === 'Delete') && value !== null && e.currentTarget.selectionStart === e.currentTarget.selectionEnd) {
          e.preventDefault();
          const abs = Math.floor(Math.abs(value) / 10);
          onChange(abs === 0 ? null : value < 0 ? -abs : abs);
        }
        rest.onKeyDown?.(e);
      }}
    />
  );
}
