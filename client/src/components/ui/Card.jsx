import { motion } from 'framer-motion';

export default function Card({ title, subtitle, action, children, className = '', padded = true, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`card ${padded ? 'p-5' : ''} ${className}`}
    >
      {(title || action) && (
        <header className={`mb-4 flex items-start justify-between gap-3 ${padded ? '' : 'px-5 pt-5'}`}>
          <div>
            {title && <h2 className="font-bold">{title}</h2>}
            {subtitle && <div className="mt-0.5 text-xs text-ink-3">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}
