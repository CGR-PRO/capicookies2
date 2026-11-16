/** Modelos de dados do aplicativo. Valores monetários são sempre inteiros em centavos. */

export type TxType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: TxType;
  color: string;
  createdAt: string;
}

/** Conta financeira manual (sem integração bancária). */
export interface Account {
  id: string;
  name: string;
  /** Saldo inicial em centavos da moeda da conta (pode ser negativo). */
  initialBalance: number;
  currency: string;
  color: string;
  /** Nome do ícone (ver ACCOUNT_ICONS). */
  icon: string;
  /** A conta principal existe sempre e não pode ser arquivada nem excluída. */
  isPrimary: boolean;
  archived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transferência interna entre contas. Não é entrada nem despesa: só movimenta
 * dinheiro entre contas, portanto não entra no resultado mensal.
 */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  /** Valor que sai da conta de origem, em centavos da moeda de origem. */
  amount: number;
  /** Valor que chega na conta de destino, em centavos da moeda de destino (igual a `amount` se a moeda for a mesma). */
  toAmount: number;
  date: string;
  description: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Conta afetada pelo lançamento. */
  accountId: string;
  /** Valor positivo em centavos da moeda da conta. */
  amount: number;
  description: string;
  categoryId: string | null;
  /** Data do lançamento (YYYY-MM-DD) no fuso horário configurado. */
  date: string;
  notes?: string;
  /** Preenchido quando o lançamento é o pagamento de um gasto fixo. */
  recurringId?: string;
  /** Data de vencimento (YYYY-MM-DD) da ocorrência paga. */
  recurringDue?: string;
  createdAt: string;
  updatedAt: string;
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  categoryId: string | null;
  /** Primeira data de vencimento (YYYY-MM-DD). */
  firstDue: string;
  frequency: Frequency;
  /** Conta usada para pagar (padrão: conta principal). */
  accountId?: string;
  /** Data final opcional (YYYY-MM-DD). */
  endDate?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventKind = 'event' | 'task';

export interface AgendaEvent {
  id: string;
  kind: EventKind;
  title: string;
  /** Instante de início em ISO UTC. */
  start: string;
  /** Instante de término em ISO UTC. */
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  /** Minutos antes do início para lembrar. null = sem lembrete. */
  reminderMinutes: number | null;
  /** Instante em que o lembrete foi disparado (evita repetição). */
  remindedAt?: string;
  done: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type BackgroundMode = 'default' | 'image' | 'carousel' | 'video';
export type MediaFit = 'cover' | 'contain';

export interface MediaFraming {
  /** Posição horizontal 0–100 (%). */
  x: number;
  /** Posição vertical 0–100 (%). */
  y: number;
  /** Zoom 1–2.5. */
  zoom: number;
  fit: MediaFit;
}

export interface BackgroundSettings {
  mode: BackgroundMode;
  imageId: string | null;
  imageFraming: MediaFraming;
  carouselIds: string[];
  carouselIntervalSec: number;
  carouselFraming: MediaFraming;
  videoId: string | null;
  videoFraming: MediaFraming;
  /** Escurecimento sobre o fundo para legibilidade, 0–70 (%). */
  overlay: number;
}

export type ThemePref = 'light' | 'dark' | 'system';

export interface Settings {
  /** Legado (v1): saldo inicial antes das contas. Migrado para a conta principal. */
  initialBalance: number;
  primaryCurrency: string;
  secondaryCurrency: string;
  timezone: string;
  theme: ThemePref;
  sidebarCollapsed: boolean;
  notificationsEnabled: boolean;
  background: BackgroundSettings;
}

export interface MediaRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: string;
}
