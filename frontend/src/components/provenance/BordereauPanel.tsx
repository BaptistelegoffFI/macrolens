import { useState } from "react";

import type { ReceiptResponse } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { downloadText, toDelimited } from "../../lib/csv";
import type { ColumnDef } from "../table/Table";
import { Table } from "../table/Table";
import { EmptyState } from "../shell/EmptyState";
import styles from "./BordereauPanel.module.css";

export interface BordereauPanelProps {
  data: ReceiptResponse | null;
  loading: boolean;
  error: string | null;
}

type Tab = "table" | "sources" | "page";

/** §18.6 : panneau « Données utilisées (n) » — onglets Tableau / Sources /
 * Vue source, export CSV/JSON/SOURCES.txt. */
export function BordereauPanel({ data, loading, error }: BordereauPanelProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("table");

  if (loading) return <EmptyState>{t(S.bordereau.building)}</EmptyState>;
  if (error) return <EmptyState>{error}</EmptyState>;
  if (!data) return <EmptyState>{t(S.bordereau.empty)}</EmptyState>;

  const columns: ColumnDef<ReceiptResponse["rows"][number]>[] = [
    { key: "country", label: t(S.bordereau.colCountry), accessor: (r) => r.country },
    { key: "indicator", label: t(S.bordereau.colIndicator), accessor: (r) => r.indicator },
    { key: "period", label: t(S.bordereau.colPeriod), accessor: (r) => r.period },
    { key: "value", label: t(S.bordereau.colValue), numeric: true, decimals: 2, accessor: (r) => r.value },
    { key: "source", label: t(S.bordereau.colSource), accessor: (r) => r.source.id },
    { key: "file", label: t(S.bordereau.colFile), accessor: (r) => r.raw_file?.filename ?? null },
    {
      key: "flags",
      label: t(S.bordereau.colFlags),
      accessor: (r) =>
        [
          r.flags.interpolated && t(S.bordereau.flagInterpolated),
          r.flags.spliced && t(S.bordereau.flagSpliced),
          r.flags.break && t(S.bordereau.flagBreak),
          r.flags.conflict && t(S.bordereau.flagConflict),
        ]
          .filter(Boolean)
          .join(", ") || null,
      isFlagged: (r) => r.flags.interpolated || r.flags.spliced || r.flags.break || r.flags.conflict,
      flagReason: (r) => r.transform_chain.join(" → "),
    },
  ];

  function buildRows(): (string | number | null)[][] {
    if (!data) return [];
    return [
      ["pays", "indicateur", "periode", "valeur", "source", "fichier", "locator"],
      ...data.rows.map((r) => [
        r.country,
        r.indicator,
        r.period,
        r.value,
        r.source.id,
        r.raw_file?.filename ?? null,
        JSON.stringify(r.locator),
      ]),
    ];
  }

  function exportCsv() {
    if (!data) return;
    downloadText("bordereau.csv", toDelimited(buildRows(), ","), "text/csv");
  }

  function exportTsv() {
    if (!data) return;
    downloadText("bordereau.tsv", toDelimited(buildRows(), "\t"), "text/tab-separated-values");
  }

  function exportJson() {
    if (!data) return;
    downloadText("bordereau.json", JSON.stringify(data, null, 2), "application/json");
  }

  function exportSourcesTxt() {
    if (!data) return;
    const lines = data.sources_summary.map((s) => `${s.id} (${s.n_rows} lignes)\n${s.citation}\n`);
    downloadText("SOURCES.txt", lines.join("\n"), "text/plain");
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <div className={styles.tab} data-active={tab === "table"} onClick={() => setTab("table")}>
          {t(S.bordereau.tabTable)(data.rows.length)}
        </div>
        <div className={styles.tab} data-active={tab === "sources"} onClick={() => setTab("sources")}>
          {t(S.bordereau.tabSources)(data.sources_summary.length)}
        </div>
        <div className={styles.tab} data-active={tab === "page"} onClick={() => setTab("page")}>
          {t(S.bordereau.tabPage)}
        </div>
      </div>
      <div className={styles.body}>
        {tab === "table" &&
          (data.rows.length > 0 ? (
            <Table columns={columns} rows={data.rows} getRowKey={(r) => `${r.country}-${r.indicator}-${r.period}`} />
          ) : (
            <EmptyState>{t(S.bordereau.noRows)}</EmptyState>
          ))}
        {tab === "sources" &&
          data.sources_summary.map((s) => (
            <div key={s.id} className={styles.card}>
              <div className={styles.cardTitle}>{s.id}</div>
              <div className={styles.cardMeta}>{t(S.bordereau.rowsCount)(s.n_rows)}</div>
              <div className={styles.cardMeta}>{s.citation}</div>
            </div>
          ))}
        {tab === "page" && <EmptyState>{t(S.bordereau.pageUnavailable)}</EmptyState>}
      </div>
      <div className={styles.exportRow}>
        <button type="button" className={styles.exportBtn} onClick={exportCsv}>
          CSV
        </button>
        <button type="button" className={styles.exportBtn} onClick={exportTsv}>
          TSV
        </button>
        <button type="button" className={styles.exportBtn} onClick={exportJson}>
          JSON
        </button>
        <button type="button" className={styles.exportBtn} onClick={exportSourcesTxt}>
          SOURCES.txt
        </button>
      </div>
      <div className={styles.checksum}>{t(S.bordereau.checksum)(data.checksum.slice(0, 16))}</div>
    </div>
  );
}
