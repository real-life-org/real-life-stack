import { getTypeManifest, relationAffordanceKey } from "@real-life-stack/data-interface"

import { resolveTypePresentation } from "../preview/type-presentation"
import {
  composerWidgetsFromRegister,
  hasRegisterLists,
  type EdgeEntry,
  type FieldEntry,
} from "../preview/field-register"
import type { ContentTypeConfig } from "./content-composer"
import { createComposerMapping, withGroupOptions } from "./composer-mapping"

/**
 * Die Inhaltstypen des Composers, ZUSAMMENGESETZT aus dem Typ-Register
 * (Spec 06): Widgets, Reihenfolge, Beschriftungen, Statuswerte und
 * Personenfelder aus der Feld- und Kantenliste; `submitLabel`,
 * `defaultStatus` und `groupRequired` aus `composer`. Typen ohne Feldliste
 * nehmen noch `composerWidgets` und `relationWidgets` (Regel 17).
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
  const c = darstellung.composer ?? {}
  const gemeinsam = {
    id,
    label: darstellung.label,
    icon: darstellung.badge?.icon,
    ...(c.submitLabel ? { submitLabel: c.submitLabel } : {}),
    ...(c.defaultStatus ? { defaultStatus: c.defaultStatus } : {}),
    ...(c.groupRequired ? { groupRequired: true } : {}),
  }
  if (hasRegisterLists(darstellung)) return { ...gemeinsam, ...ausFeldliste(darstellung.fields ?? [], darstellung.edges ?? []) }

  // Übergang: Typen ohne Feld- und Kantenliste (Spec 06, Regel 17).
  // peopleRelation = die Manifest-Kante, deren Composer-Widget "people" ist.
  const personenKante = (eintrag.relations ?? []).find(
    (rel) => darstellung.relationWidgets?.[relationAffordanceKey(rel)] === "people",
  )
  return {
    ...gemeinsam,
    defaultWidgets: [...(darstellung.composerWidgets ?? ["title", "text"])],
    ...(personenKante ? { peopleRelation: { predicate: personenKante.predicate } } : {}),
    ...(c.widgetLabels ? { widgetLabels: { ...c.widgetLabels } } : {}),
    ...(c.statusOptions ? { statusOptions: [...c.statusOptions] } : {}),
  }
}

/**
 * Spec 06, Feld- und Kantenregister, Regel 16: `defaultWidgets` in der
 * Reihenfolge der Meta-Box, `peopleRelations` aus den Personen-Kanten der
 * Meta-Box, `statusOptions` aus dem `status`-Feld, `widgetLabels` aus
 * `label`, das Body-Feld aus dem `text`-Feld (Regel 5).
 */
function ausFeldliste(
  fields: readonly FieldEntry[],
  edges: readonly EdgeEntry[],
): Pick<ContentTypeConfig, "defaultWidgets" | "peopleRelations" | "statusOptions" | "widgetLabels" | "textField"> {
  const widgetLabels: Record<string, string> = {}
  for (const field of fields) {
    if (field.label && !(field.widget in widgetLabels)) widgetLabels[field.widget] = field.label
  }
  // Nur Kanten, die das Item selbst trägt: Der Composer schreibt eingebettete
  // Relationen; Record-Kanten (attends) schreibt die Selbstaktion (S2).
  const peopleRelations = edges
    .filter((e) => e.widget === "people" && e.pos === "meta" && e.storage === "embedded" && e.itemRole === "from")
    .map((e) => ({
      predicate: e.predicate,
      label: e.label,
      ...(e.qualifier ? { qualifier: { key: e.qualifier.key, values: e.qualifier.values.map((v) => ({ id: v.id, label: v.label })) } } : {}),
      ...(e.add ? { placeholder: e.add } : {}),
    }))
  const status = fields.find((x) => x.widget === "status" && x.options && x.options.length > 0)
  const body = fields.find((x) => x.widget === "text" && x.pos === "content")
  return {
    defaultWidgets: composerWidgetsFromRegister(fields, edges),
    ...(peopleRelations.length > 0 ? { peopleRelations } : {}),
    ...(status ? { statusOptions: status.options!.map((o) => ({ id: o.id, label: o.label })) } : {}),
    ...(Object.keys(widgetLabels).length > 0 ? { widgetLabels } : {}),
    ...(body && (body.key === "content" || body.key === "description") ? { textField: body.key } : {}),
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
