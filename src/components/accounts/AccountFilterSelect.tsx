import { useData } from '../../store/DataProvider';
import type { AccountFilter } from '../../store/useFinance';

/** Filtro “Todas as contas” ou uma conta específica (inclui arquivadas, para consulta). */
export function AccountFilterSelect({ value, onChange, className = 'input input--sm' }: { value: AccountFilter; onChange(v: AccountFilter): void; className?: string }) {
  const { accounts, activeAccounts, settings } = useData();
  const archived = accounts.filter((a) => a.archived);
  if (accounts.length < 2) return null;
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filtrar por conta">
      <option value="all">Todas as contas ({settings.primaryCurrency})</option>
      {activeAccounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency})
        </option>
      ))}
      {archived.length > 0 && (
        <optgroup label="Arquivadas">
          {archived.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
