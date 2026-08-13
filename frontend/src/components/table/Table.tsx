import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import styles from "./Table.module.css";

export interface ColumnDef<T> {
  key: string;
  label: string;
  numeric?: boolean;
  width?: number;
  accessor: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  format?: (value: unknown) => string;
  isFlagged?: (row: T) => boolean;
  flagReason?: (row: T) => string;
  tone?: (row: T) => "pos" | "neg" | undefined;
}

export interface TableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowActivate?: (row: T) => void;
}

type SortDir = "asc" | "desc" | "natural";

/** §11.4 : tableau dense — chasse fixe, zébrage, tri à trois états, Ctrl+C en TSV. */
export function Table<T>({ columns, rows, getRowKey, onRowActivate }: TableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "", dir: "natural" });
  const [selected, setSelected] = useState<number>(-1);

  const sortedRows = useMemo(() => {
    if (sort.dir === "natural" || !sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const withIndex = rows.map((r, i) => ({ r, i }));
    withIndex.sort((a, b) => {
      const va = col.accessor(a.r);
      const vb = col.accessor(b.r);
      if (va == null && vb == null) return a.i - b.i;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return a.i - b.i;
    });
    return withIndex.map((x) => x.r);
  }, [rows, sort, columns]);

  function cycleSort(key: string) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "natural" };
      return { key, dir: "asc" };
    });
  }

  function copySelectedAsTsv() {
    if (selected < 0 || selected >= sortedRows.length) return;
    const row = sortedRows[selected];
    const line = columns.map((c) => formatCell(c, row)).join("\t");
    void navigator.clipboard?.writeText(line);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, sortedRows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && selected >= 0 && onRowActivate) {
      onRowActivate(sortedRows[selected]);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      copySelectedAsTsv();
    }
  }

  return (
    <div className={styles.wrapper} tabIndex={0} onKeyDown={onKeyDown} role="grid" aria-rowcount={rows.length}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${styles.th} ${c.numeric ? styles.thNum : ""}`}
                style={c.width ? { width: c.width } : undefined}
                onClick={() => cycleSort(c.key)}
                role="columnheader"
                aria-sort={
                  sort.key === c.key ? (sort.dir === "asc" ? "ascending" : sort.dir === "desc" ? "descending" : "none") : "none"
                }
              >
                {c.label}
                {sort.key === c.key && sort.dir !== "natural" && (
                  <span className={styles.sortIndicator}>{sort.dir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr
              key={getRowKey(row)}
              className={styles.tr}
              data-selected={i === selected}
              onClick={() => setSelected(i)}
              onDoubleClick={() => onRowActivate?.(row)}
              role="row"
            >
              {columns.map((c) => {
                const flagged = c.isFlagged?.(row) ?? false;
                const tone = c.tone?.(row);
                const raw = c.accessor(row);
                const isMissing = raw === null || raw === undefined;
                const cellClass = [
                  styles.td,
                  c.numeric ? styles.tdNum : "",
                  flagged ? styles.tdFlagged : "",
                  isMissing ? styles.muted : tone === "neg" ? styles.neg : tone === "pos" ? styles.pos : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={c.key} className={cellClass} title={flagged ? c.flagReason?.(row) : undefined}>
                    {c.render ? c.render(row) : formatCell(c, row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell<T>(col: ColumnDef<T>, row: T): string {
  const value = col.accessor(row);
  if (value === null || value === undefined) return "—";
  return col.format ? col.format(value) : String(value);
}
