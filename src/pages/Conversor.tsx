import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, RefreshCw, Wallet } from 'lucide-react';
import { useData } from '../store/DataProvider';
import { useRates } from '../store/RatesProvider';
import { GlassCard, PageHeader } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { CURRENCIES, convertCents, currencyName, fetchRate, type RateQuote } from '../lib/currency';
import { computeBalance } from '../lib/finance';
import { formatMoney, parseMoney } from '../lib/money';
import { formatDateTime } from '../lib/dates';

export default function Conversor() {
  const { settings, transactions, updateSettings } = useData();
  const { quote: mainQuote, loading: mainLoading, error: mainError, refresh } = useRates();
  const tz = settings.timezone;
  const [from, setFrom] = useState(settings.primaryCurrency);
  const [to, setTo] = useState(settings.secondaryCurrency);
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  const load = async () => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const q = await fetchRate(from, to);
      if (id === req.current) setQuote(q);
    } catch (e) {
      if (id === req.current) {
        setQuote(null);
        setError((e as Error).message);
      }
    } finally {
      if (id === req.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const cents = parseMoney(amount);
  const balance = computeBalance(settings.initialBalance, transactions);
  const balanceQuoteOk = mainQuote && mainQuote.base === settings.primaryCurrency && mainQuote.target === settings.secondaryCurrency;

  return (
    <div className="page">
      <PageHeader title="Conversor de Moedas" subtitle="Cotações atuais consultadas em serviço externo. Nenhum histórico é armazenado." />

      <div className="split-grid">
        <GlassCard title="Converter valor" icon={<ArrowLeftRight size={18} />}>
          <div className="converter">
            <Field label="Valor" error={amount && cents === null ? 'Valor inválido.' : null}>
              <input className="input input--money input--lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="converter__pair">
              <Field label="De">
                <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                className="btn btn--glass btn--icon btn--md converter__swap"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
                aria-label="Inverter moedas"
              >
                <ArrowLeftRight size={18} />
              </button>
              <Field label="Para">
                <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="converter__result" aria-live="polite">
              {loading && (
                <span className="inline-flex muted">
                  <Spinner size={16} /> Consultando cotação…
                </span>
              )}
              {!loading && error && (
                <div className="alert alert--warning" role="alert">
                  <AlertTriangle size={18} aria-hidden />
                  <span>A cotação não pôde ser atualizada. Tente novamente em instantes.</span>
                </div>
              )}
              {!loading && quote && cents !== null && (
                <>
                  <p className="converter__value">{formatMoney(convertCents(cents, quote.rate), to)}</p>
                  <p className="muted small">
                    {formatMoney(cents, from)} · 1 {from} = {quote.rate.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {to}
                  </p>
                  <p className="muted small">
                    Cotação de {formatDateTime(quote.quotedAt, tz)} · consultada às {formatDateTime(quote.fetchedAt, tz)} · fonte: {quote.provider}
                  </p>
                </>
              )}
            </div>
            <div className="row gap">
              <Button icon={<RefreshCw size={16} />} onClick={load} loading={loading}>
                Atualizar cotação
              </Button>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Saldo convertido" icon={<Wallet size={18} />}>
          <p className="muted small">Saldo da conta principal ({currencyName(settings.primaryCurrency)})</p>
          <p className="stat-value">{formatMoney(balance, settings.primaryCurrency)}</p>
          <hr className="divider" />
          <p className="muted small">Equivalente em {currencyName(settings.secondaryCurrency)}</p>
          {mainLoading && !balanceQuoteOk ? (
            <Spinner size={18} label="Carregando" />
          ) : balanceQuoteOk && mainQuote ? (
            <>
              <p className="stat-value">{formatMoney(convertCents(balance, mainQuote.rate), settings.secondaryCurrency)}</p>
              <p className="muted small">Cotação de {formatDateTime(mainQuote.quotedAt, tz)}</p>
            </>
          ) : (
            <p className="status-text status-text--warning">
              <AlertTriangle size={14} aria-hidden /> Cotação indisponível no momento.
            </p>
          )}
          {mainError && balanceQuoteOk && <p className="status-text status-text--warning small">Não foi possível atualizar; exibindo a última cotação desta sessão.</p>}
          <p className="field__hint">O valor convertido é apenas informativo — não existe uma segunda conta.</p>
          <div className="row gap wrap">
            <Button size="sm" icon={<RefreshCw size={14} />} onClick={refresh} loading={mainLoading}>
              Atualizar
            </Button>
            {(from !== settings.primaryCurrency || to !== settings.secondaryCurrency) && from !== to && (
              <Button size="sm" variant="ghost" onClick={() => updateSettings({ primaryCurrency: from, secondaryCurrency: to })}>
                Usar {from}/{to} como moedas padrão
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
