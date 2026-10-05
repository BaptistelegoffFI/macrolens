import { useState } from "react";

import type { AssetClassOut, AssetHorizonCell } from "../../api/types";
import { useAssetReturns } from "../../hooks/useAssetReturns";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import type { Bi } from "../../i18n/strings";
import {
  CLASS_LABELS,
  exclusionEntries,
  percent,
  positiveCount,
  quantilesFor,
} from "../../lib/assetReturns";
import type { AssetMetric } from "../../lib/assetReturns";
import { AssetPathChart } from "../charts/AssetPathChart";
import { FailSafe } from "../shell/FailSafe";
import { Num } from "../table/Num";
import styles from "./AssetReturnsBlock.module.css";

const COLUMNS = [1, 3, 5];
const METRICS: { id: AssetMetric; label: Bi }[] = [
  { id: "cumulative", label: S.assets.metricCumulative },
  { id: "annualised", label: S.assets.metricAnnualised },
  { id: "drawdown", label: S.assets.metricDrawdown },
];

export interface AssetReturnsBlockProps {
  analogs: { country: string; year: number }[] | null;
  anchor: { country: string; year: number } | null;
  onOpenAssetClasses: (anchor: { country: string; year: number } | null) => void;
}

function FxPictogram({ pegged, n }: { pegged: number; n: number }) {
  const { t } = useLanguage();
  return (
    <svg
      className={styles.pictogram}
      width="14"
      height="10"
      viewBox="0 0 14 10"
      role="img"
      aria-label={t(S.assets.pegged)(pegged, n)}
    >
      <title>{t(S.assets.pegged)(pegged, n)}</title>
      <path d="M0 8 H7 V2 H14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ClassCell({
  klass,
  cell,
  metric,
}: {
  klass: AssetClassOut;
  cell: AssetHorizonCell;
  metric: AssetMetric;
}) {
  const { t } = useLanguage();
  const reasons = exclusionEntries(cell).map(([key, count]) => {
    const label = {
      before_start: t(S.assets.exclusionBeforeStart),
      truncated_end: t(S.assets.exclusionTruncatedEnd),
      gap: t(S.assets.exclusionGap),
      no_series: t(S.assets.exclusionNoSeries),
    }[key];
    return `${label} (${count})`;
  });
  const excludedText = reasons.length ? `${t(S.assets.excludedBecause)} ${reasons.join(", ")}` : undefined;
  const nLine = (
    <div className={styles.nLine} title={excludedText}>
      {t(S.assets.nOf)(cell.n, cell.n_requested)}
    </div>
  );

  if (cell.n === 0) {
    return (
      <td className={styles.cell} data-empty="true">
        <div className={styles.unavailable}>{t(S.assets.notAvailable)}</div>
        {nLine}
        {excludedText && <div className={styles.reasons}>{excludedText}</div>}
      </td>
    );
  }

  const q = quantilesFor(cell, metric);
  if (q === null) {
    return (
      <td className={styles.cell}>
        <Num value={null} />
        {nLine}
      </td>
    );
  }

  const tone = klass.return_basis === "cpi_change" ? "none" : "auto";
  const positives = positiveCount(cell);
  return (
    <td className={styles.cell}>
      <div className={styles.median}>
        <Num value={percent(q.median)} decimals={1} unit="%" sign tone={tone} />
        {klass.return_basis === "nominal_fx_return" && cell.n_pegged !== null && cell.n_pegged > 0 && (
          <FxPictogram pegged={cell.n_pegged} n={cell.n} />
        )}
        {cell.n_extreme > 0 && (
          <span className={styles.flag} title={t(S.assets.extreme)(cell.n_extreme)}>
            ⚑
          </span>
        )}
        {cell.n_interpolated !== null && cell.n_interpolated > 0 && (
          <span className={styles.flag} title={t(S.assets.interpolated)(cell.n_interpolated)}>
            ~
          </span>
        )}
      </div>
      <div className={styles.iqr}>
        {t(S.assets.iqr)} <Num value={percent(q.q1)} decimals={1} unit="%" sign /> {"→"}{" "}
        <Num value={percent(q.q3)} decimals={1} unit="%" sign />
      </div>
      {nLine}
      {metric !== "drawdown" && positives !== null && (
        <div className={styles.nLine}>{t(S.assets.positiveOf)(positives, cell.n)}</div>
      )}
      {excludedText && <div className={styles.reasons}>{excludedText}</div>}
    </td>
  );
}

function ClassRow({ klass, metric }: { klass: AssetClassOut; metric: AssetMetric }) {
  const { t, lang } = useLanguage();
  const label = CLASS_LABELS[klass.class_id]?.[lang] ?? klass.class_id;
  const caveat = lang === "fr" ? klass.series.caveat_fr : klass.series.caveat_en;
  const seriesLabel = lang === "fr" ? klass.series.label_fr : klass.series.label_en;
  return (
    <tr>
      <th scope="row" className={styles.rowLabel} title={[seriesLabel, caveat].filter(Boolean).join(". ")}>
        {label}
        <span className={styles.tier} title={t(S.assets.tierTitle)(klass.series.tier)}>
          {t(S.assets.tierBadge)(klass.series.tier)}
        </span>
      </th>
      {COLUMNS.map((h) => {
        const cell = klass.cells.find((c) => c.horizon === h);
        return cell ? (
          <ClassCell key={h} klass={klass} cell={cell} metric={metric} />
        ) : (
          <td key={h} className={styles.cell} data-empty="true">
            <div className={styles.unavailable}>{t(S.assets.notAvailable)}</div>
          </td>
        );
      })}
    </tr>
  );
}

