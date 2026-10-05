/** Chaînes bilingues de la fonctionnalité Rendements d'actifs (ADR 0015 à 0024),
 * exposées via `S.assets` et `S.assetMethodology`. Même convention que strings.ts :
 * chaque entrée est un objet `{fr, en}` référencé directement.
 *
 * Vocabulaire : le produit décrit ce qui s'est produit (tests/vocabulary.test.ts
 * interdit tout le champ lexical de l'anticipation, même nié). */

export const ASSET_STRINGS = {
  // ---- bloc Scénario ----
  blockTitle: {
    fr: "Ce qui s'est produit pour les actifs après chaque précédent",
    en: "What assets did after each precedent",
  },
  blockSubtitle: {
    fr: "Rendements réels en monnaie locale. Médiane des analogues, jamais une moyenne.",
    en: "Real returns in local currency. Median across analogues, never a mean.",
  },
  metricAria: { fr: "Mesure affichée", en: "Displayed measure" },
  metricCumulative: { fr: "Cumulé", en: "Cumulative" },
  metricAnnualised: { fr: "Annualisé", en: "Annualised" },
  metricDrawdown: { fr: "Repli maximal", en: "Max drawdown" },
  classColumn: { fr: "Classe d'actifs", en: "Asset class" },
  horizonYears: { fr: (h: number) => `${h} ans`, en: (h: number) => `${h}Y` },
  iqr: { fr: "Q1 à Q3", en: "IQR" },
  nOf: {
    fr: (n: number, total: number) => `N = ${n} sur ${total}`,
    en: (n: number, total: number) => `N = ${n} of ${total}`,
  },
  positiveOf: {
    fr: (k: number, n: number) => `${k} sur ${n} positifs`,
    en: (k: number, n: number) => `${k} of ${n} positive`,
  },
  extreme: {
    fr: (k: number) => `${k} épisode${k > 1 ? "s" : ""} extrême${k > 1 ? "s" : ""} inclus`,
    en: (k: number) => `${k} extreme episode${k > 1 ? "s" : ""} included`,
  },
  interpolated: {
    fr: (k: number) => `${k} avec années interpolées par JST`,
    en: (k: number) => `${k} with years interpolated by JST`,
  },
  notAvailable: { fr: "non disponible", en: "not available" },
  notAvailableAtDate: { fr: "non disponible à cette date", en: "not available at this date" },
  noCountrySeries: { fr: "aucune série pour ce pays", en: "no series for this country" },
  exclusionBeforeStart: { fr: "avant le début de la série", en: "before the series starts" },
  exclusionTruncatedEnd: {
    fr: "fenêtre coupée par la fin des données",
    en: "window cut by the end of the data",
  },
  exclusionGap: { fr: "trou dans la série", en: "gap in the series" },
  exclusionNoSeries: { fr: "aucune série pour ce pays", en: "no series for this country" },
  excludedBecause: { fr: "Exclus :", en: "Excluded:" },
  sectionHousing: {
    fr: "Immobilier : la série la moins fiable du jeu",
    en: "Housing: the least reliable series in the set",
  },
  sectionFx: {
    fr: "Change : nominal, séparé du rendement des actifs",
    en: "FX: nominal, kept separate from asset returns",
  },
  sectionInflation: {
    fr: "Inflation : variation des prix, nominale",
    en: "Inflation: price change, nominal",
  },
  pegged: {
    fr: (k: number, n: number) =>
      `${k} fenêtre${k > 1 ? "s" : ""} sur ${n} sous étalon-or ou Bretton Woods : série plate puis discontinue aux dévaluations`,
    en: (k: number, n: number) =>
      `${k} of ${n} window${n > 1 ? "s" : ""} under the gold standard or Bretton Woods: flat series, then jumps at devaluations`,
  },
  tierBadge: { fr: (tier: number) => `T${tier}`, en: (tier: number) => `T${tier}` },
  tierTitle: {
    fr: (tier: number) => `Tier ${tier} : voir l'onglet Sources & méthode`,
    en: (tier: number) => `Tier ${tier}: see the Sources & methodology tab`,
  },
  provenance: {
    fr: (first: number, last: number) =>
      `Source JST R6, tier 1, ${first} à ${last}. Rendements réels (1 + r) / (1 + inflation) - 1. Aucune valeur imputée : N baisse quand une fenêtre est incomplète.`,
    en: (first: number, last: number) =>
      `Source JST R6, tier 1, ${first} to ${last}. Real returns (1 + r) / (1 + inflation) - 1. No value imputed: N drops when a window is incomplete.`,
  },
  drawdownNote: {
    fr: "Repli mesuré en fin d'année : c'est un minorant du repli réel.",
    en: "Drawdown measured at year end: a lower bound on the true drawdown.",
  },
  loading: { fr: "Chargement des rendements d'actifs…", en: "Loading asset returns…" },
  unavailable: {
    fr: "Rendements d'actifs indisponibles pour l'instant. Le reste de la page n'est pas affecté.",
    en: "Asset returns are unavailable right now. The rest of the page is not affected.",
  },
  openAssetClasses: { fr: "Classes d'actifs →", en: "Asset classes →" },
  chartTitle: {
    fr: "Trajectoire médiane sur 10 ans, rendement réel cumulé",
    en: "Median 10-year path, cumulative real return",
  },
  chartNote: {
    fr: (n: number) => `Bande = Q1 à Q3. Seuls comptent les précédents à fenêtre complète (N = ${n}).`,
    en: (n: number) => `Band = Q1 to Q3. Only precedents with a complete window count (N = ${n}).`,
  },
  chartMedian: { fr: "Médiane", en: "Median" },
  chartBand: { fr: "Q1 à Q3", en: "Q1 to Q3" },

  // ---- page Classes d'actifs ----
  pageControls: { fr: "Paramètres", en: "Settings" },
  country: { fr: "Pays", en: "Country" },
  from: { fr: "De", en: "From" },
  to: { fr: "À", en: "To" },
  tiers: { fr: "Tiers", en: "Tiers" },
  basis: { fr: "Rendement", en: "Return" },
  basisReal: { fr: "Réel", en: "Real" },
  basisNominal: { fr: "Nominal", en: "Nominal" },
  colAsset: { fr: "Classe d'actifs", en: "Asset class" },
  colTier: { fr: "Tier", en: "Tier" },
  colCoverage: { fr: "Couverture", en: "Coverage" },
  colLevel: { fr: "Niveau", en: "Level" },
  colChange: { fr: "Variation", en: "Change" },
  colAnnualised: { fr: "Annualisé", en: "Annualised" },
  colDrawdown: { fr: "Repli max.", en: "Max drawdown" },
  expand: { fr: "Déplier", en: "Expand" },
  collapse: { fr: "Replier", en: "Collapse" },
  levelRealIndex: { fr: "indice réel, base 100", en: "real index, base 100" },
  levelNominalIndex: { fr: "indice nominal", en: "nominal index" },
  levelLocalPerUsd: { fr: "monnaie locale par USD", en: "local currency per USD" },
  levelCpi: { fr: "indice des prix", en: "price index" },
  window: {
    fr: (a: number, b: number) => `${a} à ${b}`,
    en: (a: number, b: number) => `${a} to ${b}`,
  },
  partialCoverage: {
    fr: (a: number, b: number) => `couverture partielle : ${a} à ${b}`,
    en: (a: number, b: number) => `partial coverage: ${a} to ${b}`,
  },
  gapsIn: {
    fr: (list: string) => `trou dans la période (${list}) : variation non calculée, jamais comblée`,
    en: (list: string) => `gap in the period (${list}): change not computed, never filled`,
  },
  excludedRow: { fr: "exclu", en: "excluded" },
  pageLoading: { fr: "Chargement…", en: "Loading…" },
  pageIntro: {
    fr: "Niveau absolu et variation de chaque classe d'actifs sur la période choisie. Chaque ligne porte son tier et sa fenêtre de couverture ; une ligne sans donnée dit pourquoi, elle n'affiche jamais zéro.",
    en: "Absolute level and change of each asset class over the chosen period. Every row carries its tier and coverage window; a row without data says why and never shows zero.",
  },
  prefilteredFrom: {
    fr: (c: string, y: number) => `Pré-filtré sur le scénario : ${c} ${y}`,
    en: (c: string, y: number) => `Pre-filtered from the scenario: ${c} ${y}`,
  },

  // ---- Explorateur de séries ----
  explorerOverlayTitle: { fr: "Superposer des séries", en: "Overlay series" },
  explorerMacroGroup: { fr: "Séries macro", en: "Macro series" },
  explorerAssetGroup: { fr: "Classes d'actifs (JST, tier 1)", en: "Asset classes (JST, tier 1)" },
  explorerMixedUnits: {
    fr: "Unités différentes : l'échelle centrée-réduite rend les séries comparables.",
    en: "Different units: the standardized scale makes the series comparable.",
  },
  explorerUseZ: { fr: "Centrer-réduire", en: "Standardize" },
  explorerAssetError: {
    fr: "Séries d'actifs indisponibles pour l'instant. Les séries macro ne sont pas affectées.",
    en: "Asset series are unavailable right now. Macro series are not affected.",
  },
  explorerAssetUnit: { fr: "% par an", en: "% per year" },
} as const;

