import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accountsApi, categoriesApi, peopleApi, periodsApi } from '../api';
import { currentMonth } from '../lib/dates';

/** Used offline, or until the server answers: plain calendar months. */
function calendarPeriod(month) {
  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const current = month === currentMonth();
  return { key: month, current, booked: false, start: `${month}-01`, days, daysElapsed: current ? today.getDate() : days };
}

/**
 * App-wide state shared by every page: the selected book period (`month`, a
 * 'YYYY-MM' key; with "tutup buku" it runs payday to payday) and its dates
 * (`period`), the user's
 * categories, accounts and people (used by pickers everywhere), a `version`
 * that bumps after any change so pages refetch, and the add/edit transaction
 * sheet (optionally opened with a `preset`, e.g. a debt with someone).
 */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [month, setMonth] = useState(null); // null until the current period is known
  const [period, setPeriod] = useState(null);
  const [currentKey, setCurrentKey] = useState(null);
  const [version, setVersion] = useState(0);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [people, setPeople] = useState([]);
  const [rules, setRules] = useState([]);
  const [editor, setEditor] = useState({ open: false, transaction: null, preset: null });

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([categoriesApi.list(), accountsApi.list(), peopleApi.list(), categoriesApi.rules()])
      .then(([cats, accs, ppl, learned]) => {
        if (!alive) return;
        setCategories(cats);
        setAccounts(accs);
        setPeople(ppl);
        setRules(learned);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [version]);

  // The current period first (it decides which "month" the app opens on), then whichever is chosen.
  useEffect(() => {
    let alive = true;
    periodsApi
      .get(month)
      .then((p) => {
        if (!alive) return;
        setPeriod(p);
        if (p.current) setCurrentKey(p.key);
        if (p.key !== month) setMonth(p.key); // first load, or a key no period has
      })
      .catch(() => {
        if (!alive) return;
        const key = month || currentMonth();
        setPeriod(calendarPeriod(key));
        if (!month) {
          setCurrentKey(key);
          setMonth(key);
        }
      });
    return () => {
      alive = false;
    };
  }, [month, version]);

  /** After closing (or reopening) the books: back to whatever period is current now. */
  const goToCurrent = useCallback(async () => {
    const p = await periodsApi.get().catch(() => null);
    if (p) {
      setCurrentKey(p.key);
      setMonth(p.key);
    }
    setVersion((v) => v + 1);
  }, []);

  const openEditor = useCallback(
    (transaction = null, preset = null) => setEditor({ open: true, transaction, preset }),
    []
  );
  const closeEditor = useCallback(() => setEditor((e) => ({ ...e, open: false })), []);

  // `period` always describes `month` (a stale one is never handed out).
  const shownPeriod = period && period.key === month ? period : null;
  const value = useMemo(
    () => ({ month, setMonth, period: shownPeriod, currentKey, goToCurrent, version, refresh, categories, accounts, people, rules, editor, openEditor, closeEditor }),
    [month, shownPeriod, currentKey, goToCurrent, version, refresh, categories, accounts, people, rules, editor, openEditor, closeEditor]
  );
  // Pages fetch by `month`, so they wait until it's known (one quick request after sign-in).
  return <DataContext.Provider value={value}>{month ? children : null}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
