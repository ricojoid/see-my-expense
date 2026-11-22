import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  LOCK_AFTER_OPTIONS,
  biometricAvailable,
  disableBiometric,
  enableBiometric,
  getLock,
  isValidPin,
  removeLock,
  setLockAfter,
  setPin,
  verifyPin,
} from '../../lib/appLock';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import ToggleRow from '../../components/ui/ToggleRow';

function PinForm({ submitLabel, askCurrent, onDone, onCancel }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', pin: '', confirm: '' });
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '').slice(0, 6) }));

  const submit = async (e) => {
    e.preventDefault();
    if (askCurrent && !(await verifyPin(user.id, form.current))) return setError('Current PIN is wrong');
    if (!isValidPin(form.pin)) return setError('Use 4 to 6 digits');
    if (form.pin !== form.confirm) return setError("The PINs don't match");
    await setPin(user.id, form.pin);
    onDone();
  };

  const field = (key, label, autoFocus) => (
    <div>
      <label className="label" htmlFor={`pin-${key}`}>
        {label}
      </label>
      <input
        id={`pin-${key}`}
        className="field tracking-[0.5em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={form[key]}
        onChange={set(key)}
        autoFocus={autoFocus}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="max-w-xs space-y-3">
      {askCurrent && field('current', 'Current PIN', true)}
      {field('pin', 'New PIN (4-6 digits)', !askCurrent)}
      {field('confirm', 'Repeat new PIN')}
      {error && (
        <p className="text-sm text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** PIN, fingerprint / face unlock and auto-lock delay, for this device. */
export default function AppLockSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [lock, setLock] = useState(() => getLock(user.id));
  const [mode, setMode] = useState(null); // 'change' | 'remove'
  const [bioAvailable, setBioAvailable] = useState(false);
  const [removePin, setRemovePin] = useState('');

  useEffect(() => {
    biometricAvailable().then(setBioAvailable);
  }, []);

  const reload = () => setLock(getLock(user.id));

  if (!lock?.pinHash) {
    return (
      <div className="space-y-4">
        <p className="max-w-md text-sm text-ink-3">
          Ask for a PIN when the app opens on this device, so nobody borrowing your phone can see your money. Forgot it? Sign in with your password instead.
        </p>
        <PinForm
          submitLabel="Turn on app lock"
          onDone={() => {
            reload();
            toast('App lock is on');
          }}
        />
      </div>
    );
  }

  const toggleBiometric = async (on) => {
    try {
      if (on) await enableBiometric(user.id, user.username);
      else disableBiometric(user.id);
      reload();
      toast(on ? 'Fingerprint / face unlock is on' : 'Fingerprint / face unlock is off', { tone: on ? 'success' : 'info' });
    } catch {
      toast("Couldn't set up fingerprint / face unlock on this device.", { tone: 'error' });
    }
  };

  const remove = async (e) => {
    e.preventDefault();
    if (!(await verifyPin(user.id, removePin))) return toast('Wrong PIN', { tone: 'error' });
    removeLock(user.id);
    setRemovePin('');
    setMode(null);
    reload();
    toast('App lock is off', { tone: 'info' });
  };

  return (
    <div className="max-w-lg space-y-5">
      <div className="rounded-2xl border border-line bg-surface-2/60 p-4 text-sm">
        <span className="font-semibold text-income">App lock is on</span>
        <span className="text-ink-3"> · {lock.pinLength}-digit PIN on this device</span>
      </div>

      {bioAvailable && (
        <ToggleRow
          icon="👆"
          title="Fingerprint / face unlock"
          hint="Unlock with your device's biometrics, PIN as backup"
          checked={Boolean(lock.credentialId)}
          onChange={toggleBiometric}
        />
      )}

      <div>
        <div className="label">Lock after leaving the app</div>
        <div className="flex flex-wrap gap-2">
          {LOCK_AFTER_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={lock.after === o.value}
              onClick={() => {
                setLockAfter(user.id, o.value);
                reload();
              }}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      {mode === 'change' ? (
        <PinForm
          askCurrent
          submitLabel="Change PIN"
          onCancel={() => setMode(null)}
          onDone={() => {
            setMode(null);
            reload();
            toast('PIN changed');
          }}
        />
      ) : mode === 'remove' ? (
        <form onSubmit={remove} className="flex max-w-xs items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="pin-remove">
              Current PIN
            </label>
            <input
              id="pin-remove"
              className="field tracking-[0.5em]"
              type="password"
              inputMode="numeric"
              autoFocus
              value={removePin}
              onChange={(e) => setRemovePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <Button type="submit" variant="danger">
            Turn off
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon="key" onClick={() => setMode('change')}>
            Change PIN
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('remove')}>
            Turn off app lock
          </Button>
        </div>
      )}
    </div>
  );
}
