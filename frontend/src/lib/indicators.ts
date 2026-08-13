/** Miroir de macrolens.panel.RAW_INDICATORS (backend) — les 10 indicateurs
 * bruts qui alimentent les 14 features (§8.1). */
export const RAW_INDICATORS: { code: string; label: string; unit: string }[] = [
  { code: "gdp_real_pc", label: "PIB réel / hab.", unit: "indice" },
  { code: "cpi", label: "Prix (IPC)", unit: "indice" },
  { code: "rate_short", label: "Taux court", unit: "%" },
  { code: "rate_long", label: "Taux long", unit: "%" },
  { code: "debt_public_gdp", label: "Dette publique / PIB", unit: "%" },
  { code: "credit_private_gdp", label: "Crédit privé / PIB", unit: "%" },
  { code: "equity_index_nominal", label: "Actions (nominal)", unit: "indice" },
  { code: "house_price_index", label: "Prix immobilier", unit: "indice" },
  { code: "unemployment_rate", label: "Chômage", unit: "%" },
  { code: "current_account_gdp", label: "Compte courant / PIB", unit: "%" },
];
