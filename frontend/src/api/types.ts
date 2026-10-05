/**
 * Types miroir des schémas Pydantic du backend (backend/macrolens/api/schemas/).
 * Tenus à jour à la main — pas de génération automatique pour l'instant.
 */

// ---- meta.py ----
export interface CountryOut {
  iso3: string;
  name_fr: string;
  name_en: string;
  is_core: boolean;
  in_analog_pool: boolean;
  year_min: number | null;
  year_max: number | null;
  n_observations: number;
}

export interface IndicatorOut {
  code: string;
  label_fr: string;
  label_en: string;
  family: string;
  unit: string;
  is_derived: boolean;
  derivation: string | null;
  higher_is_worse: boolean | null;
  definition_fr: string;
}

export interface SourceOut {
  id: string;
  full_name: string;
  url: string;
  citation: string;
  licence: string;
  priority: number;
  retrieved_at: string;
  file_sha256: string | null;
  notes: string | null;
}

export interface CoverageCellOut {
  country_iso3: string;
  indicator_code: string;
  decade: number;
  n_observed: number;
  n_possible: number;
  pct: number;
}

// ---- series.py ----
export interface ObservationOut {
  country_iso3: string;
  indicator_code: string;
  period_start: string;
  freq: string;
  value: number | null;
  source_id: string;
  is_interpolated: boolean;
  is_spliced: boolean;
  is_break: boolean;
  conflict: boolean;
  coverage_partial: boolean;
}

export interface StateVectorFeatureOut {
  feature_code: string;
  raw_value: number | null;
  pct_rank: number | null;
}

export interface StateVectorOut {
  country_iso3: string;
  year: number;
  reference_frame: string;
  is_complete: boolean;
  is_break: boolean;
  coverage_partial: boolean;
  features: StateVectorFeatureOut[];
  sources: SourceRefOut[];
}

// ---- events.py ----
export interface EventOut {
  id: number;
  country_iso3: string | null;
  date_start: string;
  date_end: string | null;
  kind: string;
  label_fr: string;
  label_en: string;
  severity: number | null;
  source_id: string;
  source_url: string;
  notes_fr: string | null;
}

// ---- provenance.py ----
export interface SourceRefOut {
  id: string;
  citation: string;
  url: string;
  licence: string;
}

export interface RawFileRefOut {
  filename: string;
  sha256: string;
  downloaded_at: string;
  origin_url: string;
}

export interface FlagsOut {
  interpolated: boolean;
  spliced: boolean;
  break: boolean;
  conflict: boolean;
}

export interface ReceiptRowOut {
  country: string;
  indicator: string;
  period: string;
  value: number | null;
  raw_value_text: string | null;
  unit: string;
  transform_chain: string[];
  flags: FlagsOut;
  source: SourceRefOut;
  raw_file: RawFileRefOut | null;
  locator: Record<string, unknown>;
  source_page: number | null;
}

export interface ObservationKey {
  country: string;
  indicator: string;
  period: string;
  freq?: string;
}

export interface ReceiptRequest {
  build_id: string;
  keys: ObservationKey[];
  context?: Record<string, unknown>;
}

export interface ReceiptResponse {
  build_id: string;
  generated_at: string;
  rows: ReceiptRowOut[];
  sources_summary: { id: string; n_rows: number; citation: string }[];
  checksum: string;
}

export interface RawFileOut {
  id: number;
  source_id: string;
  vintage: string;
  filename: string;
  media_type: string;
  sha256: string;
  size_bytes: number;
  origin_url: string;
  downloaded_at: string;
  archive_url: string | null;
}

// ---- analogs.py ----
export type ScenarioMode = "anchor" | "manual" | "shock";
export type ReferenceFrame = "rolling30" | "era" | "cross_section" | "pool";

export interface AnchorSpec {
  country: string;
  year: number;
}

export interface ShockSpec {
  base: AnchorSpec;
  deltas: Record<string, number>;
}

export interface FiltersSpec {
  countries?: string[] | null;
  year_min?: number;
  year_max?: number | null;
  include_breaks?: boolean;
  include_partial_coverage?: boolean;
  exclude_wartime?: boolean;
}

export interface AnalogsSearchRequest {
  mode: ScenarioMode;
  anchor?: AnchorSpec | null;
  state?: Record<string, number> | null;
  shock?: ShockSpec | null;
  k?: number;
  horizons?: number[];
  weights?: Record<string, number> | null;
  filters?: FiltersSpec;
  weighting?: "equal" | "similarity";
  metric?: "euclidean";
  reference_frame?: ReferenceFrame;
}

export interface OutcomeAggregateOut {
  n: number;
  median?: number | null;
  q1?: number | null;
  q3?: number | null;
  min?: number | null;
  max?: number | null;
  share_negative?: number | null;
  count_true?: number | null;
}

export interface ContextEventOut {
  kind: string;
  label_fr: string;
  date_start: string;
  date_end: string | null;
}

export interface AnalogOut {
  country: string;
  year: number;
  distance: number;
  similarity: number;
  feature_contributions: Record<string, number>;
  state: StateVectorFeatureOut[];
  context_events: ContextEventOut[];
  outcomes: Record<string, Record<string, number | boolean | null>>;
}

export interface ExcludedOut {
  incomplete: number;
  self_adjacent: number;
  too_recent: number;
  breaks: number;
  partial_coverage: number;
  user_excluded: number;
}

export interface ConcentrationOut {
  hhi_country: number;
  hhi_decade: number;
  n_countries: number;
  n_decades: number;
}

