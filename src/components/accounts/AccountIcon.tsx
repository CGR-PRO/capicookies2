import { Banknote, Briefcase, Car, Coins, CreditCard, Gift, Home, Landmark, PiggyBank, Plane, Shield, Wallet, type LucideIcon } from 'lucide-react';
import type { AccountIconName } from '../../lib/accounts';
import type { Account } from '../../lib/types';

export const ICON_COMPONENTS: Record<AccountIconName, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  'piggy-bank': PiggyBank,
  banknote: Banknote,
  'credit-card': CreditCard,
  shield: Shield,
  coins: Coins,
  briefcase: Briefcase,
  home: Home,
  plane: Plane,
  gift: Gift,
  car: Car,
};

export const ICON_LABELS: Record<AccountIconName, string> = {
  wallet: 'Carteira',
  landmark: 'Banco',
  'piggy-bank': 'Cofrinho',
  banknote: 'Dinheiro',
  'credit-card': 'Cartão',
  shield: 'Reserva',
  coins: 'Moedas',
  briefcase: 'Trabalho',
  home: 'Casa',
  plane: 'Viagem',
  gift: 'Presente',
  car: 'Carro',
};

/** Selo redondo com o ícone e a cor da conta. */
export function AccountIcon({ account, size = 36 }: { account: Pick<Account, 'icon' | 'color'>; size?: number }) {
  const Icon = ICON_COMPONENTS[account.icon as AccountIconName] ?? Wallet;
  return (
    <span className="acc-icon" style={{ width: size, height: size, ['--acc-color' as string]: account.color }} aria-hidden>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}
