import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import styles from "./ResizableColumns.module.css";

export interface ResizableColumnsProps {
  storageKey: string;
  defaultWidths: number[]; // px, for every column except the last (which fills remaining space)
  minWidth?: number;
  children: ReactNode[];
}

function readWidths(key: string, fallback: number[]): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "number")) {
      return parsed as number[];
    }
  } catch {
    /* localStorage indisponible ou valeur corrompue : on retombe sur les largeurs par défaut. */
  }
  return fallback;
}

/** §11.2 : trois colonnes, séparateurs déplaçables, largeurs mémorisées en localStorage. */
export function ResizableColumns({
  storageKey,
  defaultWidths,
  minWidth = 160,
  children,
}: ResizableColumnsProps) {
  const [widths, setWidths] = useState<number[]>(() => readWidths(storageKey, defaultWidths));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(widths));
  }, [storageKey, widths]);

  const onPointerDown = useCallback((index: number) => {
    dragIndex.current = index;
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const idx = dragIndex.current;
      if (idx === null || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const priorWidth = widths.slice(0, idx).reduce((a, b) => a + b, 0);
      const next = Math.max(minWidth, Math.round(e.clientX - rect.left - priorWidth));
      setWidths((w) => w.map((v, i) => (i === idx ? next : v)));
    }
    function onUp() {
      dragIndex.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [widths, minWidth]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {children.map((child, i) => {
        const isLast = i === children.length - 1;
        return (
          <div key={i} style={{ display: "flex" }}>
            <div className={styles.column} style={isLast ? { flex: 1 } : { width: widths[i] }}>
              {child}
            </div>
            {!isLast && (
              <div
                className={styles.gutter}
                role="separator"
                aria-orientation="vertical"
                onPointerDown={() => onPointerDown(i)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
