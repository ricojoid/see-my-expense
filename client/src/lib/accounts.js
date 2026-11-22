const LAST_ACCOUNT_KEY = 'sme_last_account';

/** The account used last time, else the first one. */
export function defaultAccountId(accounts) {
  const remembered = Number(localStorage.getItem(LAST_ACCOUNT_KEY));
  return accounts.some((a) => a.id === remembered) ? remembered : accounts[0]?.id ?? null;
}

export const rememberAccount = (id) => localStorage.setItem(LAST_ACCOUNT_KEY, String(id));
