/** Utilidades monetárias. Todo cálculo usa centavos inteiros para evitar erros de ponto flutuante. */

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Converte texto digitado ("1.234,56", "1234.56", "12,5") em centavos.
 * Retorna null para entradas inválidas.
 */
export function parseMoney(input: string): number | null {
  const raw = input.trim().replace(/\s/g, '').replace(/[€$R£¥]/g, '');
  if (!raw) return null;
  let normalized = raw;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // O último separador é o decimal.
    if (lastComma > lastDot) normalized = raw.replace(/\./g, '').replace(',', '.');
    else normalized = raw.replace(/,/g, '');
  } else if (lastComma > -1) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1) {
    const parts = raw.split('.');
    // "1.234" (milhar) vs "12.34" (decimal)
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && !/^0/.test(parts[0]))) {
      normalized = raw.replace(/\./g, '');
    }
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency: string, opts: { compact?: boolean } = {}): string {
  const key = `${currency}|${opts.compact ? 'c' : ''}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency,
        notation: opts.compact ? 'compact' : 'standard',
        maximumFractionDigits: opts.compact ? 1 : 2,
      });
    } catch {
      f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    formatters.set(key, f);
  }
  return f.format(cents / 100);
}

/** Valor para preencher um campo de edição (ex.: 123456 → "1234,56"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Máximo de dígitos aceitos pela máscara (até 99.999.999.999,99). */
export const MASK_MAX_DIGITS = 13;

/**
 * Máscara monetária: extrai apenas os dígitos digitados e os interpreta como centavos.
 * "1" → 1 (0,01) · "12345" → 12345 (123,45). Retorna null quando não há dígitos.
 */
export function digitsToCents(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MASK_MAX_DIGITS);
  if (!digits) return null;
  return Number(digits);
}

/** Texto exibido no campo mascarado (ex.: 12345 → "€ 123,45"). */
export function formatMaskedInput(cents: number | null, currency: string): string {
  if (cents === null) return '';
  return formatMoney(cents, currency).replace(/ /g, ' ');
}
