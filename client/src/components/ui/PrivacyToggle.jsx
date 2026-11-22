import { motion } from 'framer-motion';
import { usePrivacy } from '../../context/PrivacyContext';
import Icon from './Icon';

/** The eye button: shows or hides every amount in the app. */
export default function PrivacyToggle({ className = '' }) {
  const { hidden, toggle } = usePrivacy();
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 transition-colors hover:text-ink ${
        hidden ? 'text-accent' : 'text-ink-2'
      } ${className}`}
      aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
      aria-pressed={hidden}
      title={hidden ? 'Show amounts' : 'Hide amounts'}
    >
      <Icon name={hidden ? 'eye-off' : 'eye'} />
    </motion.button>
  );
}
