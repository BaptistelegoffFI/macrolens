/** Textes de référence que l'API ne renvoie qu'en français : définitions d'indicateurs et licences,
 * noms, citations ou notes de sources (ADR 0030). Aucune donnée ni contrat d'API ne change : ces
 * tables sont indexées par identifiant stable (code d'indicateur, id de source) et le client
 * retombe sur le texte de l'API quand l'identifiant est inconnu. tests/dataStrings.test.ts vérifie
 * qu'aucun indicateur ni aucune source de data/reference/ n'est oublié.
 *
 * Ce sont des traductions, donc du contenu : voir docs/ux/translations-to-review.md. */

import type { Lang } from "./strings";

export const INDICATOR_DEFINITION_EN: Record<string, string> = {
  gdp_real_pc:
    "Gross domestic product in volume (constant prices), per head of population. Measures average living standards independently of inflation and country size.",
  gdp_real:
    "Gross domestic product at constant prices (volume), which removes the effect of inflation to measure only the physical change in output.",
  gdp_nominal:
    "Gross domestic product valued at current-year prices (current currency), with no inflation correction. Serves as the common denominator of the ratios to GDP (debt, credit, investment, etc.), always in current currency and for the same year (§7.2).",
  unemployment_rate:
    "Share of the labour force without a job and actively looking for one, expressed as a percentage of the labour force.",
  population:
    "Total resident population of the country, used in particular to compute per-capita quantities (gdp_real_pc).",
  investment_gdp:
    "Gross fixed capital formation (productive and residential investment), as a share of nominal GDP of the same year.",
  consumption_gdp:
    "Final consumption as a share of nominal GDP of the same year. Neither a high nor a low level is intrinsically favourable: it depends on the counterpart (investment, external balance).",
  cpi: "Index measuring the change in the general level of prices of goods and services consumed by households, base 100 at a reference year.",
  inflation_yoy:
    "Percentage change in the consumer price index relative to the same period of the previous year. Neither very high inflation nor deflation is desirable: the relationship is not monotonic.",
  money_broad:
    "Broad monetary aggregate (demand deposits, savings and near-money included), reflecting the volume of money in circulation in the economy.",
  wages_nominal: "Index of nominal wages (not corrected for inflation), base 100 at a reference year.",
  rate_short:
    "Short-term nominal interest rate (typically interbank or 3-month Treasury bills), reflecting immediate monetary conditions.",
  rate_long:
    "Nominal yield on long-term government bonds (10-year proxy), reflecting inflation and long-term growth expectations.",
  policy_rate: "Reference interest rate set by the central bank to steer monetary conditions.",
  equity_index_nominal:
    "Total-return stock index (dividends reinvested), in nominal currency, base 100 at a reference year.",
  equity_capgain_index:
    "Price-only stock index (excluding dividend reinvestment), in nominal currency, base 100 at a reference year.",
  dividend_yield: "Dividends paid over twelve months as a percentage of the level of the equity index.",
  house_price_index: "Index of residential property prices, base 100 at a reference year.",
  exchange_rate_usd:
    "Exchange rate of the national currency against the US dollar, expressed in units of national currency per dollar.",
  debt_public_gdp: "Gross general-government debt, as a share of nominal GDP of the same year.",
  revenue_public_gdp: "Total general-government revenue, as a share of nominal GDP of the same year.",
  expenditure_public_gdp: "Total general-government expenditure, as a share of nominal GDP of the same year.",
  credit_private_gdp:
    "Outstanding bank credit to the non-financial private sector, as a share of nominal GDP of the same year. A high level and rapid growth are robust signals of financial risk in the literature (Schularick-Taylor).",
  mortgage_credit_gdp:
    "Outstanding mortgage credit (residential real-estate loans), as a share of nominal GDP of the same year.",
  bank_capital_ratio:
    "Capital ratio of the banking sector (capital relative to assets or to risk-weighted assets, depending on the source): a higher ratio indicates a better-capitalised banking system.",
  current_account_gdp:
    "Current-account balance of the balance of payments (goods, services, income, transfers), as a share of nominal GDP of the same year. Neither a large surplus nor a large deficit is intrinsically favourable: both can signal an imbalance.",
};

/** Définition d'un indicateur dans la langue active ; français = texte de l'API tel quel. */
export function indicatorDefinition(code: string, definitionFr: string, lang: Lang): string {
  return lang === "fr" ? definitionFr : (INDICATOR_DEFINITION_EN[code] ?? definitionFr);
}

const CENTRAL_BANK = "Central bank publication, reuse with attribution.";
const CC_BY_4 = "Free reuse with attribution (CC BY 4.0).";

interface SourceEn {
  full_name?: string;
  citation?: string;
  licence: string;
}

export const SOURCE_EN: Record<string, SourceEn> = {
  jst: {
    citation:
      'Jordà, Ò., Schularick, M., Taylor, A. M. (2017). "Macrofinancial History and the New Business Cycle Facts." NBER Macroeconomics Annual 2016, vol. 31, 213-263. Release 6 (2022), 18 advanced economies since 1870.',
    licence: "Non-commercial use, attribution required, share-alike (CC BY-NC-SA).",
  },
  maddison: { licence: CC_BY_4 },
  bis_cbpol: { licence: "Reuse with attribution, BIS Data Portal terms." },
  bis_credit: { licence: "Reuse with attribution, BIS Data Portal terms." },
  bis_pp: { licence: "Reuse with attribution, BIS Data Portal terms." },
  imf_ifs: { licence: "Reuse with attribution, IMF Data terms." },
  imf_weo: { licence: "Reuse with attribution, IMF Data terms." },
  imf_ghd: {
    citation:
      'International Monetary Fund, Global Debt Database; Abbas, S. M. A. et al. (2010), "A Historical Public Debt Database", IMF Working Paper 10/245.',
    licence: "Reuse with attribution, IMF Data terms.",
  },
  oecd_mei: { licence: "Reuse with attribution, OECD Data terms." },
  eurostat: {
    citation: "Eurostat, European statistical database.",
    licence: "Reuse with attribution, Eurostat licence policy.",
  },
  riksbank_hms: { licence: CENTRAL_BANK },
  norges_hms: { licence: CENTRAL_BANK },
  boe_millennium: { licence: CENTRAL_BANK },
  owid: { licence: CC_BY_4 },
  rr_crises: {
    full_name: "Reinhart & Rogoff — crisis chronology",
    citation:
      "Reinhart, C. M. and Rogoff, K. S. (2009). This Time Is Different: Eight Centuries of Financial Folly. Associated data.",
    licence: "Academic research data, reuse with attribution.",
  },
  events_manual: {
    full_name: "Repository YAML files — manually curated events",
    citation:
      "Internal MacroLens curation from widely established historical facts (wars, monetary regimes, oil shocks). Each individual event carries its own verified source_url — see data/events/*.yaml. Never serves as a source for a numeric value in `observations` (rule 2, CLAUDE.md).",
    licence: "N/A — internal curation, no third-party data redistributed.",
  },
};

export interface SourceTexts {
  full_name: string;
  citation: string;
  licence: string;
}

/** Nom, citation et licence d'une source dans la langue active (repli : texte de l'API). */
export function sourceTexts(
  source: { id: string; full_name: string; citation: string; licence: string },
  lang: Lang,
): SourceTexts {
  const en = lang === "en" ? SOURCE_EN[source.id] : undefined;
  return {
    full_name: en?.full_name ?? source.full_name,
    citation: en?.citation ?? source.citation,
    licence: en?.licence ?? source.licence,
  };
}
