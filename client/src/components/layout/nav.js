/**
 * `phone: false` keeps an item out of the bottom bar: Settings lives behind the
 * avatar there, Goals behind its card on Home.
 */
export const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'activity', label: 'Activity', icon: 'activity' },
  { key: 'debts', label: 'Debts', icon: 'users' },
  { key: 'insights', label: 'Insights', icon: 'insights' },
  { key: 'goals', label: 'Goals', icon: 'flag', phone: false },
  { key: 'settings', label: 'Settings', icon: 'settings', phone: false },
];
