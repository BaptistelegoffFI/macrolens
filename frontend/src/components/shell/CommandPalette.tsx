import { useEffect, useRef, useState } from "react";

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
          placeholder="FRA 2025 · SWE 1990 vs FIN 1990"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className={styles.examples}>
          <span className={styles.example}>PAYS ANNÉE</span> — ouvre le Scénario en mode ancre ·{" "}
          <span className={styles.example}>PAYS1 ANNÉE1 vs PAYS2 ANNÉE2</span> — ouvre le Comparateur
        </div>
        <div className={styles.hint}>Entrée pour exécuter · Échap pour fermer</div>
      </div>
    </div>
  );
}
