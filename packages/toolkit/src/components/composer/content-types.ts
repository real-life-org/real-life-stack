import { getTypeManifest, relationAffordanceKey } from "@real-life-stack/data-interface"

import { resolveTypePresentation } from "../preview/type-presentation"
import type { ContentTypeConfig } from "./content-composer"
import { createComposerMapping, withGroupOptions } from "./composer-mapping"

/**
 * Die Inhaltstypen des Composers, ZUSAMMENGESETZT aus dem Typ-Register
 * (Spec 06): Beschriftung und Widget-Satz aus dem Darstellungs-Register,
 * `peopleRelation` aus den Kanten des Manifests plus `relationWidgets`, die
 * Composer-Angaben (`submitLabel`, `statusOptions`, …) aus dem
 * Darstellungseintrag.
 *
 * Bis zum 21.09.2026 stand diese Zusammensetzung in der Referenz-App
 * (`content-types.ts`), mit einer Handliste `COMPOSER_TYPE_IDS` und den
 * `APP_EXTRAS`. Damit war ein Toolkit-Typ ohne eine Zeile in der App nicht
 * erstellbar — und die Handliste war eine zweite Typ-Liste neben dem
 * Register. Jetzt gilt: **Jeder Typ des gebundenen Manifests, den das
 * Darstellungs-Register kennt, ist ein Inhaltstyp.** Einen Typ hinzufuegen
 * heisst ein Manifest-Eintrag und ein Darstellungseintrag, sonst nichts.
 */
export function contentTypeFromRegister(id: string): ContentTypeConfig {
  const manifest = getTypeManifest()
  const eintrag = manifest.get(id)
  if (!eintrag) {
    throw new Error(`Inhaltstypen: "${id}" hat keinen Manifest-Eintrag (Spec 06).`)
  }
  const darstellung = resolveTypePresentation(id)
  // peopleRelation = die Manifest-Kante, deren Composer-Widget "people" ist.
  const personenKante = (eintrag.relations ?? []).find(
    (rel) => darstellung.relationWidgets?.[relationAffordanceKey(rel)] === "people",
  )
  const c = darstellung.composer ?? {}
  return {
    id,
    label: darstellung.label,
    icon: darstellung.badge?.icon,
    defaultWidgets: [...(darstellung.composerWidgets ?? ["title", "text"])],
    ...(personenKante ? { peopleRelation: { predicate: personenKante.predicate } } : {}),
    ...(c.submitLabel ? { submitLabel: c.submitLabel } : {}),
    ...(c.widgetLabels ? { widgetLabels: { ...c.widgetLabels } } : {}),
    ...(c.statusOptions ? { statusOptions: [...c.statusOptions] } : {}),
    ...(c.defaultStatus ? { defaultStatus: c.defaultStatus } : {}),
    ...(c.groupRequired ? { groupRequired: true } : {}),
  }
}

/**
 * Alle Inhaltstypen, in Manifest-Reihenfolge. Nur Typen mit Darstellung:
 * Ein Typ, den keine Fläche zeigen kann, gehört nicht ins Erstellen-Menü.
 *
 * Bewusst eine Funktion, kein Schnappschuss: Das Register wird vor dem ersten
 * Render gebunden, und ein Import darf nicht früher lesen (Spec 01, Regel 3).
 */
export function contentTypesFromRegister(): ContentTypeConfig[] {
  return getTypeManifest()
    .ids.filter((id) => !resolveTypePresentation(id).generic)
    .map(contentTypeFromRegister)
}

/** Ein Inhaltstyp nach Id — `undefined`, wenn das Manifest ihn nicht kennt. */
export function resolveContentType(id: string): ContentTypeConfig | undefined {
  return getTypeManifest().has(id) ? contentTypeFromRegister(id) : undefined
}

/** Eine Teilmenge nach Ids, in Register-Reihenfolge. */
export function pickContentTypes(...ids: string[]): ContentTypeConfig[] {
  return contentTypesFromRegister().filter((t) => ids.includes(t.id))
}

/**
 * Die geteilte Abbildung Composer ↔ Item, gebunden an das Register statt an
 * eine Liste: Der Resolver liest bei jedem Aufruf, folgt also einem später
 * gebundenen Manifest.
 */
const abbildung = createComposerMapping(resolveContentType)
export const mapComposerSubmission = abbildung.mapSubmission
export const itemToComposerData = abbildung.editInitialData
export { withGroupOptions }
