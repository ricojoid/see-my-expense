import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { formatCompact, formatCurrency } from '../lib/format';

const STORAGE_KEY = 'sme_hide_amounts';
export const MASK = 'Rp •••••';

const PrivacyContext = createContext({ hidden: false, toggle: () => {} });

/** "Hide amounts" (the eye button): remembered on this device. */
export function PrivacyProvider({ children }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const toggle = useCallback(() => {
    setHidden((h) => {
      localStorage.setItem(STORAGE_KEY, h ? '0' : '1');
      return !h;
    });
  }, []);
  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export const usePrivacy = () => useContext(PrivacyContext);

/** Like formatCurrency, but masked while amounts are hidden. Use it for every amount on screen. */
export function useMoney() {
  const { hidden } = usePrivacy();
  return useCallback((value) => (hidden ? MASK : formatCurrency(value)), [hidden]);
}

/** Compact variant for chart axes. */
export function useCompactMoney() {
  const { hidden } = usePrivacy();
  return useCallback((value) => (hidden ? '•••' : formatCompact(value)), [hidden]);
}
