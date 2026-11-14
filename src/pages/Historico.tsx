import { useMemo, useState } from 'react';
import { Download, History, Search } from 'lucide-react';
import { useData } from '../store/DataProvider';
import { GlassCard, PageHeader, EmptyState, Segmented } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { TransactionForm } from '../components/finance/TransactionForm';
import { TransactionList } from '../components/finance/TransactionList';
import { GroupedColumns } from '../components/charts/charts';
import { computeBalance, filterTransactions, sortByDateDesc } from '../lib/finance';
import { formatMoney } from '../lib/money';
import { addDays, addMonths, formatDate, formatMonth, isValidDateStr, monthShort } from '../lib/dates';
import type { Transaction, TxType } from '../lib/types';

type Preset = 'month' | 'last3' | 'year' | 'all' | 'custom';

export default function Historico() {
  const { transactions, categories, settings, today, categoryById } = useData();
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [type, setType] = useState<TxType | 'all'>('all');
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const fmt = (c: number) => formatMoney(c, settings.primaryCurrency);

  const range = useMemo(() => {
    switch (preset) {
      case 'month':
        return { from: `${today.slice(0, 7)}-01`, to: addDays(addMonths(`${today.slice(0, 7)}-01`, 1), -1) };
      case 'last3':
        return { from: addMonths(`${today.slice(0, 7)}-01`, -2), to: addDays(addMonths(`${today.slice(0, 7)}-01`, 1), -1) };
      case 'year':
        return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
      case 'all':
        return { from: undefined, to: undefined };
      default:
        return { from: isValidDateStr(from) ? from : undefined, to: isValidDateStr(to) ? to : undefined };
    }
  }, [preset, from, to, today]);

  const items = useMemo(
    () => sortByDateDesc(filterTransactions(transactions, { ...range, type, categoryId, search })),
    [transactions, range, type, categoryId, search],
  );
  const income = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const openingBalance = range.from ? computeBalance(settings.initialBalance, transactions, addDays(range.from, -1)) : settings.initialBalance;
  const closingBalance = range.to ? computeBalance(settings.initialBalance, transactions, range.to) : computeBalance(settings.initialBalance, transactions);

  const monthly = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of items) {
      const k = t.date.slice(0, 7);
      const e = map.get(k) ?? { income: 0, expense: 0 };
      if (t.type === 'income') e.income += t.amount;
      else e.expense += t.amount;
      map.set(k, e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [items]);

  const exportCsv = () => {
    const header = ['Data', 'Tipo', 'Descrição', 'Categoria', `Valor (${settings.primaryCurrency})`, 'Observações'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = items.map((t) =>
      [t.date, t.type === 'income' ? 'Entrada' : 'Despesa', t.description, categoryById(t.categoryId)?.name ?? '', ((t.type === 'income' ? 1 : -1) * t.amount / 100).toFixed(2).replace('.', ','), t.notes ?? '']
        .map((v) => esc(String(v)))
        .join(';'),
    );
    const blob = new Blob(['﻿' + [header.map(esc).join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historico-${range.from ?? 'inicio'}-${range.to ?? 'hoje'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const cats = categories.filter((c) => type === 'all' || c.type === type).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <PageHeader
        title="Histórico Financeiro"
        subtitle="Consulte movimentações por período e categoria."
        actions={
          <Button icon={<Download size={18} />} onClick={exportCsv} disabled={!items.length}>
            Exportar CSV
          </Button>
        }
      />

      <div className="toolbar glass toolbar--wrap">
        <Segmented
          size="sm"
          label="Período"
          value={preset}
          onChange={setPreset}
          options={[
            { value: 'month', label: 'Este mês' },
            { value: 'last3', label: '3 meses' },
            { value: 'year', label: 'Este ano' },
            { value: 'all', label: 'Tudo' },
            { value: 'custom', label: 'Personalizado' },
          ]}
        />
        {preset === 'custom' && (
          <div className="date-range">
            <label>
              <span className="sr-only">Data inicial</span>
              <input className="input input--sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
            </label>
            <span className="muted">até</span>
            <label>
              <span className="sr-only">Data final</span>
              <input className="input input--sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
            </label>
          </div>
        )}
        <div className="toolbar__filters">
          <select className="input input--sm" value={type} onChange={(e) => { setType(e.target.value as TxType | 'all'); setCategoryId('all'); }} aria-label="Tipo">
            <option value="all">Entradas e despesas</option>
            <option value="income">Somente entradas</option>
            <option value="expense">Somente despesas</option>
          </select>
          <select className="input input--sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoria">
            <option value="all">Todas as categorias</option>
            <option value="none">Sem categoria</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'income' ? 'entrada' : 'despesa'})
              </option>
            ))}
          </select>
          <div className="search-input">
            <Search size={16} aria-hidden />
            <input className="input input--sm" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
          </div>
        </div>
      </div>

      <div className="stats-row">
        <GlassCard className="stat-card" title="Saldo no início">
          <p className="stat-value">{fmt(openingBalance)}</p>
          <p className="muted small">{range.from ? formatDate(addDays(range.from, -1)) : 'saldo inicial'}</p>
        </GlassCard>
        <GlassCard className="stat-card" title="Entradas">
          <p className="stat-value">+ {fmt(income)}</p>
        </GlassCard>
        <GlassCard className="stat-card" title="Despesas">
          <p className="stat-value">− {fmt(expense)}</p>
        </GlassCard>
        <GlassCard className="stat-card" title="Saldo no fim">
          <p className="stat-value">{fmt(closingBalance)}</p>
          <p className="muted small">{range.to ? formatDate(range.to) : 'hoje'}</p>
        </GlassCard>
      </div>
      {(categoryId !== 'all' || type !== 'all' || search) && <p className="muted small">Saldos de início e fim consideram todos os lançamentos; os totais seguem os filtros.</p>}

      {monthly.length > 1 && (
        <GlassCard title="Resumo mensal do período">
          <GroupedColumns
            caption="Entradas e despesas por mês no período filtrado"
            series={[
              { name: 'Entradas', color: 'var(--series-1)' },
              { name: 'Despesas', color: 'var(--series-2)' },
            ]}
            data={monthly.map(([k, v]) => ({ label: `${monthShort(Number(k.slice(5)))}/${k.slice(2, 4)}`, fullLabel: formatMonth(k), values: [v.income, v.expense] }))}
            format={fmt}
          />
        </GlassCard>
      )}

      <GlassCard title={`${items.length} lançamento${items.length === 1 ? '' : 's'}`}>
        {items.length === 0 ? (
          <EmptyState icon={<History size={28} />} title="Nenhum lançamento encontrado">
            Ajuste o período ou os filtros.
          </EmptyState>
        ) : (
          <TransactionList items={items} onEdit={setEditing} />
        )}
      </GlassCard>

      <TransactionForm open={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
