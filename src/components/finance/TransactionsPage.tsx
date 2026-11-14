import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Wallet } from 'lucide-react';
import { useData } from '../../store/DataProvider';
import { GlassCard, PageHeader, EmptyState } from '../ui/Glass';
import { Button } from '../ui/Button';
import { TransactionForm } from './TransactionForm';
import { TransactionList } from './TransactionList';
import { HorizontalBars } from '../charts/charts';
import { filterTransactions, sortByDateDesc, totalsByCategory } from '../../lib/finance';
import { formatMoney } from '../../lib/money';
import { addMonths, formatMonth } from '../../lib/dates';
import type { Transaction, TxType } from '../../lib/types';

/** Página reutilizada por "Entradas" e "Despesas". */
export function TransactionsPage({ type }: { type: TxType }) {
  const { transactions, categories, settings, today, categoryById } = useData();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; editing: Transaction | null }>({ open: false, editing: null });
  const fmt = (c: number) => formatMoney(c, settings.primaryCurrency);
  const isIncome = type === 'income';

  const monthItems = useMemo(
    () => filterTransactions(transactions, { type, from: `${month}-01`, to: `${month}-31` }),
    [transactions, type, month],
  );
  const items = useMemo(() => sortByDateDesc(filterTransactions(monthItems, { categoryId, search })), [monthItems, categoryId, search]);
  const total = items.reduce((s, t) => s + t.amount, 0);
  const byCat = useMemo(() => totalsByCategory(monthItems, type), [monthItems, type]);
  const cats = categories.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name));
  const shift = (n: number) => setMonth(addMonths(`${month}-01`, n).slice(0, 7));

  return (
    <div className="page">
      <PageHeader
        title={isIncome ? 'Entradas' : 'Despesas'}
        subtitle={isIncome ? 'Dinheiro que entrou na sua conta — aumenta o saldo.' : 'Dinheiro que saiu da sua conta — diminui o saldo.'}
        actions={
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setForm({ open: true, editing: null })}>
            {isIncome ? 'Nova entrada' : 'Nova despesa'}
          </Button>
        }
      />

      <div className="toolbar glass">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="month-nav__label" aria-live="polite">
            {formatMonth(month)}
          </span>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
            <ChevronRight size={18} />
          </button>
          {month !== today.slice(0, 7) && (
            <button className="link-btn" onClick={() => setMonth(today.slice(0, 7))}>
              Mês atual
            </button>
          )}
        </div>
        <div className="toolbar__filters">
          <label className="sr-only" htmlFor="cat-filter">
            Filtrar por categoria
          </label>
          <select id="cat-filter" className="input input--sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">Todas as categorias</option>
            <option value="none">Sem categoria</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="search-input">
            <Search size={16} aria-hidden />
            <label className="sr-only" htmlFor="tx-search">
              Buscar
            </label>
            <input id="tx-search" className="input input--sm" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="split-grid">
        <GlassCard title={`${items.length} lançamento${items.length === 1 ? '' : 's'}`} actions={<strong className="total-pill">Total: {fmt(total)}</strong>}>
          {items.length === 0 ? (
            <EmptyState
              icon={<Wallet size={28} />}
              title={monthItems.length ? 'Nenhum resultado para os filtros' : `Nenhuma ${isIncome ? 'entrada' : 'despesa'} em ${formatMonth(month)}`}
              action={
                <Button size="sm" variant="primary" onClick={() => setForm({ open: true, editing: null })}>
                  Registrar agora
                </Button>
              }
            />
          ) : (
            <TransactionList items={items} onEdit={(t) => setForm({ open: true, editing: t })} />
          )}
        </GlassCard>
        <GlassCard title="Por categoria">
          {byCat.length === 0 ? (
            <p className="muted">Sem dados neste mês.</p>
          ) : (
            <HorizontalBars
              caption={`${isIncome ? 'Entradas' : 'Despesas'} por categoria`}
              format={fmt}
              rows={byCat.map((c) => {
                const cat = categoryById(c.categoryId);
                return { id: c.categoryId ?? 'none', label: cat?.name ?? 'Sem categoria', color: cat?.color, value: c.total };
              })}
            />
          )}
        </GlassCard>
      </div>

      <TransactionForm open={form.open} editing={form.editing} defaultType={type} lockType onClose={() => setForm({ open: false, editing: null })} />
    </div>
  );
}
