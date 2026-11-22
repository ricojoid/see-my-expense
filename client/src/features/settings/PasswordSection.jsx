import { useState } from 'react';
import { authApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';

export default function PasswordSection() {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) return setError('New password must be at least 8 characters');
    if (form.next !== form.confirm) return setError("The new passwords don't match");
    setBusy(true);
    setError('');
    try {
      await authApi.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast('Password changed');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <div>
        <label className="label" htmlFor="pw-current">Current password</label>
        <input id="pw-current" type="password" autoComplete="current-password" className="field" value={form.current} onChange={set('current')} />
      </div>
      <div>
        <label className="label" htmlFor="pw-next">New password</label>
        <input id="pw-next" type="password" autoComplete="new-password" className="field" value={form.next} onChange={set('next')} placeholder="At least 8 characters" />
      </div>
      <div>
        <label className="label" htmlFor="pw-confirm">Confirm new password</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" className="field" value={form.confirm} onChange={set('confirm')} />
      </div>
      {error && <p className="text-sm text-expense" role="alert">{error}</p>}
      <Button type="submit" variant="primary" loading={busy} disabled={!form.current || !form.next}>
        Change password
      </Button>
    </form>
  );
}
