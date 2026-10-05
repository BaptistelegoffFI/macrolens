import { useEffect, useState } from "react";

import { admin } from "../../api/endpoints";
import type { RankItem, RankingsOut } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import type { Bi } from "../../i18n/strings";
import { barPercent, pageLabel } from "../../lib/adminUsage";
import styles from "./RankingsCard.module.css";

const PERIODS: { days: number; label: Bi }[] = [
  { days: 7, label: S.admin.period7 },
  { days: 30, label: S.admin.period30 },
  { days: 0, label: S.admin.periodAll },
];

function RankList({
  title,
  items,
  format,
}: {
  title: string;
  items: RankItem[];
  format: (name: string) => string;
}) {
  const { t } = useLanguage();
  const max = items.reduce((m, i) => Math.max(m, i.count), 0);
  return (
    <section className={styles.list}>
      <h3 className={styles.listTitle}>{title}</h3>
      {items.length === 0 ? (
        <div className={styles.empty}>{t(S.admin.rankEmpty)}</div>
      ) : (
        <ol className={styles.items}>
          {items.map((item, index) => (
            <li key={item.name} className={styles.item}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.name}>{format(item.name)}</span>
              <span className={styles.count}>{t(S.admin.rankCount)(item.count, item.devices)}</span>
              <span className={styles.bar} style={{ width: `${barPercent(item.count, max)}%` }} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Classements d'usage (ADR 0028) : pages les plus utilisées, recherches et pays les plus
 * recherchés, sur 7 jours, 30 jours ou depuis le début. */
export function RankingsCard({ token }: { token: string }) {
  const { t } = useLanguage();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<RankingsOut | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    admin
      .rankings(token, days)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>{t(S.admin.rankingsTitle)}</span>
        <div className={styles.chips} role="group">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={styles.chip}
              data-active={days === p.days}
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>
      {failed && <div className={styles.error}>{t(S.admin.rankingsError)}</div>}
      {data && (
        <>
          <RankList
            title={t(S.admin.rankPages)}
            items={data.pages}
            format={(n) => pageLabel(n, t)}
          />
          <RankList title={t(S.admin.rankSearches)} items={data.searches} format={(n) => n} />
          <RankList title={t(S.admin.rankCountries)} items={data.countries} format={(n) => n} />
        </>
      )}
    </div>
  );
}
