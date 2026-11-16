import { useData } from '../../store/DataProvider';
import type { SelectHTMLAttributes } from 'react';

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: string;
  onChange(id: string): void;
  /** Conta já usada no registro em edição: continua disponível mesmo se arquivada. */
  keepId?: string;
  /** Exclui uma conta da lista (ex.: a origem de uma transferência). */
  excludeId?: string;
}

/** Seletor de conta (somente contas ativas, mais a conta atual do registro). */
export function AccountSelect({ value, onChange, keepId, excludeId, className = 'input', ...rest }: Props) {
  const { accounts, activeAccounts } = useData();
  const kept = keepId ? accounts.find((a) => a.id === keepId && a.archived) : undefined;
  const list = [...activeAccounts, ...(kept ? [kept] : [])].filter((a) => a.id !== excludeId);
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {list.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency}){a.archived ? ' — arquivada' : ''}
        </option>
      ))}
    </select>
  );
}
