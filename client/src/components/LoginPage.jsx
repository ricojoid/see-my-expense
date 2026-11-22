import { useEffect, useState } from 'react';
import { login, setToken } from '../api.js';

const BOOT_LINES = [
  'initializing secure shell...',
  'mounting encrypted volume /dev/sme0...',
  'establishing tunnel to DESKTOP-8IN7U4N\\SQLEXPRESS...',
  'access requires authorization.',
];

export default function LoginPage({ onSuccess }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visibleLines >= BOOT_LINES.length) return;
    const timer = setTimeout(() => setVisibleLines((n) => n + 1), 350);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token } = await login(username, password);
      setToken(token);
      onSuccess();
    } catch (err) {
      setError(err.message || 'authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded border border-term-border bg-term-panel/90 p-6 shadow-glow backdrop-blur">
        <div className="mb-4 space-y-1 text-xs text-term-dim">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i}>
              <span className="text-term-green">$</span> {line}
            </div>
          ))}
        </div>

        <h1 className="mb-6 text-lg tracking-widest text-term-green drop-shadow-glowSm">
          SEE_MY_EX-PENSE
          <span className="animate-blink">_</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-term-dim">login</label>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-term-dim">password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
            />
          </div>

          {error && <div className="text-xs text-term-red">{`!! ${error}`}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded border border-term-green bg-term-green/10 px-3 py-2 text-sm uppercase tracking-widest text-term-green transition hover:bg-term-green/20 hover:shadow-glow disabled:opacity-50"
          >
            {submitting ? 'authenticating...' : '> authenticate'}
          </button>
        </form>

        <div className="mt-4 text-center text-[10px] text-term-dim">
          unauthorized access will be logged and monitored
        </div>
      </div>
    </div>
  );
}
