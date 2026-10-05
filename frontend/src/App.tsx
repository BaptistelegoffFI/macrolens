import { useEffect, useMemo, useState } from "react";

import { getState, getStatus, recordView } from "./api/endpoints";
import type { AnalogOut, AnalogsSearchRequest, StateVectorOut, StatusOut } from "./api/types";
import styles from "./App.module.css";
import { FanChart } from "./components/charts/FanChart";
import { Timeline } from "./components/charts/Timeline";
import { BordereauPanel } from "./components/provenance/BordereauPanel";
import { AssetReturnsBlock } from "./components/scenario/AssetReturnsBlock";
import { FeatureValueInputs } from "./components/scenario/FeatureValueInputs";
import { WeightSlider } from "./components/scenario/WeightSlider";
import { CommandPalette } from "./components/shell/CommandPalette";
import { EmptyState } from "./components/shell/EmptyState";
import { FailSafe } from "./components/shell/FailSafe";
import { Panel } from "./components/shell/Panel";
import { ResizableColumns } from "./components/shell/ResizableColumns";
import { ResizableRows } from "./components/shell/ResizableRows";
import { StatusBar } from "./components/shell/StatusBar";
import { Toolbar } from "./components/shell/Toolbar";
import { useToolbarState } from "./components/shell/useToolbarState";
import type { ToolbarState } from "./components/shell/useToolbarState";
import { WindowShell } from "./components/shell/WindowShell";
import { Num } from "./components/table/Num";
import type { ColumnDef } from "./components/table/Table";
import { Table } from "./components/table/Table";
import { useAnalogsSearch } from "./hooks/useAnalogsSearch";
import { useProvenanceReceipt } from "./hooks/useProvenanceReceipt";
import { useLanguage } from "./i18n/LanguageContext";
import { S } from "./i18n/strings";
import type { ParsedCommand } from "./lib/commandParser";
import { FAMILY_LABELS, FEATURE_FAMILIES, featuresByFamily } from "./lib/features";
import type { FeatureFamily } from "./lib/features";
import { getClientId } from "./lib/clientId";
import { readPermalinkParam, setPermalinkParam } from "./lib/permalink";
import { keysForAnalogsSearch } from "./lib/provenanceKeys";
import { AssetClassesView } from "./views/AssetClassesView";
import type { AssetClassesPrefill } from "./views/AssetClassesView";
import { CompareView } from "./views/CompareView";
import { CoverageView } from "./views/CoverageView";
import { EpisodeView } from "./views/EpisodeView";
import { SeriesExplorerView } from "./views/SeriesExplorerView";
import { SourcesView } from "./views/SourcesView";

const SHORTCUT_TO_VIEW: Record<string, string> = {
  F2: "scenario",
  F3: "episode",
  F4: "series",
  F6: "compare",
  F7: "coverage",
  F8: "sources",
  F9: "assets",
};

interface ScenarioViewProps {
  toolbar: ToolbarState;
  country: string;
  year: number;
  onCountryChange: (v: string) => void;
  onYearChange: (v: number) => void;
  manualValues: Record<string, number>;
  onManualChange: (code: string, raw: string) => void;
  shockDeltas: Record<string, number>;
  onShockChange: (code: string, raw: string) => void;
  weights: Record<FeatureFamily, number> | null;
  onWeightChange: (family: FeatureFamily, value: number) => void;
  search: ReturnType<typeof useAnalogsSearch>;
  onOpenAssetClasses: (anchor: { country: string; year: number } | null) => void;
}

