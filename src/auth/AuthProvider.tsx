import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useData } from '../store/DataProvider';
import { Button } from '../components/ui/Button';

/**
 * Autenticação.
 *
 * Implementação atual: bloqueio local por PIN (derivado com PBKDF2/SHA-256 via WebCrypto;
 * o PIN em si nunca é armazenado). Protege o acesso ao aplicativo neste dispositivo.
 *
 * Preparado para expansão: para uso em vários dispositivos, implemente `AuthService`
 * com um provedor remoto (OAuth/e-mail) e troque `localPinService` — o restante da
 * aplicação consome apenas `useAuth()`.
 */
export interface AuthService {
  isProtected(): Promise<boolean>;
  verify(secret: string): Promise<boolean>;
  setSecret(secret: string | null): Promise<void>;
}

interface StoredPin {
  salt: string;
  hash: string;
  iterations: number;
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return toB64(bits);
}

function useLocalPinService(): AuthService {
  const { store } = useData();
  return {
    async isProtected() {
      return !!(await store.getKV<StoredPin>('auth.pin'));
    },
    async verify(pin) {
      const rec = await store.getKV<StoredPin>('auth.pin');
      if (!rec) return true;
      return (await derive(pin, fromB64(rec.salt), rec.iterations)) === rec.hash;
    },
    async setSecret(pin) {
      if (!pin) {
        await store.setKV('auth.pin', undefined);
        return;
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iterations = 150_000;
      await store.setKV<StoredPin>('auth.pin', { salt: toB64(salt), hash: await derive(pin, salt, iterations), iterations });
    },
  };
}

interface AuthApi {
  isProtected: boolean;
  setPin(pin: string | null, currentPin?: string): Promise<void>;
  lock(): void;
}

const AuthContext = createContext<AuthApi | null>(null);
const SESSION_KEY = 'af.unlocked';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready } = useData();
  const service = useLocalPinService();
  const [checked, setChecked] = useState(false);
  const [isProtected, setIsProtected] = useState(false);
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!ready) return;
    service.isProtected().then((p) => {
      setIsProtected(p);
      setChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const markUnlocked = (v: boolean) => {
    setUnlocked(v);
    try {
      if (v) sessionStorage.setItem(SESSION_KEY, '1');
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignora */
    }
  };

  const setPin = useCallback(
    async (pin: string | null, currentPin?: string) => {
      if (isProtected && !(await service.verify(currentPin ?? ''))) throw new Error('PIN atual incorreto.');
      if (pin !== null && !/^\d{4,8}$/.test(pin)) throw new Error('O PIN deve ter de 4 a 8 dígitos.');
      await service.setSecret(pin);
      setIsProtected(pin !== null);
      markUnlocked(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isProtected],
  );

  const api: AuthApi = { isProtected, setPin, lock: () => markUnlocked(false) };

  if (!ready || !checked) return null;
  if (isProtected && !unlocked) return <LockScreen verify={service.verify} onUnlock={() => markUnlocked(true)} />;
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

function LockScreen({ verify, onUnlock }: { verify: (pin: string) => Promise<boolean>; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await verify(pin);
    setBusy(false);
    if (ok) onUnlock();
    else {
      setError('PIN incorreto. Tente novamente.');
      setPin('');
    }
  };

  return (
    <div className="lock-screen">
      <form className="glass lock-card" onSubmit={submit}>
        <div className="lock-card__icon" aria-hidden>
          <Lock size={26} />
        </div>
        <h1>Agenda & Finanças</h1>
        <p className="muted">Digite seu PIN para continuar</p>
        <label className="sr-only" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          className="input input--pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!!error}
          aria-describedby={error ? 'pin-error' : undefined}
        />
        {error && (
          <p id="pin-error" className="field__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} disabled={pin.length < 4} block>
          Desbloquear
        </Button>
      </form>
    </div>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
