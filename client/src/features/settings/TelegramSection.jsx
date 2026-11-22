import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi, telegramApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import Skeleton from '../../components/ui/Skeleton';
import ToggleRow from '../../components/ui/ToggleRow';

const LINK_FRESH_MS = 9 * 60 * 1000; // links expire after 10 minutes on the server
const EXAMPLES = [
  'kopi 25k',
  'grab 22k kemarin',
  'gaji 8jt bca',
  'ngutangin budi 50rb',
  'budi udah balikin 50rb',
  'makan 300k bagi 3 sama budi sari',
  'nabung laptop 500k',
  '/spent makan bulan ini',
];

/** Connect a Telegram chat, then record transactions by just sending messages to the bot. */
export default function TelegramSection() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [link, setLink] = useState(null); // { url, at }
  const [waiting, setWaiting] = useState(false);
  const [prefs, setPrefs] = useState({ telegramNotify: true, monthlyReport: true });
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const load = useCallback(() => telegramApi.status().then((s) => alive.current && setStatus(s)), []);

  // Prepare the connect link up front, so the tap opens Telegram directly (no popup blocker).
  const prepareLink = useCallback(async () => {
    const { url } = await telegramApi.link();
    if (alive.current) setLink({ url, at: Date.now() });
    return url;
  }, []);

  useEffect(() => {
    alive.current = true;
    Promise.all([
      load(),
      notificationsApi.get().then((n) => setPrefs({ telegramNotify: n.settings.telegramNotify, monthlyReport: n.settings.monthlyReport })),
    ]).catch((err) =>
      toast(err.message, { tone: 'error' })
    );
    return () => {
      alive.current = false;
    };
  }, [load, toast]);

  const linked = status?.links.length > 0;
  useEffect(() => {
    if (status?.enabled && !linked && !link) prepareLink().catch(() => {});
  }, [status, linked, link, prepareLink]);

  // After tapping Connect, watch for the chat to show up.
  useEffect(() => {
    if (!waiting || linked) return undefined;
    const timer = setInterval(load, 3000);
    const stop = setTimeout(() => setWaiting(false), 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [waiting, linked, load]);

  useEffect(() => {
    if (waiting && linked) {
      setWaiting(false);
      toast('Telegram connected');
    }
  }, [waiting, linked, toast]);

  const onConnect = async (e) => {
    setWaiting(true);
    if (link && Date.now() - link.at < LINK_FRESH_MS) return; // let the link open
    e.preventDefault();
    try {
      window.open(await prepareLink(), '_blank', 'noopener');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await telegramApi.unlink();
      setLink(null);
      await load();
      toast('Telegram disconnected', { tone: 'info' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key) => async (on) => {
    setPrefs((p) => ({ ...p, [key]: on }));
    try {
      await notificationsApi.update({ [key]: on });
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: !on }));
      toast(err.message, { tone: 'error' });
    }
  };

  if (!status) return <Skeleton className="h-40" />;

  if (!status.enabled) {
    return (
      <p className="max-w-md text-sm text-ink-3">
        The Telegram bot isn't set up on this server yet. Add <code className="text-ink-2">TELEGRAM_BOT_TOKEN</code> to the server's
        <code className="text-ink-2"> .env</code> and restart it.
      </p>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-ink-3">
        Chat with {status.botUsername ? <b className="text-ink-2">@{status.botUsername}</b> : 'the bot'} to record transactions without opening the app.
      </p>

      {linked ? (
        <>
          <div className="space-y-2 rounded-2xl border border-line bg-surface-2/60 p-4">
            {status.links.map((l) => (
              <div key={l.chatId} className="flex items-center gap-3 text-sm">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#229ED9]/20 text-[#5cb8e6]">
                  <Icon name="send" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{l.name || 'Telegram chat'}</span>
                  <span className="block text-xs text-income">Connected</span>
                </span>
              </div>
            ))}
          </div>
          <ToggleRow
            icon="🔔"
            title="Reminders and alerts on Telegram"
            hint="Daily reminder, budget alerts and the weekly summary (as set in Notifications)"
            checked={prefs.telegramNotify}
            onChange={toggle('telegramNotify')}
          />
          <ToggleRow
            icon="📊"
            title="Monthly PDF report"
            hint="Last month's report on the 1st, at 08:00. Or send /report any time."
            checked={prefs.monthlyReport}
            onChange={toggle('monthlyReport')}
          />
          <Button size="sm" variant="ghost" loading={busy} onClick={disconnect}>
            Disconnect Telegram
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <a
            href={link?.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onConnect}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#229ED9] px-5 font-bold text-white hover:brightness-110"
          >
            <Icon name="send" size={18} />
            Connect Telegram
          </a>
          <p className="text-xs text-ink-3">
            {waiting ? 'Waiting for you to tap Start in Telegram…' : 'Opens the bot in Telegram; tap Start there and this page updates by itself.'}
          </p>
        </div>
      )}

      <div>
        <div className="label">Try sending</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <code key={e} className="rounded-xl border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
              {e}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}