function ScenarioView({
  toolbar,
  country,
  year,
  onCountryChange,
  onYearChange,
  manualValues,
  onManualChange,
  shockDeltas,
  onShockChange,
  weights,
  onWeightChange,
  search,
  onOpenAssetClasses,
}: ScenarioViewProps) {
  const { t, lang } = useLanguage();
  const { data, loading, error } = search;
  const horizons = toolbar.horizons;
  const lastHorizon = horizons[horizons.length - 1];

  // Rendements d'actifs (ADR 0015 à 0024) : les analogues déjà trouvés, rien d'autre.
  const assetAnalogs = useMemo(
    () => data?.analogs.map((a) => ({ country: a.country, year: a.year })) ?? null,
    [data],
  );
  const assetAnchor =
    data?.query_echo.mode === "anchor" && data.query_echo.anchor ? data.query_echo.anchor : null;

  // §8.2.5 : double affichage obligatoire — le panneau Scénario montre le
  // vecteur d'état (brut + rang) de la requête elle-même, pas seulement des
  // champs de saisie. Recalculé depuis query_echo (la requête normalisée
  // par le serveur), pas depuis l'état local du formulaire, qui a pu
  // changer depuis la dernière recherche exécutée.
  const [queryState, setQueryState] = useState<StateVectorOut | null>(null);
  useEffect(() => {
    if (data?.query_echo.mode === "anchor" && data.query_echo.anchor) {
      getState(data.query_echo.anchor.country, data.query_echo.anchor.year, data.query_echo.reference_frame)
        .then(setQueryState)
        .catch(() => setQueryState(null));
    } else {
      setQueryState(null);
    }
  }, [data]);

  const columns: ColumnDef<AnalogOut>[] = useMemo(() => {
    const base: ColumnDef<AnalogOut>[] = [
      { key: "country", label: t(S.scenario.tableCountry), accessor: (r) => r.country },
      { key: "year", label: t(S.scenario.tableYear), numeric: true, decimals: 0, accessor: (r) => r.year },
      { key: "similarity", label: t(S.scenario.tableSimilarity), numeric: true, decimals: 1, accessor: (r) => r.similarity },
    ];
    const growthCols: ColumnDef<AnalogOut>[] = horizons.map((h) => ({
      key: `growth_${h}`,
      label: t(S.scenario.growthColumn)(h),
      numeric: true,
      decimals: 1,
      sign: true,
      accessor: (r) => r.outcomes[String(h)]?.out_growth_cum ?? null,
      tone: () => "auto",
    }));
    const crisisCol: ColumnDef<AnalogOut> | null = lastHorizon
      ? {
          key: "crisis",
          label: t(S.scenario.crisisColumn)(lastHorizon),
          accessor: (r) => r.outcomes[String(lastHorizon)]?.out_banking_crisis ?? null,
          render: (r) => {
            const v = r.outcomes[String(lastHorizon)]?.out_banking_crisis;
            return v === true ? (
              <span className={styles.crisisMarker}>●</span>
            ) : (
              <span className="num" style={{ color: "var(--fg-muted)" }}>
                —
              </span>
            );
          },
        }
      : null;
    return crisisCol ? [...base, ...growthCols, crisisCol] : [...base, ...growthCols];
  }, [horizons, lastHorizon, t]);

  return (
    <ResizableColumns storageKey="ml.scenario.cols" defaultWidths={[220, 760]}>
      <Panel title={t(S.scenario.panelTitle)}>
        <div className={styles.scenarioLeft}>
          {(toolbar.mode === "anchor" || toolbar.mode === "shock") && (
            <div className={styles.fieldGroup}>
              <div className={styles.fieldGroupTitle}>
                {toolbar.mode === "shock" ? t(S.scenario.shockGroupTitle) : t(S.scenario.anchorGroupTitle)}
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t(S.common.country)}</span>
                <input
                  className={styles.textInput}
                  value={country}
                  maxLength={3}
                  onChange={(e) => onCountryChange(e.target.value.toUpperCase())}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t(S.common.year)}</span>
                <input
                  className={styles.textInput}
                  type="number"
                  value={year}
                  onChange={(e) => onYearChange(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {toolbar.mode === "manual" && (
            <FeatureValueInputs values={manualValues} onChange={onManualChange} />
          )}
          {toolbar.mode === "shock" && (
            <FeatureValueInputs values={shockDeltas} onChange={onShockChange} />
          )}

          {queryState &&
            featuresByFamily(lang).map((group) => (
              <div key={group.family} className={styles.fieldGroup}>
                <div className={styles.fieldGroupTitle}>{group.label}</div>
                {group.features.map((f) => {
                  const sv = queryState.features.find((x) => x.feature_code === f.code);
                  return (
                    <div key={f.code} className={styles.field}>
                      <span className={styles.fieldLabel}>{f.label}</span>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <Num value={sv?.raw_value} decimals={2} />
                        <span className={styles.rank}>
                          r=<Num value={sv?.pct_rank} decimals={2} />
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

          <div className={styles.fieldGroup}>
            <div className={styles.fieldGroupTitle}>{t(S.common.weights)}</div>
            {FEATURE_FAMILIES.map((family) => (
              <WeightSlider
                key={family}
                label={FAMILY_LABELS[family][lang]}
                value={weights?.[family] ?? 1 / 7}
                onChange={(v) => onWeightChange(family, v)}
              />
            ))}
          </div>
        </div>
      </Panel>

      <Panel title={t(S.scenario.analoguesPanelTitle)} meta={data ? String(data.analogs.length) : "0"}>
        <ResizableRows storageKey="ml.scenario.rows" defaultHeights={[240, 460, 240]}>
          <div>
            {error && <div className={styles.errorBanner}>{error}</div>}
            {data?.warnings.map((w, i) => (
              <div key={i} className={styles.warningBanner}>
                ⚑ {w}
              </div>
            ))}
            {loading && <EmptyState>{t(S.scenario.searching)}</EmptyState>}
            {!loading && !error && !data && <EmptyState>{t(S.scenario.noSearchYet)}</EmptyState>}
            {!loading && data && data.analogs.length === 0 && (
              <EmptyState>{t(S.scenario.noAnalogFound)}</EmptyState>
            )}
            {!loading && data && data.analogs.length > 0 && (
              <Table columns={columns} rows={data.analogs} getRowKey={(r) => `${r.country}-${r.year}`} />
            )}
          </div>
          <AssetReturnsBlock
            analogs={assetAnalogs}
            anchor={assetAnchor}
            onOpenAssetClasses={onOpenAssetClasses}
          />
          {data && data.analogs.length > 0 ? (
            <FanChart data={data} variable="out_growth_cum" variableLabel={t(S.scenario.fanChartVariableLabel)} />
          ) : (
            <EmptyState>{t(S.scenario.fanChartPlaceholder)}</EmptyState>
          )}
          {data && data.analogs.length > 0 ? (
            <Timeline analogs={data.analogs} anchorYear={year} />
          ) : (
            <EmptyState>{t(S.scenario.timelinePlaceholder)}</EmptyState>
          )}
        </ResizableRows>
      </Panel>

      <Panel title={t(S.scenario.bordereauPanelTitle)}>
        <ScenarioBordereau data={data} />
      </Panel>
    </ResizableColumns>
  );
}

/** §18.6 : bouton « Données utilisées (n) » — construit le bordereau à la
 * demande à partir des couples (pays, année) réellement affichés dans le
 * tableau des analogues, jamais un sur-ensemble deviné. */
function ScenarioBordereau({ data }: { data: ReturnType<typeof useAnalogsSearch>["data"] }) {
  const { t } = useLanguage();
  const receipt = useProvenanceReceipt();
  const [opened, setOpened] = useState(false);

  if (!data) {
    return <EmptyState>{t(S.scenario.bordereauPlaceholder)}</EmptyState>;
  }

  if (!opened) {
    return (
      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 8 }}>
          {data.sources_summary.map((s) => s.id).join(", ") || t(S.common.noSource)} —{" "}
          <Num value={data.pool_size} decimals={0} /> {t(S.statusBar.candidates)}
        </div>
        <button
          type="button"
          className={styles.textInput}
          style={{ width: "100%", cursor: "pointer" }}
          onClick={() => {
            setOpened(true);
            void receipt.run({ build_id: data.build_id, keys: keysForAnalogsSearch(data) });
          }}
        >
          {t(S.scenario.dataUsed)(data.analogs.length * 10)}
        </button>
      </div>
    );
  }

  return <BordereauPanel data={receipt.data} loading={receipt.loading} error={receipt.error} />;
}

export function App() {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState("scenario");
  const [toolbar, setToolbar] = useToolbarState();
  const [country, setCountry] = useState("FRA");
  const [year, setYear] = useState(2019);
  const [weights, setWeights] = useState<Record<FeatureFamily, number> | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});
  const [shockDeltas, setShockDeltas] = useState<Record<string, number>>({});
  const [comparePairs, setComparePairs] = useState<{ country: string; year: number }[] | undefined>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assetsPrefill, setAssetsPrefill] = useState<AssetClassesPrefill | null>(null);
  const search = useAnalogsSearch();

  // §ADR 0008 — hors périmètre du plan : panneau d'administration. Un
  // sondage à intervalle plutôt qu'un seul appel au montage, pour qu'un
  // onglet déjà ouvert se ferme aussi dans un délai raisonnable quand
  // l'admin active le mode maintenance, pas seulement les nouveaux visiteurs.
  const [siteStatus, setSiteStatus] = useState<StatusOut | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  useEffect(() => {
    function poll() {
      void getStatus()
        .then(setSiteStatus)
        .catch(() => {});
    }
    poll();
    const id = window.setInterval(poll, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // §ADR 0011 — hors périmètre du plan : ping de fréquentation anonyme pour
  // le dashboard analytics admin. Une fois par montage, fire-and-forget : un
  // échec réseau ne doit jamais affecter le chargement de l'application.
  useEffect(() => {
    void recordView({ client_id: getClientId() }).catch(() => {});
  }, []);

  function setWeight(family: FeatureFamily, value: number) {
    setWeights((prev) => ({
      ...FEATURE_FAMILIES.reduce(
        (acc, f) => ({ ...acc, [f]: prev?.[f] ?? 1 / 7 }),
        {} as Record<FeatureFamily, number>,
      ),
      [family]: value,
    }));
  }

  function setFeatureValue(setter: typeof setManualValues, code: string, raw: string) {
    setter((prev) => {
      if (raw === "") {
        return Object.fromEntries(Object.entries(prev).filter(([k]) => k !== code));
      }
      const n = Number(raw);
      return Number.isNaN(n) ? prev : { ...prev, [code]: n };
    });
  }

  function buildRequest(): AnalogsSearchRequest {
    if (toolbar.mode === "anchor") {
      return {
        mode: "anchor",
        anchor: { country: country.toUpperCase(), year },
        k: toolbar.k,
        horizons: toolbar.horizons,
        weights: weights ?? undefined,
        metric: toolbar.metric,
      };
    }
    if (toolbar.mode === "manual") {
      return {
        mode: "manual",
        state: manualValues,
        k: toolbar.k,
        horizons: toolbar.horizons,
        weights: weights ?? undefined,
        metric: toolbar.metric,
      };
    }
    return {
      mode: "shock",
      shock: { base: { country: country.toUpperCase(), year }, deltas: shockDeltas },
      k: toolbar.k,
      horizons: toolbar.horizons,
      weights: weights ?? undefined,
      metric: toolbar.metric,
    };
  }

  function handleRun() {
    void search.run(buildRequest());
  }

  // §11.3 : le permalien reproduit exactement une recherche — restauré au
  // chargement si l'URL porte un paramètre `q`, puis remis à jour après
  // chaque recherche réussie via query_echo (la requête normalisée par
  // le serveur, donc fidèle même si le frontend a omis des champs par défaut).
  useEffect(() => {
    const restored = readPermalinkParam();
    if (!restored) return;
    setToolbar((t) => ({
      ...t,
      mode: restored.mode,
      k: restored.k ?? t.k,
      horizons: restored.horizons ?? t.horizons,
    }));
    if (restored.mode === "anchor" && restored.anchor) {
      setCountry(restored.anchor.country);
      setYear(restored.anchor.year);
    } else if (restored.mode === "manual" && restored.state) {
      setManualValues(restored.state);
    } else if (restored.mode === "shock" && restored.shock) {
      setCountry(restored.shock.base.country);
      setYear(restored.shock.base.year);
      setShockDeltas(restored.shock.deltas);
    }
    void search.run(restored);
    // Restauration unique au montage — ne doit pas se redéclencher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (search.data) setPermalinkParam(search.data.query_echo);
  }, [search.data]);

  // §11.3 : Ctrl+K (palette de commande), F2-F8 (vues), F5 (rechercher),
  // Ctrl+L (copier le permalien — affiché sur son bouton dans la barre
  // d'outils, §11.3 : « chaque action de barre d'outils a un raccourci »).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        copyPermalink();
        return;
      }
      if (e.key in SHORTCUT_TO_VIEW) {
        e.preventDefault();
        setActiveView(SHORTCUT_TO_VIEW[e.key]);
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        if (activeView === "scenario") handleRun();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function handleCommand(cmd: ParsedCommand) {
    if (cmd.type === "anchor") {
      setActiveView("scenario");
      setToolbar((t) => ({ ...t, mode: "anchor" }));
      setCountry(cmd.country);
      setYear(cmd.year);
      void search.run({
        mode: "anchor",
        anchor: { country: cmd.country, year: cmd.year },
        k: toolbar.k,
        horizons: toolbar.horizons,
        weights: weights ?? undefined,
        metric: toolbar.metric,
      });
    } else if (cmd.type === "compare") {
      setActiveView("compare");
      setComparePairs(cmd.pairs);
    }
  }

  // Lien « Classes d'actifs » du bloc Scénario : pays de l'ancre et dix ans de part et
  // d'autre, bornés par la couverture JST (1870 à 2020).
  function openAssetClasses(anchor: { country: string; year: number } | null) {
    setAssetsPrefill(
      anchor
        ? {
            country: anchor.country,
            anchorYear: anchor.year,
            fromYear: Math.max(1870, anchor.year - 10),
            toYear: Math.min(2020, anchor.year + 10),
          }
        : null,
    );
    setActiveView("assets");
  }

  function handleViewChange(view: string) {
    if (view !== "assets") setAssetsPrefill(null);
    setActiveView(view);
  }

  function copyPermalink() {
    void navigator.clipboard?.writeText(window.location.href);
  }

  if (siteStatus?.maintenance_mode) {
    return (
      <div className={styles.maintenancePage}>
        <div className={styles.maintenanceBox}>
          <div className={styles.maintenanceTitle}>{t(S.maintenance.title)}</div>
          <div>{siteStatus.maintenance_message || t(S.maintenance.defaultMessage)}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {siteStatus?.announcement && !announcementDismissed && (
        <div className={styles.announcementBanner}>
          <span>{siteStatus.announcement}</span>
          <button
            type="button"
            className={styles.announcementDismiss}
            onClick={() => setAnnouncementDismissed(true)}
          >
            {t(S.announcement.dismiss)}
          </button>
        </div>
      )}
      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} onExecute={handleCommand} />
      )}
      <WindowShell
        activeView={activeView}
        onViewChange={handleViewChange}
        toolbar={
          <Toolbar value={toolbar} onChange={setToolbar} onRun={handleRun} onCopyPermalink={copyPermalink} />
        }
        statusBar={
          <StatusBar
            buildId={search.data?.build_id}
            poolSize={search.data?.pool_size}
            excluded={
              search.data
                ? Object.values(search.data.excluded).reduce((a, b) => a + b, 0)
                : undefined
            }
            n={search.data?.analogs.length}
            hhiCountry={search.data?.concentration.hhi_country}
            elapsedMs={search.elapsedMs ?? undefined}
          />
        }
      >
        {activeView === "scenario" ? (
          <ScenarioView
            toolbar={toolbar}
            country={country}
            year={year}
            onCountryChange={setCountry}
            onYearChange={setYear}
            manualValues={manualValues}
            onManualChange={(code, raw) => setFeatureValue(setManualValues, code, raw)}
            shockDeltas={shockDeltas}
            onShockChange={(code, raw) => setFeatureValue(setShockDeltas, code, raw)}
            weights={weights}
            onWeightChange={setWeight}
            search={search}
            onOpenAssetClasses={openAssetClasses}
          />
        ) : activeView === "episode" ? (
          <EpisodeView />
        ) : activeView === "series" ? (
          <SeriesExplorerView />
        ) : activeView === "compare" ? (
          <CompareView externalPairs={comparePairs} />
        ) : activeView === "coverage" ? (
          <CoverageView />
        ) : activeView === "assets" ? (
          <FailSafe fallback={<EmptyState>{t(S.assets.unavailable)}</EmptyState>}>
            <AssetClassesView
              key={assetsPrefill ? `${assetsPrefill.country}-${assetsPrefill.anchorYear}` : "free"}
              prefill={assetsPrefill}
            />
          </FailSafe>
        ) : activeView === "sources" ? (
          <SourcesView />
        ) : (
          <EmptyState>{t(S.app.viewComingSoon)(activeView)}</EmptyState>
        )}
      </WindowShell>
    </>
  );
}
