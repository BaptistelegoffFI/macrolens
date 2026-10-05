import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import styles from "./ResizableRows.module.css";

export interface ResizableRowsProps {
  storageKey: string;
  defaultHeights: number[]; // px, for every row except the last (which fills remaining space)
  minHeight?: number;
  children: ReactNode[];
}

function readHeights(key: string, fallback: number[]): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    // Même longueur que les défauts : une disposition mémorisée avant l'ajout d'une
    // rangée (longueur différente) donnerait une hauteur `undefined` à la nouvelle.
    if (
      Array.isArray(parsed) &&
      parsed.length === fallback.length &&
      parsed.every((v) => typeof v === "number")
    ) {
      return parsed as number[];
    }
  } catch {
    /* localStorage indisponible ou valeur corrompue : on retombe sur les hauteurs par défaut. */
  }
  return fallback;
}

/** §11.2 : le panneau central s'empile verticalement, chaque section redimensionnable. */
export function ResizableRows({
  storageKey,
  defaultHeights,
  minHeight = 80,
  children,
}: ResizableRowsProps) {
  const [heights, setHeights] = useState<number[]>(() => readHeights(storageKey, defaultHeights));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(heights));
  }, [storageKey, heights]);

  const onPointerDown = useCallback((index: number) => {
    dragIndex.current = index;
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const idx = dragIndex.current;
      if (idx === null || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const priorHeight = heights.slice(0, idx).reduce((a, b) => a + b, 0);
      const next = Math.max(minHeight, Math.round(e.clientY - rect.top - priorHeight));
      setHeights((h) => h.map((v, i) => (i === idx ? next : v)));
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
  }, [heights, minHeight]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {children.map((child, i) => {
        const isLast = i === children.length - 1;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            <div className={styles.row} style={isLast ? { flex: 1 } : { height: heights[i] }}>
              {child}
            </div>
            {!isLast && (
              <div
                className={styles.gutter}
                role="separator"
                aria-orientation="horizontal"
                onPointerDown={() => onPointerDown(i)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
