import { useEffect, useRef, useState } from "react";

import { useLanguage } from "../../i18n/LanguageContext";
import { S } from "../../i18n/strings";
import { parseCommand } from "../../lib/commandParser";
import type { ParsedCommand } from "../../lib/commandParser";
import styles from "./CommandPalette.module.css";

export interface CommandPaletteProps {
  onClose: () => void;
  onExecute: (command: ParsedCommand) => void;
}

/** §11.3 : `Ctrl+K` ouvre une ligne de commande qui exécute directement
 * une requête — logiciel piloté au clavier avant d'être piloté à la souris. */
export function CommandPalette({ onClose, onExecute }: CommandPaletteProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const parsed = parseCommand(value);
    onExecute(parsed);
    if (parsed.type !== "unknown") onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          placeholder={t(S.commandPalette.placeholder)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className={styles.examples}>
          <span className={styles.example}>{t(S.commandPalette.exampleAnchor)}</span> —{" "}
          {t(S.commandPalette.exampleAnchorDesc)} ·{" "}
          <span className={styles.example}>{t(S.commandPalette.exampleCompare)}</span> —{" "}
          {t(S.commandPalette.exampleCompareDesc)}
        </div>
        <div className={styles.hint}>{t(S.commandPalette.hint)}</div>
      </div>
    </div>
  );
}
