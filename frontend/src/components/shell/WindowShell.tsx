import type { ReactNode } from "react";

import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { TitleBar } from "./TitleBar";
import { VIEW_TABS } from "./viewTabs";
import styles from "./WindowShell.module.css";

export interface WindowShellProps {
  activeView: string;
  onViewChange: (key: string) => void;
  toolbar?: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
}

/** §11.2 : structure de fenêtre persistante — pas de pages qui se remplacent. */
export function WindowShell({ activeView, onViewChange, toolbar, statusBar, children }: WindowShellProps) {
  const { t } = useLanguage();
  return (
    <div className={styles.shell}>
      <TitleBar />
      {toolbar}
      <div className={styles.tabs} role="tablist" aria-label={t(S.viewTabs.ariaLabel)}>
        {VIEW_TABS.map((tab) => (
          <div
            key={tab.key}
            className={styles.tab}
            role="tab"
            aria-selected={activeView === tab.key}
            data-active={activeView === tab.key}
            tabIndex={0}
            onClick={() => onViewChange(tab.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewChange(tab.key);
              }
            }}
          >
            {t(tab.label)}
            <span className={styles.shortcut}>{tab.shortcut}</span>
          </div>
        ))}
      </div>
      {children}
      {statusBar}
    </div>
  );
}
