import { useEffect, useState } from "react";

import { admin, getStatus } from "../api/endpoints";
import { ApiError } from "../api/client";
import type { StatusOut } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { S } from "../i18n/strings";
import styles from "./AdminView.module.css";

const TOKEN_KEY = "ml.admin.token";

/** Panneau d'administration hors périmètre du plan (ADR 0008) : mode
 * maintenance et annonce, pour un déploiement public à un seul
 * administrateur. Accessible via /admin (voir main.tsx), en dehors du
 * système de vues F2-F8 de l'application normale. */
export function AdminView() {
  const { t, lang, setLang } = useLanguage();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [tokenInput, setTokenInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusOut | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void getStatus().then(setStatus);
  }, []);

  async function login() {
    setLoginError(null);
    try {
      await admin.login(tokenInput);
      sessionStorage.setItem(TOKEN_KEY, tokenInput);
      setToken(tokenInput);
    } catch (err) {
      setLoginError(err instanceof ApiError ? String(err.detail) : t(S.admin.loginError));
    }
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setTokenInput("");
  }

  async function save() {
    if (!token || !status) return;
    setSaveState("saving");
    try {
      const updated = await admin.updateStatus(token, status);
      setStatus(updated);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <span className={styles.title}>{t(S.admin.pageTitle)}</span>
        <div className={styles.spacer} />
        <button type="button" className={styles.langBtn} data-active={lang === "fr"} onClick={() => setLang("fr")}>
          {t(S.language.fr)}
        </button>
        <button type="button" className={styles.langBtn} data-active={lang === "en"} onClick={() => setLang("en")}>
          {t(S.language.en)}
        </button>
      </div>

      <div className={styles.body}>
        <a className={styles.backLink} href="/">
          {t(S.admin.backToApp)}
        </a>

        {!token ? (
          <div className={styles.card}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t(S.admin.tokenLabel)}</span>
              <input
                className={styles.input}
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void login();
                }}
              />
            </label>
            <button type="button" className={styles.primaryBtn} onClick={() => void login()}>
              {t(S.admin.login)}
            </button>
            {loginError && <div className={styles.error}>{loginError}</div>}
          </div>
        ) : (
          <div className={styles.card}>
            <div className={styles.sessionRow}>
              <span>{t(S.admin.loggedInAs)}</span>
              <button type="button" className={styles.linkBtn} onClick={logout}>
                {t(S.admin.logout)}
              </button>
            </div>

            {status && (
              <>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={status.maintenance_mode}
                    onChange={(e) => setStatus({ ...status, maintenance_mode: e.target.checked })}
                  />
                  <span>{t(S.admin.maintenanceModeLabel)}</span>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t(S.admin.maintenanceMessageLabel)}</span>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={status.maintenance_message ?? ""}
                    onChange={(e) =>
                      setStatus({ ...status, maintenance_message: e.target.value || null })
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t(S.admin.announcementLabel)}</span>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={status.announcement ?? ""}
                    onChange={(e) => setStatus({ ...status, announcement: e.target.value || null })}
                  />
                </label>

                <button type="button" className={styles.primaryBtn} onClick={() => void save()}>
                  {t(S.admin.save)}
                </button>
                {saveState === "saved" && <div className={styles.success}>{t(S.admin.saved)}</div>}
                {saveState === "error" && <div className={styles.error}>{t(S.admin.saveError)}</div>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