export const ASSET_METHODOLOGY = {
  title: { fr: "Rendements d'actifs", en: "Asset returns" },
  intro: {
    fr: "Ce que chaque classe d'actifs a réellement donné après chaque précédent : un rendement observé, avec sa provenance.",
    en: "What each asset class actually delivered after each precedent: an observed return, with its provenance.",
  },
  realTitle: { fr: "Rendements réels.", en: "Real returns." },
  realBody: {
    fr: "Chaque rendement nominal est déflaté par l'inflation du pays et de l'année avec la relation de Fisher exacte, jamais par une soustraction qui s'écarte beaucoup dès que l'inflation dépasse quelques pourcents.",
    en: "Each nominal return is deflated by that country-year's inflation using the exact Fisher relation, never a subtraction that diverges widely once inflation exceeds a few percent.",
  },
  realFormula: {
    fr: "réel = (1 + nominal) / (1 + inflation) - 1",
    en: "real = (1 + nominal) / (1 + inflation) - 1",
  },
  totalTitle: { fr: "Rendements totaux.", en: "Total returns." },
  totalBody: {
    fr: "Dividendes, coupons et loyers imputés inclus, tels que JST les définit. Une série de prix seule, si elle est ajoutée un jour, sera étiquetée comme telle et jamais mêlée à un rendement total sans marqueur.",
    en: "Dividends, coupons and imputed rents included, as JST defines them. A price-only series, if one is ever added, will be labelled as such and never mixed with a total return without a marker.",
  },
  localTitle: { fr: "Monnaie locale.", en: "Local currency." },
  localBody: {
    fr: "Le rendement d'un actif est dans la monnaie du pays. Le change est une ligne séparée, nominale : le choix de couvrir ou non appartient au gérant.",
    en: "An asset's return is in the country's own currency. FX is a separate, nominal row: whether to hedge is the portfolio manager's call.",
  },
  noImputeTitle: { fr: "Aucune imputation.", en: "No imputation." },
  noImputeBody: {
    fr: "Un rendement manquant n'est ni interpolé ni reporté. Si une année manque dans la fenêtre d'un précédent, il sort du calcul et N baisse. Les fenêtres coupées par la fin des données (2020) sont exclues, jamais affichées partielles.",
    en: "A missing return is neither interpolated nor carried forward. If a year is missing in a precedent's window, it drops out and N falls. Windows cut by the end of the data (2020) are excluded, never shown partial.",
  },
  medianTitle: { fr: "Médiane, sans écrêtage.", en: "Median, no trimming." },
  medianBody: {
    fr: "La médiane est le chiffre de tête. Aucune valeur aberrante n'est retirée : l'Allemagne de 1923 reste dans les données, signalée comme épisode extrême (rendement réel annuel inférieur ou égal à -50 % ou supérieur ou égal à +100 %, ou inflation supérieure ou égale à 100 % par an).",
    en: "The median is the headline figure. No outlier is removed: Germany 1923 stays in the data, flagged as an extreme episode (annual real return at or below -50% or at or above +100%, or inflation at or above 100% a year).",
  },
  drawdownTitle: { fr: "Repli maximal.", en: "Maximum drawdown." },
  drawdownBody: {
    fr: "Pire écart entre un pic et le creux suivant sur la fenêtre. Mesuré en fin d'année, c'est un minorant du repli réel.",
    en: "Worst peak-to-trough fall within the window. Measured at year end, it is a lower bound on the true drawdown.",
  },
  tiersTitle: { fr: "Tiers.", en: "Tiers." },
  tiersBody: {
    fr: "Tier 1 : JST, 1870 à 2020, actions, obligations d'État, bons du Trésor, immobilier, change et inflation (le Canada n'a aucune série de rendement dans JST). Tiers 2 et 3 (matières premières, secteurs, crédit) : rien n'est ingéré à ce jour, parce qu'aucune source gratuite, citable et reproductible ne l'a permis telle quelle. Les lignes correspondantes de la page Classes d'actifs disent « non disponible » et pourquoi.",
    en: "Tier 1: JST, 1870 to 2020, equities, government bonds, bills, housing, FX and inflation (Canada has no return series in JST). Tiers 2 and 3 (commodities, sectors, credit): nothing is ingested yet, because no free, citable, reproducible source allowed it as is. The matching rows on the Asset classes page say “not available” and why.",
  },
  excludedSourcesTitle: { fr: "Sources écartées.", en: "Sources ruled out." },
  excludedSourcesBody: {
    fr: "S&P GSCI (propriétaire, redistribution interdite), Moody's Aaa et Baa (copie, stockage et redistribution interdits), ICE BofA (reproduction interdite, historique limité à 3 ans sur FRED depuis avril 2026).",
    en: "S&P GSCI (proprietary, redistribution prohibited), Moody's Aaa and Baa (copying, storage and redistribution prohibited), ICE BofA (reproduction prohibited, history limited to 3 years on FRED since April 2026).",
  },
  privateTitle: {
    fr: "Private equity et dette privée : exclus.",
    en: "Private equity and private debt: excluded.",
  },
  privateBody: {
    fr: "Aucune série gratuite, reproductible et valorisée au prix de marché n'existe. Les indices de référence sont propriétaires et lissés par des valorisations d'expert, ce qui contredit tout ce que ce produit affirme ailleurs. Un proxy coté, s'il est ajouté un jour, sera étiqueté comme tel et jamais présenté comme du marché privé.",
    en: "No free, reproducible, mark-to-market series exists. The reference indices are proprietary and smoothed by appraisal-based valuations, which contradicts everything else this product claims. A listed proxy, if ever added, will be labelled as such and never presented as private-market returns.",
  },
  licenceTitle: { fr: "Licence et citation.", en: "Licence and citation." },
  licenceBody: {
    fr: "Ce projet est personnel, intellectuel et non commercial. JST est diffusé sous licence CC BY-NC-SA (usage non commercial, attribution, partage à l'identique) et les valeurs dérivées affichées ici sont partagées dans les mêmes conditions. Pour toute donnée de rendements, JST demande de citer Jordà, Knoll, Kuvshinov, Schularick et Taylor (2019), « The Rate of Return on Everything, 1870-2015 », Quarterly Journal of Economics 134(3), 1225-1298.",
    en: "This project is personal, intellectual and non-commercial. JST is released under CC BY-NC-SA (non-commercial use, attribution, share-alike) and the derived values shown here are shared on the same terms. For any returns data, JST asks to cite Jordà, Knoll, Kuvshinov, Schularick and Taylor (2019), “The Rate of Return on Everything, 1870-2015”, Quarterly Journal of Economics 134(3), 1225-1298.",
  },
} as const;
