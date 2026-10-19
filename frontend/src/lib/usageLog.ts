import { recordEvent } from "../api/endpoints";
import type { AnalogsSearchRequest } from "../api/types";
import { getClientId } from "./clientId";

/** Journal d'usage (ADR 0028). Ne transmet que ce qui décrit l'usage de l'outil : la vue ouverte et
 * les paramètres d'une recherche (pays, année, référentiel, k). Jamais de saisie libre ni de donnée
 * personnelle ; l'appareil est identifié par l'UUID anonyme déjà utilisé pour les visites. */

/** Étiquette courte d'une recherche, qui sert de clé de classement : « SWE 1991 » pour une ancre,
 * « SWE 1991 (choc) » pour un choc appliqué à une ancre, « manual » pour une saisie manuelle. */
export function searchLabel(request: AnalogsSearchRequest): string {
  if (request.mode === "anchor" && request.anchor) {
    return `${request.anchor.country} ${request.anchor.year}`;
  }
  if (request.mode === "shock" && request.shock) {
    return `${request.shock.base.country} ${request.shock.base.year} (shock)`;
  }
  return "manual";
}

export function searchDetail(request: AnalogsSearchRequest): string {
  const frame = request.reference_frame ?? "rolling30";
  return `mode=${request.mode} · ${frame} · k=${request.k ?? 20}`;
}

function send(kind: "page" | "search", name: string, detail?: string): void {
  void recordEvent({ client_id: getClientId(), kind, name, detail: detail ?? null }).catch(() => {});
}

export function logPage(view: string): void {
  send("page", view);
}

export function logSearch(request: AnalogsSearchRequest): void {
  send("search", searchLabel(request), searchDetail(request));
}
