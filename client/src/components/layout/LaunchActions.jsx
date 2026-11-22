import { useEffect } from 'react';
import { useData } from '../../context/DataContext';

/**
 * Handles links into the app, e.g. the daily reminder opening
 * "/?add=expense": opens the add sheet, then tidies the address bar.
 */
export default function LaunchActions() {
  const { openEditor } = useData();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const add = params.get('add');
    if (add === 'expense' || add === 'income') openEditor(null, { type: add });
    if (params.has('add')) window.history.replaceState(null, '', window.location.pathname);
  }, [openEditor]);
  return null;
}
