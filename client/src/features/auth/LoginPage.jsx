import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import Aurora from '../../components/layout/Aurora';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

/** Floating preview cards that hint at the app behind the login. */
function HeroArt() {
  const cards = [
    { emoji: '🍜', title: 'Food & Drinks', amount: '− Rp 45.000', tone: 'text-ink', className: 'left-0 top-6 rotate-[-6deg]', delay: 0.2 },
    { emoji: '💼', title: 'Salary', amount: '+ Rp 8.500.000', tone: 'text-income', className: 'right-0 top-28 rotate-[5deg]', delay: 0.35 },
    { emoji: '🛵', title: 'Transport', amount: '− Rp 22.000', tone: 'text-ink', className: 'left-8 top-52 rotate-[-2deg]', delay: 0.5 },
  ];
  return (
    <div className="relative hidden h-80 w-full max-w-sm lg:block" aria-hidden="true">
      {cards.map((c) => (
        <motion.div
          key={c.title}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
          transition={{ opacity: { delay: c.delay }, scale: { delay: c.delay }, y: { delay: c.delay, duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
          className={`absolute flex w-64 items-center gap-3 rounded-3xl border border-white/10 bg-surface/80 p-4 shadow-2xl backdrop-blur-xl ${c.className}`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-xl">{c.emoji}</span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">{c.title}</span>
            <span className="block text-xs text-ink-3">Today</span>
          </span>
          <span className={`text-sm font-bold ${c.tone}`}>{c.amount}</span>
        </motion.div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(err.message);
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-5 py-10">
      <Aurora intense />
      <div className="flex w-full max-w-5xl items-center justify-center gap-16">
        <div className="hidden flex-1 lg:block">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-extrabold leading-[1.05] tracking-tight"
          >
            See where your
            <br />
            money <span className="text-gradient">really</span> goes.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-4 max-w-md text-lg text-ink-2">
            Track spending in seconds, set budgets, and keep an eye on every rupiah.
          </motion.p>
          <div className="mt-8">
            <HeroArt />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}>
              <Logo size={72} className="drop-shadow-[0_10px_30px_rgba(198,244,50,0.35)]" />
            </motion.div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
              See My <span className="text-gradient">EX</span>-pense
            </h2>
            <p className="mt-1 text-sm text-ink-3">Sign in to continue</p>
          </div>

          <motion.form
            key={shake}
            animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            onSubmit={submit}
            className="card space-y-4 p-6"
          >
            <div>
              <label className="label" htmlFor="username">Username</label>
              <div className="relative">
                <Icon name="user" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="username"
                  className="field pl-11"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your username"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Icon name="key" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  className="field px-11"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-1.5 py-1 text-xs font-semibold text-ink-3 hover:text-ink"
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
              Sign in
            </Button>
          </motion.form>
          <p className="mt-6 text-center text-xs text-ink-3">No account? Ask your admin to register one for you.</p>
        </motion.div>
      </div>
    </div>
  );
}
