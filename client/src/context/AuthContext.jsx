import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import { setUnauthorizedHandler, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(tokenStore.get() ? 'checking' : 'signed-out');

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then((me) => {
        setUser(me);
        setStatus('signed-in');
      })
      .catch(() => signOut());
  }, [signOut]);

  const signIn = useCallback(async (username, password) => {
    const { token, user: me } = await authApi.login(username, password);
    tokenStore.set(token);
    setUser(me);
    setStatus('signed-in');
  }, []);

  const value = useMemo(
    () => ({ user, status, isAdmin: user?.role === 'admin', signIn, signOut }),
    [user, status, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
