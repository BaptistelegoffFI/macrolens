import type { Lang } from "../i18n/strings";

/** Miroir de macrolens.panel.RAW_INDICATORS (backend) — les 10 indicateurs
 * bruts qui alimentent les 14 features (§8.1). */
const RAW_INDICATORS_BI: { code: string; label: { fr: string; en: string }; unit: { fr: string; en: string } }[] = [
  { code: "gdp_real_pc", label: { fr: "PIB réel / hab.", en: "Real GDP / capita" }, unit: { fr: "indice", en: "index" } },
  { code: "cpi", label: { fr: "Prix (IPC)", en: "Prices (CPI)" }, unit: { fr: "indice", en: "index" } },
  { code: "rate_short", label: { fr: "Taux court", en: "Short rate" }, unit: { fr: "%", en: "%" } },
  { code: "rate_long", label: { fr: "Taux long", en: "Long rate" }, unit: { fr: "%", en: "%" } },
  { code: "debt_public_gdp", label: { fr: "Dette publique / PIB", en: "Public debt / GDP" }, unit: { fr: "%", en: "%" } },
  { code: "credit_private_gdp", label: { fr: "Crédit privé / PIB", en: "Private credit / GDP" }, unit: { fr: "%", en: "%" } },
  { code: "equity_index_nominal", label: { fr: "Actions (nominal)", en: "Equity (nominal)" }, unit: { fr: "indice", en: "index" } },
  { code: "house_price_index", label: { fr: "Prix immobilier", en: "House prices" }, unit: { fr: "indice", en: "index" } },
  { code: "unemployment_rate", label: { fr: "Chômage", en: "Unemployment" }, unit: { fr: "%", en: "%" } },
  { code: "current_account_gdp", label: { fr: "Compte courant / PIB", en: "Current account / GDP" }, unit: { fr: "%", en: "%" } },
];

export function rawIndicators(lang: Lang): { code: string; label: string; unit: string }[] {
  return RAW_INDICATORS_BI.map((i) => ({ code: i.code, label: i.label[lang], unit: i.unit[lang] }));
}

/** Codes seuls, indépendants de la langue — pour construire des clés
 * d'observation (lib/provenanceKeys.ts), pas pour l'affichage. */
export const RAW_INDICATOR_CODES: string[] = RAW_INDICATORS_BI.map((i) => i.code);
