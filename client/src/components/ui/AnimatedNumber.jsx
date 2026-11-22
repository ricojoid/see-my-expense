import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** Counts up/down to `value` and renders it with `format`. */
export default function AnimatedNumber({ value, format = (v) => v, duration = 0.8, className = '' }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      from.current = value;
      return undefined;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className={className}>{format(Math.round(display))}</span>;
}