export interface AnalogsSearchResponse {
  build_id: string;
  query_echo: AnalogsSearchRequest;
  pool_size: number;
  excluded: ExcludedOut;
  analogs: AnalogOut[];
  aggregates: Record<string, Record<string, OutcomeAggregateOut>>;
  concentration: ConcentrationOut;
  warnings: string[];
  sources_summary: SourceRefOut[];
}

// ---- episodes.py ----
export interface EpisodeOut {
  country: string;
  year: number;
  state: StateVectorOut | null;
  series: Record<string, ObservationOut[]>;
  events: EventOut[];
  sources: SourceRefOut[];
}

export interface EpisodePair {
  country: string;
  year: number;
}

export interface CompareRequest {
  pairs: EpisodePair[];
  reference_frame?: ReferenceFrame;
}

export interface CompareResponse {
  episodes: EpisodeOut[];
}

// ---- admin.py — hors périmètre du plan, voir docs/decisions/0008 ----
export interface StatusOut {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  announcement: string | null;
}

// ---- admin.py (analytics) — hors périmètre du plan, voir docs/decisions/0011 ----
export interface ViewPing {
  client_id: string;
  path?: string | null;
}

export interface DailyCount {
  date: string;
  views: number;
  unique_devices: number;
}

export interface AnalyticsOut {
  total_views: number;
  unique_devices: number;
  views_last_7_days: number;
  unique_devices_last_7_days: number;
  daily: DailyCount[];
}

export interface EventPing {
  client_id: string;
  kind: "page" | "search";
  name: string;
  detail?: string | null;
}

export interface ActivityItem {
  at: string;
  kind: "visit" | "page" | "search";
  name: string | null;
  detail: string | null;
  device: string;
}

export interface ActivityOut {
  events: ActivityItem[];
}

export interface RankItem {
  name: string;
  count: number;
  devices: number;
}

export interface RankingsOut {
  days: number;
  pages: RankItem[];
  searches: RankItem[];
  countries: RankItem[];
}

// ---- asset_returns.py — hors périmètre du plan, voir docs/decisions/0015 à 0024 ----
export type AssetReturnBasis = "real_total_return" | "nominal_fx_return" | "cpi_change";
export type AssetSection = "core" | "housing" | "fx" | "inflation";

export interface AssetSourceRef {
  id: string;
  citation: string;
  url: string;
  licence: string;
}

export interface AssetSeriesMeta {
  series_id: string;
  asset_class: string;
  tier: number;
  measure: string;
  label_fr: string;
  label_en: string;
  caveat_fr: string | null;
  caveat_en: string | null;
  citation: string;
  source: AssetSourceRef;
  first_year: number | null;
  last_year: number | null;
}

export interface AssetCountryCoverage {
  country: string;
  first_year: number;
  last_year: number;
  n_obs: number;
}

export interface AssetQuantiles {
  median: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
}

export interface AssetExclusions {
  before_start: number;
  truncated_end: number;
  gap: number;
  no_series: number;
}

export interface AssetHorizonCell {
  horizon: number;
  n_requested: number;
  n: number;
  n_extreme: number;
  n_interpolated: number | null;
  n_pegged: number | null;
  hit_rate: number | null;
  cumulative: AssetQuantiles;
  annualised: AssetQuantiles;
  max_drawdown: AssetQuantiles | null;
  exclusions: AssetExclusions;
}

export interface AssetClassOut {
  class_id: string;
  section: AssetSection;
  return_basis: AssetReturnBasis;
  series: AssetSeriesMeta;
  countries: AssetCountryCoverage[];
  cells: AssetHorizonCell[];
}

export interface AssetPathPoint {
  step: number;
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
}

export interface AssetForwardPath {
  class_id: string;
  horizon: number;
  points: AssetPathPoint[];
}

export interface AssetReturnsRequest {
  analogs: { country: string; year: number }[];
  horizons?: number[];
}

export interface AssetReturnsResponse {
  schema_version: string;
  tier: number;
  n_analogs: number;
  horizons: number[];
  classes: AssetClassOut[];
  forward_paths: AssetForwardPath[];
}

export interface AssetSeriesPoint {
  year: number;
  value: number | null;
  nominal: number | null;
  real: number | null;
  level: number | null;
  interpolated: boolean;
}

export interface AssetRangeSummary {
  available: boolean;
  start_year: number | null;
  end_year: number | null;
  partial_coverage: boolean;
  gaps: { start_year: number; end_year: number }[];
  n_obs: number;
  level_kind: "real_index" | "local_per_usd" | "cpi_index";
  level_start: number | null;
  level_end: number | null;
  change: number | null;
  annualised: number | null;
  nominal_level_end: number | null;
  nominal_change: number | null;
  nominal_annualised: number | null;
  max_drawdown: number | null;
}

export interface AssetCountrySeries {
  series: AssetSeriesMeta;
  headline: "real_return" | "nominal_fx_return" | "inflation";
  points: AssetSeriesPoint[];
  summary: AssetRangeSummary;
}

export type AssetTreeStatus = "group" | "available" | "no_country_data" | "not_ingested" | "excluded";

export interface AssetTreeNode {
  id: string;
  label_fr: string;
  label_en: string;
  series_id: string | null;
  status: AssetTreeStatus;
  tier: number | null;
  reason_fr: string | null;
  reason_en: string | null;
  children: AssetTreeNode[];
}

export interface CountryAssetClassesResponse {
  schema_version: string;
  country: string;
  from_year: number | null;
  to_year: number | null;
  series: AssetCountrySeries[];
  tree: AssetTreeNode[];
}
