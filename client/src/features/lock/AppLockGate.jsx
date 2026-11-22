import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLock, isMarkedUnlocked, markLocked, markUnlocked } from '../../lib/appLock';
import LockScreen from './LockScreen';

/**
 * Shows the lock screen when the app opens and when it comes back from the
 * background after the chosen delay. Signing in with the password unlocks.
 */
export default function AppLockGate({ children }) {
  const { user } = useAuth();
  const [locked, setLocked] = useState(() => Boolean(getLock(user.id)?.pinHash) && !isMarkedUnlocked());
  const hiddenAt = useRef(null);

  const unlock = useCallback(() => {
    markUnlocked();
    setLocked(false);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const lock = getLock(user.id);
      if (!lock?.pinHash) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        if (lock.after === 0) {
          markLocked();
          setLocked(true); // lock before the app switcher takes its snapshot
        }
      } else if (hiddenAt.current && Date.now() - hiddenAt.current >= lock.after * 60 * 1000) {
        markLocked();
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user.id]);

  return (
    <>
      <div aria-hidden={locked || undefined}>{children}</div>
      {locked && <LockScreen onUnlock={unlock} />}
    </>
  );
}
