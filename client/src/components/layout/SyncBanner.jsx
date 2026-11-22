import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useOnline } from '../../hooks/useOnline';
import { flushOutbox, onOutboxChange, outboxCount } from '../../lib/outbox';
import Icon from '../ui/Icon';

const RETRY_MS = 30 * 1000;

/**
 * Sends transactions saved offline as soon as possible (on reconnect, on open,
 * and every 30s while some are waiting), and says what is going on.
 */
export default function SyncBanner() {
  const { user } = useAuth();
  const { refresh } = useData();
  const toast = useToast();
  const online = useOnline();
  const [pending, setPending] = useState(() => outboxCount(user?.id));

  useEffect(() => onOutboxChange(() => setPending(outboxCount(user?.id))), [user?.id]);

  const sync = useCallback(async () => {
    if (!user || outboxCount(user.id) === 0) return;
    const { sent, rejected } = await flushOutbox(user.id);
    if (sent) {
      toast(`Synced ${sent} transaction${sent === 1 ? '' : 's'} saved offline`);
      refresh();
    }
    for (const { error } of rejected) toast(`An offline transaction couldn't be saved: ${error}`, { tone: 'error', duration: 6000 });
  }, [user, toast, refresh]);

  useEffect(() => {
    if (online) sync();
  }, [online, sync]);

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(sync, RETRY_MS);
    return () => clearInterval(timer);
  }, [pending, sync]);

  const message = !online
    ? pending
      ? `Offline · ${pending} waiting to sync`
      : "You're offline. New transactions are saved on this device."
    : pending
      ? `Syncing ${pending} transaction${pending === 1 ? '' : 's'}…`
      : null;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface-2/80 px-4 py-2.5 text-sm text-ink-2 lg:mt-6">
            <Icon name={online ? 'repeat' : 'cloud-off'} size={16} className={online ? 'animate-spin text-accent [animation-duration:2s]' : 'text-ink-3'} />
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
