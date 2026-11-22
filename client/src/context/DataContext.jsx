import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accountsApi, categoriesApi, peopleApi } from '../api';
import { currentMonth } from '../lib/dates';

/**
 * App-wide state shared by every page: the selected month, the user's
 * categories, accounts and people (used by pickers everywhere), a `version`
 * that bumps after any change so pages refetch, and the add/edit transaction
 * sheet (optionally opened with a `preset`, e.g. a debt with someone).
 */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [month, setMonth] = useState(currentMonth);
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

  const openEditor = useCallback(
    (transaction = null, preset = null) => setEditor({ open: true, transaction, preset }),
    []
  );
  const closeEditor = useCallback(() => setEditor((e) => ({ ...e, open: false })), []);

  const value = useMemo(
    () => ({ month, setMonth, version, refresh, categories, accounts, people, rules, editor, openEditor, closeEditor }),
    [month, version, refresh, categories, accounts, people, rules, editor, openEditor, closeEditor]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
