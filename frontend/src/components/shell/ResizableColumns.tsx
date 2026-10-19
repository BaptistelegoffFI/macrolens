import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import styles from "./ResizableColumns.module.css";

export interface ResizableColumnsProps {
  storageKey: string;
  /** px, pour toutes les colonnes sauf celle qui remplit l'espace restant (dans l'ordre). */
  defaultWidths: number[];
  minWidth?: number;
  /** Indice de la colonne fluide ; par défaut la dernière. Une colonne fixe à droite (barre
   * latérale) se redimensionne depuis son bord gauche. */
  fillIndex?: number;
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
  fillIndex,
  children,
}: ResizableColumnsProps) {
  const fill = fillIndex ?? children.length - 1;
  // Indice dans `widths` de la colonne fixe d'indice `i` (la colonne fluide n'a pas de largeur).
  const widthIndex = (i: number) => (i < fill ? i : i - 1);
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
      if (idx < fill) {
        // Séparateur à droite d'une colonne fixe : on mesure depuis le bord gauche.
        const prior = widths.slice(0, widthIndex(idx)).reduce((a, b) => a + b, 0);
        const next = Math.max(minWidth, Math.round(e.clientX - rect.left - prior));
        setWidths((w) => w.map((v, i) => (i === widthIndex(idx) ? next : v)));
      } else {
        // Séparateur à gauche d'une colonne fixe à droite : on mesure depuis le bord droit.
        const later = widths.slice(widthIndex(idx + 1) + 1).reduce((a, b) => a + b, 0);
        const next = Math.max(minWidth, Math.round(rect.right - e.clientX - later));
        setWidths((w) => w.map((v, i) => (i === widthIndex(idx + 1) ? next : v)));
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widths, minWidth, fill]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {children.map((child, i) => {
        const isFill = i === fill;
        const isLast = i === children.length - 1;
        return (
          <div key={i} style={isFill ? { display: "flex", flex: 1, minWidth: 0 } : { display: "flex" }}>
            <div className={styles.column} style={isFill ? { flex: 1 } : { width: widths[widthIndex(i)] }}>
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
