/** Toutes les chaînes d'interface, FR/EN, une entrée par usage (§ru — décision
 * Phase 7 : voir docs/decisions/0006-bilinguisme-fr-en.md). Pas de système de
 * clés par chaîne de caractères : chaque entrée est un objet `{fr, en}`
 * référencé directement, donc une faute de frappe dans une clé est une erreur
 * de compilation TypeScript, pas un fallback silencieux.
 *
 * Hors périmètre, documenté dans docs/limitations.md : les messages d'erreur
 * renvoyés par l'API (détails de validation FastAPI/Pydantic) restent dans la
 * langue du backend ; les en-têtes de colonnes des exports CSV/TSV/JSON
 * restent fixes (interopérabilité des fichiers) ; `definition_fr` des
 * indicateurs (infobulle Couverture) n'a pas d'équivalent EN en base.
 */

import { ASSET_METHODOLOGY, ASSET_STRINGS } from "./assetStrings";

export interface Bi {
  fr: string;
  en: string;
}

export const S = {
  app: {
    viewComingSoon: {
      fr: (view: string) => `Vue « ${view} » — à venir.`,
      en: (view: string) => `"${view}" view — coming soon.`,
    },
  },

  titleBar: {
    title: { fr: "MacroLens 1.0", en: "MacroLens 1.0" },
  },

  toolbar: {
    modeAriaLabel: { fr: "Mode de recherche", en: "Search mode" },
    modeAnchor: { fr: "Ancre", en: "Anchor" },
    modeManual: { fr: "Manuel", en: "Manual" },
    modeShock: { fr: "Choc", en: "Shock" },
    k: { fr: "k", en: "k" },
    horizons: { fr: "Horizons", en: "Horizons" },
    metric: { fr: "Métrique", en: "Metric" },
    metricEuclidean: { fr: "Euclidienne", en: "Euclidean" },
    copyPermalinkTitle: {
      fr: "Copier le permalien de la dernière recherche (Ctrl+L)",
      en: "Copy the permalink of the last search (Ctrl+L)",
    },
    copyPermalink: { fr: "Copier le lien [Ctrl+L]", en: "Copy link [Ctrl+L]" },
    runTitle: { fr: "Rechercher (F5)", en: "Search (F5)" },
    run: { fr: "Rechercher [F5]", en: "Search [F5]" },
  },

  statusBar: {
    noBuild: { fr: "aucun build chargé", en: "no build loaded" },
    build: { fr: (id: string) => `build ${id}`, en: (id: string) => `build ${id}` },
    candidates: { fr: "candidats", en: "candidates" },
    excluded: { fr: "exclus", en: "excluded" },
    hhiCountry: { fr: "HHI pays", en: "HHI country" },
  },

  viewTabs: {
    scenario: { fr: "Scénario", en: "Scenario" },
    episode: { fr: "Épisode", en: "Episode" },
    series: { fr: "Explorateur de séries", en: "Series explorer" },
    compare: { fr: "Comparateur", en: "Compare" },
    coverage: { fr: "Couverture", en: "Coverage" },
    sources: { fr: "Sources & méthode", en: "Sources & methodology" },
    assets: { fr: "Classes d'actifs", en: "Asset classes" },
    ariaLabel: { fr: "Vues", en: "Views" },
  },

  commandPalette: {
    placeholder: { fr: "FRA 2025 · SWE 1990 vs FIN 1990", en: "FRA 2025 · SWE 1990 vs FIN 1990" },
    exampleAnchor: { fr: "PAYS ANNÉE", en: "COUNTRY YEAR" },
    exampleAnchorDesc: { fr: "ouvre le Scénario en mode ancre", en: "opens Scenario in anchor mode" },
    exampleCompare: { fr: "PAYS1 ANNÉE1 vs PAYS2 ANNÉE2", en: "COUNTRY1 YEAR1 vs COUNTRY2 YEAR2" },
    exampleCompareDesc: { fr: "ouvre le Comparateur", en: "opens Compare" },
    hint: { fr: "Entrée pour exécuter · Échap pour fermer", en: "Enter to run · Esc to close" },
  },

  common: {
    country: { fr: "Pays", en: "Country" },
    year: { fr: "Année", en: "Year" },
    loading: { fr: "Chargement…", en: "Loading…" },
    unknownError: { fr: "Erreur inconnue", en: "Unknown error" },
    weights: { fr: "Poids", en: "Weights" },
    stateVector: { fr: "Vecteur d'état", en: "State vector" },
    noSource: { fr: "aucune source", en: "no source" },
  },

  scenario: {
    panelTitle: { fr: "Scénario", en: "Scenario" },
    anchorGroupTitle: { fr: "Ancre", en: "Anchor" },
    shockGroupTitle: { fr: "Base du choc", en: "Shock base" },
    analoguesPanelTitle: { fr: "Analogues", en: "Analogs" },
    bordereauPanelTitle: { fr: "Bordereau", en: "Provenance" },
    searching: { fr: "Recherche en cours…", en: "Searching…" },
    noSearchYet: {
      fr: "Aucune recherche exécutée — choisissez une ancre (pays, année) et lancez [F5].",
      en: "No search run yet — choose an anchor (country, year) and run [F5].",
    },
    noAnalogFound: {
      fr: "Aucun analogue trouvé pour cette requête après exclusions.",
      en: "No analog found for this query after exclusions.",
    },
    fanChartPlaceholder: {
      fr: "Éventail des réalisations — apparaît après une recherche.",
      en: "Outcome fan chart — appears after a search.",
    },
    timelinePlaceholder: {
      fr: "Chronologie 1870-présent — apparaît après une recherche.",
      en: "Timeline 1870-present — appears after a search.",
    },
    bordereauPlaceholder: {
      fr: "Aucune donnée affichée — le bordereau se remplit avec la recherche.",
      en: "No data displayed yet — the provenance panel fills in with the search.",
    },
    dataUsed: { fr: (n: number) => `Données utilisées (${n})`, en: (n: number) => `Data used (${n})` },
    growthColumn: { fr: (h: number) => `ΔPIB ${h}a`, en: (h: number) => `ΔGDP ${h}y` },
    crisisColumn: { fr: (h: number) => `CB ${h}a`, en: (h: number) => `BC ${h}y` },
    tableCountry: { fr: "Pays", en: "Country" },
    tableYear: { fr: "Année", en: "Year" },
    tableSimilarity: { fr: "Sim.", en: "Sim." },
    fanChartVariableLabel: { fr: "ΔPIB cumulé, %", en: "Cumulative ΔGDP, %" },
  },

  episode: {
    expand: { fr: "Agrandir", en: "Expand" },
    collapse: { fr: "Réduire", en: "Collapse" },
    panelTitle: { fr: "Épisode", en: "Episode" },
    searchGroupTitle: { fr: "Recherche", en: "Search" },
    loadButton: { fr: "Charger", en: "Load" },
    sourcesPrefix: { fr: "Sources :", en: "Sources:" },
  },

  seriesExplorer: {
    indicatorLabel: { fr: "Indicateur", en: "Indicator" },
    periodLabel: { fr: "Période", en: "Period" },
    periodFrom: { fr: "De", en: "From" },
    periodTo: { fr: "À", en: "To" },
    periodReset: { fr: "Réinitialiser", en: "Reset" },
    scaleLabel: { fr: "Échelle", en: "Scale" },
    scaleLevel: { fr: "Niveau", en: "Level" },
    scaleLog: { fr: "Logarithmique", en: "Logarithmic" },
    scaleBase100: { fr: "Base 100", en: "Base 100" },
    scaleZscore: { fr: "Centré-réduit (z)", en: "Standardized (z)" },
    scaleLevelHelp: {
      fr: "Valeurs brutes sur un axe linéaire.",
      en: "Raw values on a linear axis.",
    },
    scaleLogHelp: {
      fr: "Axe logarithmique : des écarts verticaux égaux correspondent à des variations en pourcentage égales. Les séries à croissance lente et rapide deviennent comparables et l'histoire ancienne n'est plus écrasée.",
      en: "Logarithmic axis: equal vertical distances mean equal percentage changes. Slow and fast growers become comparable and early history is no longer flattened.",
    },
    scaleBase100Help: {
      fr: (year: number) =>
        `Chaque série est divisée par sa valeur en ${year} (première année commune à toutes les séries sélectionnées), puis multipliée par 100. Compare la croissance cumulée quelle que soit l'unité ou la devise.`,
      en: (year: number) =>
        `Each series is divided by its value in ${year} (first year common to all selected series), then multiplied by 100. Compares cumulative growth regardless of unit or currency.`,
    },
    scaleZscoreHelp: {
      fr: "(valeur − moyenne) ÷ écart-type, par série sur la période affichée. Compare la forme des séries quelle que soit leur unité ou leur amplitude.",
      en: "(value − mean) ÷ standard deviation, per series over the displayed period. Compares the shape of series regardless of unit or magnitude.",
    },
    scaleRawNote: {
      fr: "Le tableau et les exports CSV, TSV et JSON gardent les valeurs brutes.",
      en: "The table and the CSV, TSV and JSON exports keep the raw values.",
    },
    scaleUnavailableNonPositive: {
      fr: "Indisponible : une série sélectionnée contient des valeurs ≤ 0.",
      en: "Unavailable: a selected series contains values ≤ 0.",
    },
    scaleUnavailableNoCommonYear: {
      fr: "Indisponible : les séries sélectionnées n'ont aucune année commune.",
      en: "Unavailable: the selected series share no common year.",
    },
    scaleFellBack: {
      fr: "Le mode demandé est indisponible pour cette sélection : affichage en niveau.",
      en: "The requested mode is unavailable for this selection: showing levels.",
    },
    scaleBadgeBase100: {
      fr: (year: number) => `Base 100 = ${year}`,
      en: (year: number) => `Base 100 = ${year}`,
    },
    scaleBadgeZscore: { fr: "Écarts-types (z)", en: "Standard deviations (z)" },
    scaleBadgeLog: { fr: "Échelle log", en: "Log scale" },
    countriesLabel: { fr: (n: number) => `Pays (${n})`, en: (n: number) => `Countries (${n})` },
    exportCsv: { fr: "Exporter CSV", en: "Export CSV" },
    exportTsv: { fr: "Exporter TSV", en: "Export TSV" },
    exportJson: { fr: "Exporter JSON", en: "Export JSON" },
    exportPng: { fr: "Exporter PNG", en: "Export PNG" },
  },

  compare: {
    removeTitle: { fr: "Retirer", en: "Remove" },
    add: { fr: "+ Ajouter", en: "+ Add" },
    run: { fr: "Comparer", en: "Compare" },
    emptyPrompt: {
      fr: "Choisissez 2 à 6 couples (pays, année) et lancez « Comparer ».",
      en: "Choose 2 to 6 (country, year) pairs and run “Compare”.",
    },
    stateUnavailable: { fr: "Vecteur d'état indisponible", en: "State vector unavailable" },
  },

  coverage: {
    country: { fr: "Pays", en: "Country" },
    indicator: { fr: "Indicateur", en: "Indicator" },
    noData: { fr: "aucune donnée", en: "no data" },
    legend: {
      fr: "Complétude (%) des années observées par décennie. Case vide = aucune observation.",
      en: "Completeness (%) of observed years per decade. Empty cell = no observation.",
    },
  },

  sources: {
    sectionTitle: { fr: (n: number) => `Sources (${n})`, en: (n: number) => `Sources (${n})` },
    priority: { fr: "priorité", en: "priority" },
    retrievedOn: { fr: "récupéré le", en: "retrieved on" },
    methodTitle: { fr: "Méthode — résumé", en: "Methodology — summary" },
  },

  fanChart: {
    title: { fr: (v: string) => `ÉVENTAIL — ${v.toUpperCase()}`, en: (v: string) => `FAN CHART — ${v.toUpperCase()}` },
    median: { fr: "Médiane", en: "Median" },
    xAxisName: { fr: "t (années)", en: "t (years)" },
  },

  timeline: {
    titlePrefix: { fr: "Chronologie", en: "Timeline" },
    anchorTooltip: { fr: (y: number) => `Ancre ${y}`, en: (y: number) => `Anchor ${y}` },
  },

  eventFrieze: {
    title: { fr: "Frise d'événements", en: "Event timeline" },
    empty: { fr: "Aucun événement recensé sur cette fenêtre.", en: "No recorded event in this window." },
  },

  bordereau: {
    building: { fr: "Construction du bordereau…", en: "Building the provenance receipt…" },
    empty: { fr: "Aucune donnée affichée — le bordereau se remplit avec la recherche.", en: "No data displayed yet — the provenance panel fills in with the search." },
    colCountry: { fr: "Pays", en: "Country" },
    colIndicator: { fr: "Indicateur", en: "Indicator" },
    colPeriod: { fr: "Période", en: "Period" },
    colValue: { fr: "Valeur", en: "Value" },
    colSource: { fr: "Source", en: "Source" },
    colFile: { fr: "Fichier", en: "File" },
    colFlags: { fr: "Flags", en: "Flags" },
    flagInterpolated: { fr: "interpolé", en: "interpolated" },
    flagSpliced: { fr: "raccordé", en: "spliced" },
    flagBreak: { fr: "rupture", en: "break" },
    flagConflict: { fr: "conflit", en: "conflict" },
    tabTable: { fr: (n: number) => `Tableau (${n})`, en: (n: number) => `Table (${n})` },
    tabSources: { fr: (n: number) => `Sources (${n})`, en: (n: number) => `Sources (${n})` },
    tabPage: { fr: "Vue source", en: "Source view" },
    noRows: { fr: "Aucune ligne dans ce bordereau.", en: "No rows in this receipt." },
    pageUnavailable: {
      fr: "Rendu de page source non disponible pour l'instant (docs/limitations.md) — la preuve est le triptyque fichier archivé + hash + locator, visible dans l'onglet Tableau.",
      en: "Source page rendering isn't available yet (docs/limitations.md) — the proof is the archived-file + hash + locator triptych, visible in the Table tab.",
    },
    rowsCount: { fr: (n: number) => `${n} lignes`, en: (n: number) => `${n} rows` },
    checksum: { fr: (h: string) => `checksum ${h}…`, en: (h: string) => `checksum ${h}…` },
  },

  weightSlider: {
    ariaLabel: { fr: (label: string) => `Poids ${label}`, en: (label: string) => `Weight ${label}` },
  },

  language: {
    fr: { fr: "FR", en: "FR" },
    en: { fr: "EN", en: "EN" },
    switchTitle: { fr: "Langue de l'interface", en: "Interface language" },
  },

  methodology: {
    stateVectorTitle: { fr: "Vecteur d'état (§8.1).", en: "State vector (§8.1)." },
    stateVectorBody: {
      fr: "Chaque observation (pays, année) est réduite à 14 features réparties en 7 familles (prix, activité, taux, dette, crédit, marchés, externe). Les features de « niveau » (ex. inflation, dette/PIB) et de « variation » (ex. accélération de l'inflation, Δ dette 5 ans) sont normalisées différemment.",
      en: "Each (country, year) observation is reduced to 14 features across 7 families (prices, activity, rates, debt, credit, markets, external). “Level” features (e.g. inflation, debt/GDP) and “variation” features (e.g. inflation acceleration, 5-year Δ debt) are normalized differently.",
    },
    normTitle: { fr: "Normalisation inter-époque (§8.2).", en: "Cross-epoch normalization (§8.2)." },
    normBody: {
      fr: "Une feature de niveau est convertie en rang percentile sur une fenêtre glissante de 30 ans, strictement rétrospective (l'année courante est exclue, minimum 20 observations valides pour produire un rang) — c'est ce qui rend le moteur anti-anticipation (« zéro extrapolation silencieuse », règle 3).",
      en: "A level feature is converted to a percentile rank over a rolling 30-year window, strictly retrospective (the current year is excluded, minimum 20 valid observations to produce a rank) — this is what makes the engine anti-lookahead (“zero silent extrapolation”, rule 3).",
    },
    normFormula1: {
      fr: "rank_level(t) = percentile_rank(valeur(t), fenêtre [t-30, t-1])",
      en: "rank_level(t) = percentile_rank(value(t), window [t-30, t-1])",
    },
    normBody2: {
      fr: "Une feature de variation est d'abord mise à l'échelle par son écart absolu médian local (MAD × 1,4826, estimateur robuste de l'écart-type), puis convertie en rang percentile de la même façon.",
      en: "A variation feature is first scaled by its local median absolute deviation (MAD × 1.4826, a robust estimator of standard deviation), then converted to a percentile rank the same way.",
    },
    normFormula2: {
      fr: "rank_variation(t) = percentile_rank(Δ(t) / (MAD × 1,4826), fenêtre)",
      en: "rank_variation(t) = percentile_rank(Δ(t) / (MAD × 1.4826), window)",
    },
    distanceTitle: { fr: "Distance pondérée (§8.3).", en: "Weighted distance (§8.3)." },
    distanceBody: {
      fr: "La proximité entre deux états est une distance euclidienne sur les rangs, pondérée par famille (poids par défaut uniformes, renormalisés à somme 1).",
      en: "Proximity between two states is a euclidean distance over ranks, weighted by family (uniform default weights, renormalized to sum 1).",
    },
    distanceFormula: {
      fr: "d(a, b) = √( Σ w_f · (rang_a,f − rang_b,f)² )",
      en: "d(a, b) = √( Σ w_f · (rank_a,f − rank_b,f)² )",
    },
    distanceBody2: {
      fr: "La similarité affichée est 100 × (1 − d), donc 100 pour un point identique à lui-même.",
      en: "The displayed similarity is 100 × (1 − d), so 100 for a point identical to itself.",
    },
    outcomesTitle: { fr: "Réalisations (§9).", en: "Outcomes (§9)." },
    outcomesBody: {
      fr: "Pour chaque horizon (1, 3, 5, 10 ans), les analogues retenus donnent une distribution empirique — médiane, quartiles, part de cas négatifs — jamais une moyenne isolée ni un intervalle de confiance paramétrique (règle 5). MacroLens ne prédit rien : il rapporte ce qui a historiquement suivi les situations les plus proches (règle 4).",
      en: "For each horizon (1, 3, 5, 10 years), the retained analogs give an empirical distribution — median, quartiles, share of negative cases — never an isolated mean nor a parametric confidence interval (rule 5). MacroLens predicts nothing: it reports what historically followed the closest situations (rule 4).",
    },
  },

  maintenance: {
    title: { fr: "Site en maintenance", en: "Site under maintenance" },
    defaultMessage: {
      fr: "L'application est temporairement fermée. Merci de revenir plus tard.",
      en: "The application is temporarily closed. Please check back later.",
    },
  },

  announcement: {
    dismiss: { fr: "Masquer", en: "Dismiss" },
  },

  admin: {
    pageTitle: { fr: "Administration MacroLens", en: "MacroLens administration" },
    tokenLabel: { fr: "Jeton d'administration", en: "Admin token" },
    login: { fr: "Se connecter", en: "Log in" },
    loginError: { fr: "Jeton invalide.", en: "Invalid token." },
    loggedInAs: { fr: "Session administrateur active.", en: "Admin session active." },
    logout: { fr: "Se déconnecter", en: "Log out" },
    maintenanceModeLabel: { fr: "Mode maintenance (ferme le site)", en: "Maintenance mode (closes the site)" },
    maintenanceMessageLabel: {
      fr: "Message affiché pendant la maintenance",
      en: "Message shown during maintenance",
    },
    announcementLabel: {
      fr: "Annonce (bandeau visible par tous, optionnel)",
      en: "Announcement (banner visible to everyone, optional)",
    },
    save: { fr: "Enregistrer", en: "Save" },
    saved: { fr: "Enregistré.", en: "Saved." },
    saveError: { fr: "Échec de l'enregistrement.", en: "Failed to save." },
    backToApp: { fr: "← Retour à l'application", en: "← Back to the app" },
    analyticsTitle: { fr: "Fréquentation", en: "Analytics" },
    analyticsLoading: { fr: "Chargement…", en: "Loading…" },
    analyticsError: { fr: "Échec du chargement des statistiques.", en: "Failed to load analytics." },
    totalViews: { fr: "Vues totales", en: "Total views" },
    uniqueDevices: { fr: "Appareils uniques", en: "Unique devices" },
    last7Days: { fr: "7 derniers jours", en: "Last 7 days" },
    dailyBreakdown: { fr: "Détail par jour (30 derniers jours)", en: "Daily breakdown (last 30 days)" },
    dailyDate: { fr: "Date", en: "Date" },
    dailyViews: { fr: "Vues", en: "Views" },
    dailyUniqueDevices: { fr: "Appareils", en: "Devices" },
    dailyEmpty: { fr: "Aucune vue enregistrée pour l'instant.", en: "No views recorded yet." },
  },

  assets: ASSET_STRINGS,
  assetMethodology: ASSET_METHODOLOGY,
} as const;

export type Lang = "fr" | "en";

/** Résout une entrée bilingue (chaîne fixe ou fonction paramétrée) dans la
 * langue courante. Utiliser directement `t(S.section.clef)` ou
 * `t(S.section.clef)(arg)` pour les entrées paramétrées. */
export function resolve<T>(entry: { fr: T; en: T }, lang: Lang): T {
  return entry[lang];
}

/** Choisit entre un champ `_fr`/`_en` fourni par l'API ou un dictionnaire
 * local (pays, indicateurs, événements — tous bilingues côté backend, voir
 * docs/data-sources.md). */
export function pick(lang: Lang, fr: string, en: string): string {
  return lang === "fr" ? fr : en;
}
