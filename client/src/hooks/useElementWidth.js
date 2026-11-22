import { useEffect, useRef, useState } from 'react';

/** Tracks an element's width so SVG charts can draw at real pixel size. */
export function useElementWidth(initial = 320) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
