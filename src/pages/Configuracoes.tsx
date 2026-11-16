import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Database, Download, Image, Lock, Palette, Tags, Upload, Wallet } from 'lucide-react';
import { useData, type BackupFile } from '../store/DataProvider';
import { useToast } from '../store/ToastProvider';
import { useAuth } from '../auth/AuthProvider';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { GlassCard, PageHeader, Segmented } from '../components/ui/Glass';
import { Button } from '../components/ui/Button';
import { Field, FormRow } from '../components/ui/Field';
import { Toggle } from '../components/ui/Toggle';
import { CategoryManager } from '../components/finance/CategoryManager';
import { BackgroundSettings } from '../components/settings/BackgroundSettings';
import { CURRENCIES } from '../lib/currency';
import { formatMoney } from '../lib/money';
import { MoneyInput } from '../components/ui/MoneyInput';
import { isValidTimeZone, listTimeZones, timeInTz } from '../lib/dates';
import type { ThemePref } from '../lib/types';

function AccountSettings() {
  const { settings, updateSettings, primaryAccount, saveAccount, accounts } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [initial, setInitial] = useState<number | null>(primaryAccount.initialBalance);
  const [primary, setPrimary] = useState(settings.primaryCurrency);
  const [secondary, setSecondary] = useState(settings.secondaryCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = initial ?? 0;
    if (primary === secondary) {
      setError('As moedas principal e secundária devem ser diferentes.');
      return;
    }
    setError(null);
    if (primary !== settings.primaryCurrency) {
      const ok = await confirm({
        title: 'Alterar moeda principal?',
        message: `Os lançamentos continuam na moeda de cada conta. O total consolidado e os indicadores de “Todas as contas” passarão a ser exibidos em ${primary}, convertidos pela cotação mais recente.`,
        confirmLabel: 'Alterar',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      if (cents !== primaryAccount.initialBalance) await saveAccount({ ...primaryAccount, initialBalance: cents });
      await updateSettings({ primaryCurrency: primary, secondaryCurrency: secondary });
      toast.success('Conta atualizada. Saldo recalculado.');
    } catch {
      toast.error('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label={`Saldo inicial — ${primaryAccount.name} (${primaryAccount.currency})`} error={error} hint={`Atual: ${formatMoney(primaryAccount.initialBalance, primaryAccount.currency)}. Digite apenas números; use “-” para saldo negativo. Saldo da conta = saldo inicial + entradas − despesas ± transferências.`}>
        <MoneyInput currency={primaryAccount.currency} value={initial} onChange={setInitial} allowNegative />
      </Field>
      <p className="field__hint">
        {accounts.length > 1 ? `Você tem ${accounts.length} contas. ` : ''}
        <Link to="/contas" className="link-btn">Gerenciar contas</Link>
      </p>
      <FormRow>
        <Field label="Moeda principal (consolidação)">
          <select className="input" value={primary} onChange={(e) => setPrimary(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moeda secundária">
          <select className="input" value={secondary} onChange={(e) => setSecondary(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
      </FormRow>
      <div>
        <Button type="submit" variant="primary" loading={saving}>
          Salvar conta
        </Button>
      </div>
    </form>
  );
}

function AgendaSettings() {
  const { settings, updateSettings } = useData();
  const toast = useToast();
  const zones = listTimeZones();
  const notifSupported = typeof window !== 'undefined' && 'Notification' in window;

  const setNotifications = async (on: boolean) => {
    if (on && notifSupported) {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.error('Permissão de notificação negada pelo navegador. Os lembretes aparecerão apenas dentro do app.');
        return;
      }
    }
    await updateSettings({ notificationsEnabled: on });
    toast.success(on ? 'Notificações ativadas.' : 'Notificações desativadas.');
  };

  return (
    <div className="form">
      <Field label="Fuso horário" hint={`Agora: ${timeInTz(new Date(), settings.timezone)} em ${settings.timezone}`}>
        <select
          className="input"
          value={settings.timezone}
          onChange={async (e) => {
            if (!isValidTimeZone(e.target.value)) return;
            await updateSettings({ timezone: e.target.value });
            toast.success('Fuso horário atualizado.');
          }}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Field>
      <Toggle
        checked={settings.notificationsEnabled}
        onChange={setNotifications}
        disabled={!notifSupported}
        label="Notificações do sistema"
        description={notifSupported ? 'Lembretes também aparecem fora do app enquanto ele estiver aberto.' : 'Seu navegador não suporta notificações.'}
      />
    </div>
  );
}

function SecuritySettings() {
  const { isProtected, setPin, lock } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin !== confirmPin) {
      setError('Os PINs não coincidem.');
      return;
    }
    try {
      await setPin(pin, current);
      toast.success(isProtected ? 'PIN alterado.' : 'PIN ativado. O app pedirá o PIN ao ser aberto.');
      setCurrent('');
      setPinValue('');
      setConfirmPin('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removePin = async () => {
    try {
      await setPin(null, current);
      toast.success('PIN removido.');
      setCurrent('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8);

  return (
    <form className="form" onSubmit={submit} noValidate>
      <p className="muted small">
        Proteja o acesso neste dispositivo com um PIN. Os dados ficam armazenados apenas no seu navegador (IndexedDB), nunca no código-fonte. A arquitetura está preparada para login e sincronização entre dispositivos.
      </p>
      {isProtected && (
        <Field label="PIN atual">
          <input className="input" type="password" inputMode="numeric" autoComplete="current-password" value={current} onChange={(e) => setCurrent(digits(e.target.value))} />
        </Field>
      )}
      <FormRow>
        <Field label={isProtected ? 'Novo PIN' : 'PIN (4 a 8 dígitos)'}>
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPinValue(digits(e.target.value))} />
        </Field>
        <Field label="Confirmar PIN">
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin} onChange={(e) => setConfirmPin(digits(e.target.value))} />
        </Field>
      </FormRow>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="row gap wrap">
        <Button type="submit" variant="primary" disabled={pin.length < 4}>
          {isProtected ? 'Alterar PIN' : 'Ativar PIN'}
        </Button>
        {isProtected && (
          <>
            <Button variant="ghost" onClick={removePin} disabled={!current}>
              Remover PIN
            </Button>
            <Button icon={<Lock size={16} />} onClick={lock}>
              Bloquear agora
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

function DataSettings() {
  const { exportBackup, importBackup, resetAll, transactions, events, recurring } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-agenda-financas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success('Backup exportado.');
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as BackupFile;
      const ok = await confirm({
        title: 'Restaurar backup?',
        message: `Os dados atuais serão substituídos por ${data.transactions?.length ?? 0} lançamento(s), ${data.recurring?.length ?? 0} gasto(s) fixo(s) e ${data.events?.length ?? 0} evento(s).`,
        confirmLabel: 'Restaurar',
        danger: true,
      });
      if (!ok) return;
      setBusy(true);
      await importBackup(data);
      toast.success('Backup restaurado.');
    } catch (e) {
      toast.error((e as Error).message.includes('JSON') ? 'Arquivo inválido.' : (e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doReset = async () => {
    const ok = await confirm({
      title: 'Apagar todos os dados?',
      message: 'Lançamentos, gastos fixos, eventos, categorias, fundos e configurações serão apagados deste dispositivo. Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    await resetAll();
    toast.success('Dados apagados.');
  };

  return (
    <div className="form">
      <p className="muted small">
        {transactions.length} lançamento(s) · {recurring.length} gasto(s) fixo(s) · {events.length} evento(s). Use o backup para levar seus dados a outro dispositivo.
      </p>
      <div className="row gap wrap">
        <Button icon={<Download size={16} />} onClick={doExport}>
          Exportar backup
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()} loading={busy}>
          Restaurar backup
        </Button>
        <Button variant="danger" onClick={doReset}>
          Apagar todos os dados
        </Button>
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const { settings, updateSettings, primaryAccount } = useData();
  return (
    <div className="page">
      <PageHeader title="Configurações" subtitle="Personalize a aparência, a conta financeira e a agenda." />
      <div className="settings-grid">
        <GlassCard className="span-full" title="Fundo do dashboard" icon={<Image size={18} />}>
          <BackgroundSettings />
        </GlassCard>

        <GlassCard title="Aparência" icon={<Palette size={18} />}>
          <div className="form">
            <div className="field">
              <span className="field__label">Tema</span>
              <Segmented<ThemePref>
                label="Tema"
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
                options={[
                  { value: 'light', label: 'Claro' },
                  { value: 'dark', label: 'Escuro' },
                  { value: 'system', label: 'Sistema' },
                ]}
              />
            </div>
            <Toggle checked={settings.sidebarCollapsed} onChange={(v) => updateSettings({ sidebarCollapsed: v })} label="Barra lateral recolhida" description="Mostra apenas os ícones no desktop." />
          </div>
        </GlassCard>

        <GlassCard title="Conta financeira" icon={<Wallet size={18} />}>
          <AccountSettings key={`${primaryAccount.initialBalance}|${settings.primaryCurrency}|${settings.secondaryCurrency}`} />
        </GlassCard>

        <GlassCard title="Agenda e lembretes" icon={<Bell size={18} />}>
          <AgendaSettings />
        </GlassCard>

        <GlassCard title="Segurança" icon={<Lock size={18} />}>
          <SecuritySettings />
        </GlassCard>

        <GlassCard title="Categorias financeiras" icon={<Tags size={18} />}>
          <CategoryManager />
        </GlassCard>

        <GlassCard title="Dados e backup" icon={<Database size={18} />}>
          <DataSettings />
        </GlassCard>
      </div>
    </div>
  );
}
