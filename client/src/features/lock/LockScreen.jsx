import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getLock, removeLock, verifyBiometric, verifyPin } from '../../lib/appLock';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';

const MAX_ATTEMPTS = 5;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

/** Full-screen PIN pad (with fingerprint / face unlock when set up). */
export default function LockScreen({ onUnlock }) {
  const { user, signOut } = useAuth();
  const lock = getLock(user.id);
  const length = lock?.pinLength || 4;
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(0);
  const [error, setError] = useState('');

  const forgot = useCallback(() => {
    removeLock(user.id);
    signOut();
  }, [user.id, signOut]);

  const tryPin = useCallback(
    async (value) => {
      if (await verifyPin(user.id, value)) return onUnlock();
      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      setShake((n) => n + 1);
      if (next >= MAX_ATTEMPTS) return forgot();
      setError(`Wrong PIN. ${MAX_ATTEMPTS - next} ${MAX_ATTEMPTS - next === 1 ? 'try' : 'tries'} left.`);
    },
    [user.id, attempts, onUnlock, forgot]
  );

  const press = (key) => {
    setError('');
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    if (key === 'bio') return unlockWithBiometric();
    if (pin.length >= length) return;
    const next = pin + key;
    setPin(next);
    if (next.length === length) tryPin(next); // no "OK" button: checked as soon as it's complete
  };

  async function unlockWithBiometric() {
    try {
      if (await verifyBiometric(user.id)) onUnlock();
    } catch {
      setError('Fingerprint / face unlock was cancelled. Use your PIN.');
    }
  }

  // Physical keyboards too.
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" role="dialog" aria-modal="true" aria-label="App locked">
      <Logo size={56} />
      <h1 className="mt-5 text-xl font-extrabold">Welcome back, {user.username}</h1>
      <p className="mt-1 text-sm text-ink-3">Enter your PIN to unlock</p>

      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.35 }} className="mt-6 flex gap-3" aria-live="polite">
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors ${i < pin.length ? 'bg-accent' : 'bg-white/15'}`} />
        ))}
      </motion.div>
      <p className="mt-3 h-5 text-sm text-expense" role="alert">
        {error}
      </p>

      <div className="mt-4 grid w-full max-w-[280px] grid-cols-3 gap-3">
        {KEYS.map((key) => {
          if (key === 'bio' && !lock?.credentialId) return <span key={key} />;
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.9 }}
              onClick={() => press(key)}
              className={`grid h-16 place-items-center rounded-2xl text-2xl font-bold ${key === 'bio' || key === 'del' ? 'text-ink-2' : 'bg-surface-2'}`}
              aria-label={key === 'bio' ? 'Unlock with fingerprint or face' : key === 'del' ? 'Delete' : key}
            >
              {key === 'bio' ? <Icon name="fingerprint" size={28} /> : key === 'del' ? <Icon name="chevron-left" size={26} /> : key}
            </motion.button>
          );
        })}
      </div>

      <button onClick={forgot} className="mt-8 text-sm font-semibold text-ink-3 hover:text-ink">
        Forgot PIN? Sign in with your password
      </button>
    </div>
  );
}
