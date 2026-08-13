import type { ReactNode } from "react";

import { MenuBar } from "./MenuBar";
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
  return (
    <div className={styles.shell}>
      <MenuBar />
      {toolbar}
      <div className={styles.tabs} role="tablist" aria-label="Vues">
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
            {tab.label}
            <span className={styles.shortcut}>{tab.shortcut}</span>
          </div>
        ))}
      </div>
      {children}
      {statusBar}
    </div>
  );
}
