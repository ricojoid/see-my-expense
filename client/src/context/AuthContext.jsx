import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import { markUnlocked } from '../lib/appLock';

const USER_KEY = 'sme_user';
const AuthContext = createContext(null);

const cachedUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

/**
 * Who is signed in. The last known user is kept on the device so the app
 * still opens offline; only a real 401 from the server signs out.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(tokenStore.get() ? 'checking' : 'signed-out');

  const remember = useCallback((me) => {
    localStorage.setItem(USER_KEY, JSON.stringify(me));
    setUser(me);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(remember)
      .catch((err) => {
        const offlineUser = err.status === 0 && cachedUser();
        if (offlineUser) {
          setUser(offlineUser);
          setStatus('signed-in');
        } else signOut();
      });
  }, [signOut, remember]);

  const signIn = useCallback(
    async (username, password) => {
      const { token, user: me } = await authApi.login(username, password);
      tokenStore.set(token);
      markUnlocked(); // the password is stronger than the app lock PIN
      remember(me);
    },
    [remember]
  );

  const value = useMemo(
    () => ({ user, status, isAdmin: user?.role === 'admin', signIn, signOut }),
    [user, status, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
