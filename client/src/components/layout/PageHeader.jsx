import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import Logo from '../ui/Logo';
import PrivacyToggle from '../ui/PrivacyToggle';

/** Phones have no Settings tab in the bottom bar: the avatar opens it instead. */
function SettingsAvatar() {
  const { user } = useAuth();
  const { page, navigate } = useNavigation();
  if (page === 'settings') return null;
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => navigate('settings')}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 text-sm font-extrabold lg:hidden"
      aria-label="Settings"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent to-cyan-brand text-accent-ink">
        {user?.username?.[0]?.toUpperCase()}
      </span>
    </motion.button>
  );
}

export default function PageHeader({ eyebrow, title, action }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-5 pt-6 lg:pt-10">
      <motion.div className="min-w-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-1 flex items-center gap-2 lg:hidden">
          <Logo size={22} />
          {eyebrow && <span className="truncate text-xs font-semibold text-ink-3">{eyebrow}</span>}
        </div>
        {eyebrow && <div className="mb-1 hidden text-sm font-medium text-ink-3 lg:block">{eyebrow}</div>}
        <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      </motion.div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <PrivacyToggle />
        <SettingsAvatar />
      </div>
    </header>
  );
}
