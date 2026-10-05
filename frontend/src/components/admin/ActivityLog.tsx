import { useCallback, useEffect, useState } from "react";

import { admin } from "../../api/endpoints";
import type { ActivityItem } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { pageLabel } from "../../lib/adminUsage";
import styles from "./ActivityLog.module.css";

const REFRESH_MS = 20_000;

/** Journal d'activité du panneau admin (ADR 0028) : chaque ligne porte son heure locale. Se
 * rafraîchit seul toutes les 20 s tant que l'onglet est visible. */
export function ActivityLog({ token }: { token: string }) {
  const { t, lang } = useLanguage();
  const [events, setEvents] = useState<ActivityItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const load = useCallback(() => {
    admin
      .activity(token)
      .then((r) => {
        setEvents(r.events);
        setFailed(false);
        setUpdatedAt(new Date());
      })
      .catch(() => setFailed(true));
  }, [token]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const kindLabel = (kind: ActivityItem["kind"]) =>
    t(kind === "visit" ? S.admin.kindVisit : kind === "page" ? S.admin.kindPage : S.admin.kindSearch);

  let lastDay = "";
  return (
    <aside className={styles.panel} aria-label={t(S.admin.activityTitle)}>
      <div className={styles.head}>
        <span className={styles.title}>{t(S.admin.activityTitle)}</span>
        <button type="button" className={styles.refresh} onClick={load}>
          {t(S.admin.activityRefresh)}
        </button>
      </div>
      {updatedAt && (
        <div className={styles.updated}>{t(S.admin.activityUpdated)(timeFmt.format(updatedAt))}</div>
      )}
      {failed && <div className={styles.error}>{t(S.admin.activityError)}</div>}
      {events && events.length === 0 && <div className={styles.empty}>{t(S.admin.activityEmpty)}</div>}
      <ol className={styles.list}>
        {events?.map((e, i) => {
          const date = new Date(e.at);
          const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const header = dayKey !== lastDay;
          lastDay = dayKey;
          return (
            <li key={`${e.at}-${i}`} className={styles.item}>
              {header && <div className={styles.day}>{dayFmt.format(date)}</div>}
              <div className={styles.row} data-kind={e.kind}>
                <time className={styles.time} dateTime={e.at} title={e.at}>
                  {timeFmt.format(date)}
                </time>
                <span className={styles.badge} data-kind={e.kind}>
                  {kindLabel(e.kind)}
                </span>
                <span className={styles.what}>
                  {e.kind === "page" ? pageLabel(e.name, t) : (e.name ?? "")}
                  {e.detail && <span className={styles.detail}>{e.detail}</span>}
                </span>
                <span className={styles.device} title="device">
                  {e.device}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <div className={styles.note}>{t(S.admin.activityNote)}</div>
    </aside>
  );
}
