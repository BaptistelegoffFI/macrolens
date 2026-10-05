import { useEffect, useRef, useState } from "react";

/** Largeur courante d'un élément, suivie par ResizeObserver. `fallback` sert avant la première
 * mesure et dans jsdom (qui n'a aucune géométrie). */
export function useElementWidth<T extends HTMLElement>(fallback = 900) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
