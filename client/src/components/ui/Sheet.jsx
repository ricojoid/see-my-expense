import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import Icon from './Icon';

/**
 * Body scroll lock shared by every open sheet. A counter (not "save and
 * restore" per sheet) so overlapping sheets can never leave the page locked.
 */
let openSheets = 0;
function lockScroll() {
  openSheets += 1;
  document.body.style.overflow = 'hidden';
  return () => {
    openSheets = Math.max(0, openSheets - 1);
    if (openSheets === 0) document.body.style.overflow = '';
  };
}

const EXIT_MS = 240;
const OPEN_SPRING = { type: 'spring', stiffness: 380, damping: 36 };
const CLOSE_TWEEN = { duration: EXIT_MS / 1000 - 0.02, ease: [0.4, 0, 1, 1] };
const PANEL = {
  desktop: { hidden: { opacity: 0, scale: 0.95, y: 12 }, shown: { opacity: 1, scale: 1, y: 0 } },
  phone: { hidden: { y: '100%' }, shown: { y: 0 } },
};

/**
 * The overlay. While closing it stops catching taps at once, so the page
 * underneath is usable immediately, and it is always removed after EXIT_MS.
 */
function Frame({ isDesktop, closing, title, onClose, children, footer }) {
  const panel = PANEL[isDesktop ? 'desktop' : 'phone'];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6"
      style={{ pointerEvents: closing ? 'none' : 'auto' }}
      aria-hidden={closing || undefined}
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? 0.18 : 0.25 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={panel.hidden}
        animate={closing ? panel.hidden : panel.shown}
        transition={closing ? CLOSE_TWEEN : OPEN_SPRING}
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
  );
}

/** Bottom sheet on phones (drag down to close), centred dialog on desktop. */
export default function Sheet({ open, onClose, title, children, footer }) {
  const isDesktop = useIsDesktop();
  // Callers pass inline handlers: keep the latest in a ref so effects depend on `open` only.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useRef(() => onCloseRef.current?.()).current;

  // Stays mounted for the closing animation, then is removed by a timer (not by
  // AnimatePresence, which could occasionally leave an invisible overlay behind).
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const unlock = lockScroll();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  if (!open && !mounted) return null;
  return createPortal(
    <Frame isDesktop={isDesktop} closing={!open} title={title} onClose={close} footer={footer}>
      {children}
    </Frame>,
    document.body
  );
}
