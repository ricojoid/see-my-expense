import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import Icon from './Icon';

/**
 * Bottom sheet on phones (drag down to close), centred dialog on desktop.
 */
export default function Sheet({ open, onClose, title, children, footer }) {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const panelMotion = isDesktop
    ? { initial: { opacity: 0, scale: 0.94, y: 16 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, y: 8 } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            {...panelMotion}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag={isDesktop ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="relative flex max-h-[92dvh] w-full flex-col rounded-t-4xl border border-line bg-surface shadow-2xl lg:max-w-lg lg:rounded-4xl"
          >
            <div className="flex shrink-0 cursor-grab justify-center pt-3 lg:hidden">
              <span className="h-1.5 w-10 rounded-full bg-white/15" />
            </div>
            <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3 lg:pt-5">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4" onPointerDown={(e) => e.stopPropagation() /* only the handle area drags the sheet */}>
              {children}
            </div>
            {footer && <div className="shrink-0 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
