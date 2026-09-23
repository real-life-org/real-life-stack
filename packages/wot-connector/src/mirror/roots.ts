/**
 * Die benannten Wurzeln des Home-Docs (Spec 09 §Ablage und Registry, Fassung
 * rls#354; Adapter-Capability `NamedRootsCapable` aus web-of-trust#370).
 *
 * Warum überhaupt eine Wurzel: der Space-Doc-Baum unter `data` ist in Yjs ein
 * Geflecht aus Registern. Eine verschachtelte Map, die zwei Geräte NEBENLÄUFIG
 * erstmalig anlegen, ist genau so ein Register — eine gewinnt, die andere geht
 * samt Unterbaum verloren, und ein so verlorener Widerruf kippt den
 * Freigabestatus zurück auf `accepted` (rls#353). Eine benannte Wurzel dagegen
 * stellt das CRDT bereit (`doc.getMap(name)`); sie wird nie von einem Gerät
 * angelegt und kann deshalb bei der Erstanlage nichts verlieren.
 *
 * Ohne die Capability (`hasNamedRoots` false, heute: Automerge) gibt es KEINEN
 * Ersatzweg über `data` — genau dessen Erstanlage-Verlust ist der Grund für die
 * Wurzeln. Der Connector bleibt dann fail-closed (Spec 09: „schreibt der
 * Connector keine Registry und meldet Freigaben als nicht verfügbar").
 */
import type { MirrorRegistryContribution } from "../types.js"

/** Die benannte Wurzel der Mirror-Registry im Home-Doc. */
export const MIRROR_REGISTRY_ROOT = "mirrorRegistry"

/**
 * Die Bestandsmarke aus Spec 12 Regel 5 — als RESERVIERTER Schlüssel in
 * derselben Wurzel wie die Gerätebeiträge, nicht in einer eigenen Wurzel.
 *
 * Grund: `NamedRootsCapable` bietet `transactRoot(name, fn)` je Wurzel an, also
 * keine Transaktion ÜBER zwei Wurzeln (adapter-yjs 0.2.9: jeder Aufruf öffnet
 * seine eigene `doc.transact`). Der Bestandsdurchlauf muss aber Beiträge und
 * Marke atomar schreiben: läge die Marke in einer zweiten Wurzel, könnte ein
 * zweites Gerät zwischen beiden Transaktionen die Marke sehen, eine Freigabe
 * widerrufen — und der halbfertige Durchlauf stellte sie wieder her.
 *
 * Der Schlüssel ist ein einelementiges JSON-Array und damit kein gültiger
 * Registry-Schlüssel (der hat drei Elemente); `groupRegistryByEntry` übergeht
 * ihn deshalb, ohne dass eine Lesestelle ihn kennen müsste. Das führende `_`
 * markiert ihn zusätzlich als adapterfremden Sonderplatz. Die Namensregel für
 * Wurzeln (`^[a-z][A-Za-z0-9]*$`) gilt für den Wurzel-NAMEN, nicht für die
 * Schlüssel darunter.
 */
export const PROFILE_MIGRATION_KEY = JSON.stringify(["_profileMigration"])

/**
 * Spec 12 Regel 5: ist `bestandAt` gesetzt, hat ein Gerät der Person die
 * Bestands-Mitgliedschaften einmalig pauschal freigegeben. Die Marke liegt im
 * Home-Doc, gilt also über alle Geräte.
 */
export interface ProfileMigrationMark {
  bestandAt?: string
}

/**
 * Der Wert-Vertrag der Wurzel: flaches JSON je Schlüssel. Unter den
 * Registry-Schlüsseln liegt ein Gerätebeitrag, unter dem reservierten Schlüssel
 * die Bestandsmarke.
 */
export type MirrorRegistryRoot = Record<string, MirrorRegistryContribution | ProfileMigrationMark>

/**
 * Die Gerätebeiträge der Wurzel — die Sicht, mit der `groupRegistryByEntry`
 * arbeitet. Der reservierte Marken-Schlüssel fällt dabei von selbst heraus (er
 * ist kein dreiteiliger Registry-Schlüssel).
 */
export function registryContributionsOf(
  root: MirrorRegistryRoot | undefined,
): Record<string, MirrorRegistryContribution> {
  return (root ?? {}) as Record<string, MirrorRegistryContribution>
}

/** Die Bestandsmarke aus der Wurzel, oder `undefined`, solange sie nicht gesetzt ist. */
export function profileMigrationMark(
  root: MirrorRegistryRoot | undefined,
): ProfileMigrationMark | undefined {
  const value = root?.[PROFILE_MIGRATION_KEY]
  if (!value || typeof value !== "object") return undefined
  const bestandAt = (value as ProfileMigrationMark).bestandAt
  return typeof bestandAt === "string" && bestandAt ? { bestandAt } : {}
}
