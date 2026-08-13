import { apiGet, apiPost } from "./client";
import type {
  AnalogsSearchRequest,
  AnalogsSearchResponse,
  CompareRequest,
  CompareResponse,
  CountryOut,
  CoverageCellOut,
  EpisodeOut,
  EventOut,
  IndicatorOut,
  ObservationOut,
  RawFileOut,
  ReceiptRequest,
  ReceiptResponse,
  ReceiptRowOut,
  SourceOut,
  StateVectorOut,
} from "./types";

export const meta = {
  countries: () => apiGet<CountryOut[]>("/meta/countries"),
  indicators: () => apiGet<IndicatorOut[]>("/meta/indicators"),
  sources: () => apiGet<SourceOut[]>("/meta/sources"),
  coverage: () => apiGet<CoverageCellOut[]>("/meta/coverage"),
};

export function getSeries(params: {
  country: string;
  indicator: string;
  freq?: string;
  from?: number;
  to?: number;
}) {
  return apiGet<ObservationOut[]>("/series", params);
}

export function getState(country: string, year: number, referenceFrame = "rolling30") {
  return apiGet<StateVectorOut>(`/state/${country}/${year}`, { reference_frame: referenceFrame });
}

export function getEvents(params: { country?: string; kind?: string; from?: number; to?: number }) {
  return apiGet<EventOut[]>("/events", params);
}

export function searchAnalogs(request: AnalogsSearchRequest) {
  return apiPost<AnalogsSearchResponse>("/analogs/search", request);
}

export function getEpisode(country: string, year: number, referenceFrame = "rolling30") {
  return apiGet<EpisodeOut>(`/episodes/${country}/${year}`, { reference_frame: referenceFrame });
}

export function compareEpisodes(request: CompareRequest) {
  return apiPost<CompareResponse>("/compare", request);
}

export const provenance = {
  receipt: (request: ReceiptRequest) => apiPost<ReceiptResponse>("/provenance/receipt", request),
  observation: (params: { country: string; indicator: string; period: string; freq?: string }) =>
    apiGet<ReceiptRowOut>("/provenance/observation", params),
  rawFiles: () => apiGet<RawFileOut[]>("/provenance/raw-files"),
  pageUrl: (rawFileId: number, page: number) =>
    `${(import.meta.env.VITE_API_URL ?? "http://localhost:8000")}/api/v1/provenance/page/${rawFileId}/${page}`,
};
