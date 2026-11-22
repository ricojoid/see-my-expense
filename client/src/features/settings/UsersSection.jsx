import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usersApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import Button from '../../components/ui/Button';
import Segmented from '../../components/ui/Segmented';
import ConfirmButton from '../../components/ui/ConfirmButton';
import Skeleton from '../../components/ui/Skeleton';
import Icon from '../../components/ui/Icon';

const empty = { username: '', password: '', role: 'user' };

function NewUserForm({ onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await usersApi.create(form);
      toast(`Account "${user.username}" created`);
      setForm(empty);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl border border-line bg-surface-2/50 p-4">
      <div className="font-semibold">Register a new account</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="field" placeholder="Username" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="field" type="password" placeholder="Password (8+ characters)" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </div>
      <Segmented
        size="sm"
        value={form.role}
        onChange={(role) => setForm({ ...form, role })}
        options={[
          { value: 'user', label: 'User' },
          { value: 'admin', label: 'Admin' },
        ]}
      />
      <p className="text-xs text-ink-3">Each account gets its own private categories, wallets and transactions. Admins can also manage accounts.</p>
      {error && <p className="text-sm text-expense" role="alert">{error}</p>}
      <Button type="submit" variant="primary" icon="plus" loading={busy} disabled={!form.username || !form.password}>
        Create account
      </Button>
    </form>
  );
}

function ResetPassword({ user, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await usersApi.resetPassword(user.id, password);
      toast(`Password for "${user.username}" reset`);
      onDone();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={submit} className="mt-2 flex gap-2 overflow-hidden">
      <input className="field h-10 py-0" type="password" autoFocus placeholder="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" size="sm" variant="primary" className="h-10" loading={busy} disabled={password.length < 8}>
        Reset
      </Button>
    </motion.form>
  );
}

export default function UsersSection() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [resetId, setResetId] = useState(null);
  const users = useFetch(() => usersApi.list(), [version]);
  const reload = () => setVersion((v) => v + 1);

  const run = async (action, message) => {
    try {
      await action();
      toast(message);
      reload();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <NewUserForm onCreated={reload} />
      {!users.data ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="divide-y divide-line">
          {users.data.map((u) => {
            const isMe = u.id === me.id;
            return (
              <li key={u.id} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/80 to-cyan-brand/80 font-extrabold text-accent-ink">
                    {u.username[0].toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="truncate">{u.username}</span>
                      {u.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                          <Icon name="shield" size={11} /> Admin
                        </span>
                      )}
                      {isMe && <span className="text-xs text-ink-3">(you)</span>}
                    </span>
                    <span className="text-xs text-ink-3">{u.transactionCount} transactions</span>
                  </span>
                  {!isMe && (
                    <>
                      <button
                        onClick={() => run(() => usersApi.setRole(u.id, u.role === 'admin' ? 'user' : 'admin'), u.role === 'admin' ? 'Made a regular user' : 'Made an admin')}
                        className="hidden rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/5 hover:text-ink sm:block"
                      >
                        {u.role === 'admin' ? 'Make user' : 'Make admin'}
                      </button>
                      <button
                        onClick={() => setResetId(resetId === u.id ? null : u.id)}
                        className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-white/5 hover:text-ink"
                        aria-label={`Reset password for ${u.username}`}
                        title="Reset password"
                      >
                        <Icon name="key" size={16} />
                      </button>
                      <ConfirmButton onConfirm={() => run(() => usersApi.remove(u.id), `Deleted "${u.username}" and all their data`)} />
                    </>
                  )}
                </div>
                <AnimatePresence>{resetId === u.id && <ResetPassword user={u} onDone={() => setResetId(null)} />}</AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
