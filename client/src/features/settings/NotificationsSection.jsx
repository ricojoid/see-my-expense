import { useEffect, useState } from 'react';
import { notificationsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { currentSubscription, isInstalled, isIos, pushSupported, subscribePush, unsubscribePush } from '../../lib/push';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import ToggleRow from '../../components/ui/ToggleRow';

/** Is this device receiving notifications, plus the user's reminder / alert preferences. */
export default function NotificationsSection() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [deviceOn, setDeviceOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([notificationsApi.get(), currentSubscription()])
      .then(([info, sub]) => {
        if (!alive) return;
        setData(info);
        setDeviceOn(Boolean(sub));
      })
      .catch((err) => toast(err.message, { tone: 'error' }));
    return () => {
      alive = false;
    };
  }, [toast]);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      const subscription = await subscribePush(data.publicKey);
      await notificationsApi.subscribe(subscription.toJSON());
      setDeviceOn(true);
      toast('Notifications are on for this device');
    });

  const turnOff = () =>
    run(async () => {
      const endpoint = await unsubscribePush();
      if (endpoint) await notificationsApi.unsubscribe(endpoint);
      setDeviceOn(false);
      toast('Notifications are off for this device', { tone: 'info' });
    });

  const sendTest = () =>
    run(async () => {
      const { sent } = await notificationsApi.test();
      toast(sent ? 'Test sent. It should pop up in a moment.' : 'No device received it. Turn notifications on first.', { tone: sent ? 'success' : 'info' });
    });

  const save = (patch) =>
    run(async () => {
      const settings = await notificationsApi.update(patch);
      setData((d) => ({ ...d, settings }));
    });

  if (!data) return <Skeleton className="h-48" />;
  const { settings } = data;
  const needsInstall = isIos() && !isInstalled();

  return (
    <div className="max-w-lg space-y-5">
      <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">This device</div>
            <div className="text-xs text-ink-3">{deviceOn ? 'Receiving notifications' : 'Notifications are off'}</div>
          </div>
          {pushSupported() && !needsInstall && (
            <Button size="sm" variant={deviceOn ? 'secondary' : 'primary'} icon="bell" loading={busy} onClick={deviceOn ? turnOff : turnOn}>
              {deviceOn ? 'Turn off' : 'Turn on'}
            </Button>
          )}
        </div>
        {needsInstall && (
          <p className="mt-3 text-xs text-ink-2">
            On iPhone, notifications work once the app is on your Home Screen: tap Share, then “Add to Home Screen”, and open it from there.
          </p>
        )}
        {!pushSupported() && !needsInstall && <p className="mt-3 text-xs text-ink-2">This browser can't receive notifications.</p>}
        {deviceOn && (
          <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={sendTest} disabled={busy}>
            Send a test notification
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <ToggleRow
          icon="⏰"
          title="Daily reminder"
          hint="Only if you haven't logged anything that day"
          checked={settings.reminderEnabled}
          onChange={(reminderEnabled) => save({ reminderEnabled })}
        />
        {settings.reminderEnabled && (
          <div className="flex items-center justify-between gap-3 px-1">
            <label htmlFor="reminder-time" className="text-sm text-ink-2">
              Remind me at
            </label>
            <input
              id="reminder-time"
              type="time"
              className="field h-11 w-32 py-0"
              value={settings.reminderTime}
              onChange={(e) => e.target.value && save({ reminderTime: e.target.value })}
            />
          </div>
        )}
        <ToggleRow
          icon="🎯"
          title="Budget alerts"
          hint="When a category reaches 80% and when it goes over"
          checked={settings.budgetAlerts}
          onChange={(budgetAlerts) => save({ budgetAlerts })}
        />
        <ToggleRow
          icon="📊"
          title="Weekly summary"
          hint="Every Monday at 08:00: last week's spending"
          checked={settings.weeklySummary}
          onChange={(weeklySummary) => save({ weeklySummary })}
        />
      </div>
      <p className="text-xs text-ink-3">Times follow the server's timezone (WIB).</p>
    </div>
  );
}
