import { AlertTriangle, ArrowLeftRight, Landmark, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../../store/DataProvider';
import { useFinance, type AccountFilter } from '../../store/useFinance';
import { useRates } from '../../store/RatesProvider';
import { GlassCard } from '../ui/Glass';
import { Button } from '../ui/Button';
import { AnimatedMoney } from '../ui/AnimatedMoney';
import { AccountIcon } from './AccountIcon';
import { describeQuoteTime } from '../../lib/currency';
import { formatMoney } from '../../lib/money';

interface Props {
  selected: AccountFilter;
  onSelect(f: AccountFilter): void;
  onNewAccount(): void;
  onTransfer(): void;
}

/**
 * “Minhas Contas”: saldo de cada conta, da principal, das secundárias e o total consolidado.
 * Contas em outras moedas são convertidas pela cotação mais recente (data exibida).
 */
export function AccountsOverview({ selected, onSelect, onNewAccount, onTransfer }: Props) {
  const { activeAccounts, accounts, primaryAccount, settings, today } = useData();
  const { balances, toPrimary, consolidated, usedQuotes } = useFinance();
  const { accountQuoteErrors } = useRates();
  const cur = settings.primaryCurrency;

  const secondaries = accounts.filter((a) => !a.isPrimary);
  let secTotal = 0;
  let secMissing = false;
  for (const a of secondaries) {
    const v = toPrimary(balances.get(a.id) ?? 0, a.currency);
    if (v === null) secMissing = true;
    else secTotal += v;
  }
  const primaryBal = balances.get(primaryAccount.id) ?? 0;
  const archivedWithMoney = accounts.filter((a) => a.archived && (balances.get(a.id) ?? 0) !== 0);

  return (
    <GlassCard
      className="span-full accounts-card"
      title="Minhas Contas"
      icon={<Landmark size={18} />}
      actions={
        <>
          <Button size="sm" variant="glass" icon={<ArrowLeftRight size={15} />} onClick={onTransfer} disabled={activeAccounts.length < 2} title={activeAccounts.length < 2 ? 'Crie uma segunda conta para transferir' : undefined}>
            Transferir
          </Button>
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={onNewAccount}>
            Nova conta
          </Button>
        </>
      }
    >
      <div className="acc-totals">
        <div className="acc-total">
          <span className="acc-total__label">Conta principal</span>
          <AnimatedMoney className="acc-total__value" cents={primaryBal} currency={primaryAccount.currency} />
        </div>
        <div className="acc-total">
          <span className="acc-total__label">Contas secundárias ({secondaries.length})</span>
          <AnimatedMoney className="acc-total__value" cents={secTotal} currency={cur} />
          {secMissing && <span className="muted small">sem cotação para parte das contas</span>}
        </div>
        <div className="acc-total acc-total--main">
          <span className="acc-total__label">Saldo total consolidado</span>
          <AnimatedMoney className="acc-total__value" cents={consolidated.total} currency={cur} />
        </div>
      </div>

      <ul className="acc-tiles" aria-label="Contas">
        <li>
          <button className={`acc-tile acc-tile--all${selected === 'all' ? ' is-selected' : ''}`} onClick={() => onSelect('all')} aria-pressed={selected === 'all'}>
            <span className="acc-tile__name">Todas as contas</span>
            <span className="acc-tile__value">{formatMoney(consolidated.total, cur)}</span>
            <span className="muted small">consolidado em {cur}</span>
          </button>
        </li>
        {activeAccounts.map((a) => {
          const bal = balances.get(a.id) ?? 0;
          const conv = a.currency !== cur ? toPrimary(bal, a.currency) : null;
          return (
            <li key={a.id}>
              <button
                className={`acc-tile${selected === a.id ? ' is-selected' : ''}`}
                style={{ ['--acc-color' as string]: a.color }}
                onClick={() => onSelect(a.id)}
                aria-pressed={selected === a.id}
              >
                <span className="acc-tile__head">
                  <AccountIcon account={a} size={30} />
                  <span className="acc-tile__name">{a.name}</span>
                </span>
                <AnimatedMoney className={`acc-tile__value${bal < 0 ? ' is-negative' : ''}`} cents={bal} currency={a.currency} />
                <span className="muted small">
                  {a.isPrimary ? 'Principal' : 'Secundária'}
                  {a.currency !== cur && (conv !== null ? ` · ≈ ${formatMoney(conv, cur)}` : ' · sem cotação')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {(usedQuotes.length > 0 || accountQuoteErrors.length > 0 || archivedWithMoney.length > 0) && (
        <div className="acc-notes">
          {usedQuotes.map((q) => (
            <span key={q.base} className="muted small">
              1 {q.base} = {q.rate.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {q.target} · {describeQuoteTime(q, settings.timezone, today).label}
            </span>
          ))}
          {accountQuoteErrors.length > 0 && (
            <span className="status-text status-text--warning" role="status">
              <AlertTriangle size={14} aria-hidden /> Sem cotação para {accountQuoteErrors.join(', ')}: essas contas não entram no total consolidado até a consulta funcionar.
            </span>
          )}
          {archivedWithMoney.length > 0 && (
            <span className="muted small">
              O total inclui {archivedWithMoney.length} conta(s) arquivada(s) com saldo. <Link to="/contas" className="link-btn">Ver contas</Link>
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}
