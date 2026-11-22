import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import Icon from '../../components/ui/Icon';
import CategoriesSection from './CategoriesSection';
import AccountsSection from './AccountsSection';
import BudgetsSection from './BudgetsSection';
import RecurringSection from './RecurringSection';
import PasswordSection from './PasswordSection';
import NotificationsSection from './NotificationsSection';
import AppLockSection from './AppLockSection';
import TelegramSection from './TelegramSection';
import UsersSection from './UsersSection';

const SECTIONS = [
  { key: 'categories', label: 'Categories', hint: 'Income and expense types', icon: 'tag', Component: CategoriesSection },
  { key: 'accounts', label: 'Accounts', hint: 'Cash, bank, e-wallets', icon: 'wallet', Component: AccountsSection },
  { key: 'budgets', label: 'Budgets', hint: 'Monthly spending limits', icon: 'target', Component: BudgetsSection },
  { key: 'recurring', label: 'Recurring', hint: 'Bills and salary on autopilot', icon: 'repeat', Component: RecurringSection },
  { key: 'notifications', label: 'Notifications', hint: 'Reminders, budget alerts, weekly summary', icon: 'bell', Component: NotificationsSection },
  { key: 'telegram', label: 'Telegram', hint: 'Record by chatting with a bot', icon: 'send', Component: TelegramSection },
  { key: 'lock', label: 'App lock', hint: 'PIN or fingerprint on this device', icon: 'lock', Component: AppLockSection },
  { key: 'password', label: 'Password', hint: 'Change your password', icon: 'key', Component: PasswordSection },
  { key: 'users', label: 'Users', hint: 'Register and manage accounts', icon: 'users', Component: UsersSection, adminOnly: true },
];

function SettingsPanel({ section }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="card p-5"
    >
      <h2 className="mb-4 text-lg font-bold">{section.label}</h2>
      <section.Component />
    </motion.div>
  );
}

/**
 * Phones: a menu, then the chosen section full-width with a back button.
 * Desktop: menu on the left, section on the right.
 */
export default function SettingsPage({ initialSection }) {
  const { user, isAdmin, signOut } = useAuth();
  const sections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);
  const [active, setActive] = useState(sections.some((s) => s.key === initialSection) ? initialSection : null);
  const current = sections.find((s) => s.key === active);
  const desktopCurrent = current || sections[0];

  const Menu = (
    <nav className="card overflow-hidden p-2">
      {sections.map((s) => {
        const selected = desktopCurrent.key === s.key;
        return (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04] ${
              selected ? 'lg:bg-white/[0.06]' : ''
            }`}
          >
            <span className={`grid h-10 w-10 place-items-center rounded-xl bg-surface-2 ${selected ? 'lg:text-accent' : 'text-ink-2'}`}>
              <Icon name={s.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{s.label}</span>
              <span className="block truncate text-xs text-ink-3">{s.hint}</span>
            </span>
            <Icon name="chevron-right" size={16} className="text-ink-3 lg:hidden" />
          </button>
        );
      })}
      <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-expense hover:bg-expense-soft lg:hidden">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-expense-soft">
          <Icon name="logout" size={18} />
        </span>
        <span className="font-semibold">Sign out</span>
      </button>
    </nav>
  );

  return (
    <>
      <PageHeader eyebrow={`Signed in as ${user?.username}`} title="Settings" />

      {/* Phone */}
      <div className="lg:hidden">
        <AnimatePresence mode="wait" initial={false}>
          {current ? (
            <motion.div key="section" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
              <button onClick={() => setActive(null)} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
                <Icon name="chevron-left" size={18} /> Settings
              </button>
              <SettingsPanel section={current} />
            </motion.div>
          ) : (
            <motion.div key="menu" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              {Menu}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-[280px_1fr]">
        <div>{Menu}</div>
        <AnimatePresence mode="wait">
          <SettingsPanel key={desktopCurrent.key} section={desktopCurrent} />
        </AnimatePresence>
      </div>
    </>
  );
}
