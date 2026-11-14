import { DEFAULT_TZ } from './dates';
import type { Category, MediaFraming, Settings } from './types';

export const DEFAULT_FRAMING: MediaFraming = { x: 50, y: 50, zoom: 1, fit: 'cover' };

export const DEFAULT_SETTINGS: Settings = {
  initialBalance: 0,
  primaryCurrency: 'EUR',
  secondaryCurrency: 'BRL',
  timezone: DEFAULT_TZ,
  theme: 'light',
  sidebarCollapsed: false,
  notificationsEnabled: false,
  background: {
    mode: 'default',
    imageId: null,
    imageFraming: { ...DEFAULT_FRAMING },
    carouselIds: [],
    carouselIntervalSec: 8,
    carouselFraming: { ...DEFAULT_FRAMING },
    videoId: null,
    videoFraming: { ...DEFAULT_FRAMING },
    overlay: 15,
  },
};

/** Paleta de categorias (cores distinguíveis, validadas para daltonismo na ordem dada). */
export const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

export const EVENT_COLORS = ['#2a78d6', '#1baf7a', '#eb6834', '#6250d6', '#e87ba4', '#eda100'];

const seed: [string, Category['type'], string][] = [
  ['Salário', 'income', CATEGORY_COLORS[0]],
  ['Freelance', 'income', CATEGORY_COLORS[2]],
  ['Outros rendimentos', 'income', CATEGORY_COLORS[6]],
  ['Moradia', 'expense', CATEGORY_COLORS[0]],
  ['Alimentação', 'expense', CATEGORY_COLORS[1]],
  ['Transporte', 'expense', CATEGORY_COLORS[2]],
  ['Saúde', 'expense', CATEGORY_COLORS[3]],
  ['Lazer', 'expense', CATEGORY_COLORS[4]],
  ['Contas e serviços', 'expense', CATEGORY_COLORS[6]],
  ['Educação', 'expense', CATEGORY_COLORS[5]],
];

export function defaultCategories(now: string, makeId: () => string): Category[] {
  return seed.map(([name, type, color]) => ({ id: makeId(), name, type, color, createdAt: now }));
}

/** Mescla configurações salvas com os padrões (para tolerar versões antigas). */
export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  const s = saved ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    background: {
      ...DEFAULT_SETTINGS.background,
      ...(s.background ?? {}),
      imageFraming: { ...DEFAULT_FRAMING, ...(s.background?.imageFraming ?? {}) },
      carouselFraming: { ...DEFAULT_FRAMING, ...(s.background?.carouselFraming ?? {}) },
      videoFraming: { ...DEFAULT_FRAMING, ...(s.background?.videoFraming ?? {}) },
    },
  };
}
