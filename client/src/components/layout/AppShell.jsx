import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Wordmark } from '../ui/Logo';
import Icon from '../ui/Icon';
import Aurora from './Aurora';
import SyncBanner from './SyncBanner';
import { NAV_ITEMS } from './nav';

function Sidebar({ page, onNavigate }) {
  const { user, signOut } = useAuth();
  const { openEditor } = useData();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/40 px-4 py-6 backdrop-blur-xl lg:flex">
      <Wordmark className="px-2" />
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        onClick={() => openEditor()}
        className="mt-8 flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-bold text-accent-ink shadow-glow"
      >
        <Icon name="plus" strokeWidth={2.4} />
        New transaction
      </motion.button>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                active ? 'text-ink' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl border border-line bg-white/[0.06]"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon name={item.icon} className={`relative ${active ? 'text-accent' : ''}`} />
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-cyan-brand text-sm font-extrabold text-accent-ink">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user?.username}</div>
          <div className="text-xs capitalize text-ink-3">{user?.role}</div>
        </div>
        <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-white/5 hover:text-expense" aria-label="Sign out">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
  );
}

function NavItem({ item, page, onNavigate }) {
  const active = page === item.key;
  return (
    <button
      onClick={() => onNavigate(item.key)}
      className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
        active ? 'text-ink' : 'text-ink-3'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <motion.span
          layoutId="bottom-active"
          className="absolute top-0 h-1 w-8 rounded-b-full bg-accent"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <Icon name={item.icon} size={22} className={active ? 'text-accent' : ''} />
      {item.label}
    </button>
  );
}

function BottomNav({ page, onNavigate }) {
  const { openEditor } = useData();
  const items = NAV_ITEMS.filter((item) => item.phone !== false);
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-stretch rounded-3xl border border-line bg-surface/85 px-1 shadow-2xl backdrop-blur-2xl">
        {left.map((item) => (
          <NavItem key={item.key} item={item} page={page} onNavigate={onNavigate} />
        ))}
        <div className="flex w-16 items-center justify-center">
          <motion.button
            whileTap={{ scale: 0.88, rotate: 90 }}
            onClick={() => openEditor()}
            className="-mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-glow ring-4 ring-bg"
            aria-label="New transaction"
          >
            <Icon name="plus" size={26} strokeWidth={2.6} />
          </motion.button>
        </div>
        {right.map((item) => (
          <NavItem key={item.key} item={item} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

export default function AppShell({ page, onNavigate, children }) {
  return (
    <div className="flex min-h-dvh">
      <Aurora />
      <Sidebar page={page} onNavigate={onNavigate} />
      <main className="min-w-0 flex-1 overflow-x-clip pb-32 pt-safe lg:pb-12">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-10">
          <SyncBanner />
          {children}
        </div>
      </main>
      <BottomNav page={page} onNavigate={onNavigate} />
    </div>
  );
}