/** Bloc Scénario (ADR 0015 à 0024) : ce que chaque classe d'actifs a réellement
 * donné après les précédents de la recherche. Toute défaillance reste confinée ici :
 * le tableau des analogues, l'éventail et la frise ne dépendent pas de ce bloc. */
function AssetReturnsBlockInner({ analogs, anchor, onOpenAssetClasses }: AssetReturnsBlockProps) {
  const { t, lang } = useLanguage();
  const [metric, setMetric] = useState<AssetMetric>("cumulative");
  const { data, loading, error } = useAssetReturns(analogs);

  if (!analogs || analogs.length === 0) return null;

  const core = data?.classes.filter((c) => c.section === "core") ?? [];
  const housing = data?.classes.filter((c) => c.section === "housing") ?? [];
  const fx = data?.classes.filter((c) => c.section === "fx") ?? [];
  const inflation = data?.classes.filter((c) => c.section === "inflation") ?? [];
  const equities = data?.classes.find((c) => c.class_id === "equities");
  const housingCaveat = housing[0]
    ? lang === "fr"
      ? housing[0].series.caveat_fr
      : housing[0].series.caveat_en
    : null;
  const paths = data?.forward_paths ?? [];
  const pathN = Math.max(0, ...paths.flatMap((p) => p.points.map((pt) => pt.n)));

  return (
    <section className={styles.block} aria-label={t(S.assets.blockTitle)}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t(S.assets.blockTitle)}</div>
          <div className={styles.subtitle}>{t(S.assets.blockSubtitle)}</div>
        </div>
        <div className={styles.controls}>
          <div className={styles.segmented} role="group" aria-label={t(S.assets.metricAria)}>
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.segmentedBtn}
                data-active={metric === m.id}
                aria-pressed={metric === m.id}
                onClick={() => setMetric(m.id)}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
          <button type="button" className={styles.linkBtn} onClick={() => onOpenAssetClasses(anchor)}>
            {t(S.assets.openAssetClasses)}
          </button>
        </div>
      </div>

      {loading && <div className={styles.notice}>{t(S.assets.loading)}</div>}
      {error && (
        <div className={styles.notice} role="note">
          {t(S.assets.unavailable)}
        </div>
      )}

      {data && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colHead}>
                  {t(S.assets.classColumn)}
                </th>
                {COLUMNS.map((h) => (
                  <th key={h} scope="col" className={styles.colHead}>
                    {t(S.assets.horizonYears)(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {core.map((c) => (
                <ClassRow key={c.class_id} klass={c} metric={metric} />
              ))}
            </tbody>
            {housing.length > 0 && (
              <tbody className={styles.sectionHousing}>
                <tr>
                  <td colSpan={COLUMNS.length + 1} className={styles.sectionHead}>
                    {t(S.assets.sectionHousing)}
                    {housingCaveat && <div className={styles.sectionCaveat}>{housingCaveat}</div>}
                  </td>
                </tr>
                {housing.map((c) => (
                  <ClassRow key={c.class_id} klass={c} metric={metric} />
                ))}
              </tbody>
            )}
            {fx.length > 0 && (
              <tbody className={styles.sectionOther}>
                <tr>
                  <td colSpan={COLUMNS.length + 1} className={styles.sectionHead}>
                    {t(S.assets.sectionFx)}
                  </td>
                </tr>
                {fx.map((c) => (
                  <ClassRow key={c.class_id} klass={c} metric={metric} />
                ))}
              </tbody>
            )}
            {inflation.length > 0 && (
              <tbody className={styles.sectionOther}>
                <tr>
                  <td colSpan={COLUMNS.length + 1} className={styles.sectionHead}>
                    {t(S.assets.sectionInflation)}
                  </td>
                </tr>
                {inflation.map((c) => (
                  <ClassRow key={c.class_id} klass={c} metric={metric} />
                ))}
              </tbody>
            )}
          </table>

          {metric === "drawdown" && <div className={styles.footnote}>{t(S.assets.drawdownNote)}</div>}

          {paths.length > 0 && pathN > 0 && (
            <div className={styles.chartBlock}>
              <div className={styles.chartTitle}>{t(S.assets.chartTitle)}</div>
              <AssetPathChart paths={paths} />
              <div className={styles.footnote}>{t(S.assets.chartNote)(pathN)}</div>
            </div>
          )}

          {equities && (
            <div className={styles.footnote}>
              {t(S.assets.provenance)(equities.series.first_year ?? 0, equities.series.last_year ?? 0)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AssetBlockNotice() {
  const { t } = useLanguage();
  return (
    <div className={styles.notice} role="note">
      {t(S.assets.unavailable)}
    </div>
  );
}

export function AssetReturnsBlock(props: AssetReturnsBlockProps) {
  return (
    <FailSafe fallback={<AssetBlockNotice />}>
      <AssetReturnsBlockInner {...props} />
    </FailSafe>
  );
}
