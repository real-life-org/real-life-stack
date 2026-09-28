// Der Auflöser für Kanten-Ziele und Item-Verweise — die einzige öffentliche
// Schnittstelle dafür (`resolveTarget`, seine Formen gegen den Connector und
// als Hook) und der einzige Ort, der Targets zerlegt.
//
// Spec: docs/spec/06-schema-composition.md → „Verhältnis zu Relations",
// Regel 6; docs/spec/04-items-relations-groups-spaces.md → Target-
// Konventionen (Regeln 5, 6). Den Kontext (Space des Trägers, Space-Auskunft,
// Typ der Gegenstelle) baut der Auflöser selbst über seine Kontext-Fabriken;
// Aufrufer setzen keine Kontextfelder. `check:targets` wacht darüber.

import { startTransition, useEffect, useMemo, useReducer } from "react"
import {
  hasItemGroups,
  hasItemType,
  parseLocalItemTarget,
  parseQualifiedItemTarget,
  type DataInterface,
  type Item,
} from "@real-life-stack/data-interface"

import { useOptionalConnector } from "../hooks/connector-context"

// ---------------------------------------------------------------------------
// Intern: Zerlegen

interface ParsedItemTarget {
  itemId: string
  space?: string
}

function parseItemTarget(target: unknown): ParsedItemTarget | null {
  if (typeof target !== "string" || target === "") return null
  const local = parseLocalItemTarget(target)
  if (local !== null) return local === "" ? null : { itemId: local }
  const qualified = parseQualifiedItemTarget(target)
  return qualified && qualified.itemId !== "" ? { itemId: qualified.itemId, space: qualified.homeSpaceId } : null
}

// ---------------------------------------------------------------------------
// Kontext (opak: nur die Fabriken hier bauen ihn)

const SCOPE = Symbol("TargetScope")

/** Der Kontext einer Auflösung. Opak — nur die Fabriken dieses Moduls bauen ihn. */
export interface TargetScope {
  readonly [SCOPE]: {
    /** Space des Trägers; `undefined`: keine Spaces (ein Bereich). */
    carrierSpace: string | null | undefined
    /** Space eines Kandidaten; fehlt ohne Spaces. */
    spaceOf?: (itemId: string) => string | null
    otherKind?: string
    /** Nur für `data.variantOf` alter Daten: eine bloße Id gilt als lokales Target. */
    bareId?: boolean
  }
}

export interface ScopeOptions {
  /** Typ der Gegenstelle laut Manifest (`otherKind`); `item` oder ohne Angabe: jeder Typ. */
  otherKind?: string
}

function scope(inner: TargetScope[typeof SCOPE]): TargetScope {
  return { [SCOPE]: inner }
}

function spaceOfConnector(connector: DataInterface | null): ((id: string) => string | null) | undefined {
  return connector && hasItemGroups(connector) ? (id) => connector.getItemGroupId(id) : undefined
}

/**
 * Kontext eines TRÄGER-Items: Sein Space kommt vom Connector (`item:` ist
 * space-lokal zu ihm). Ohne Spaces gibt es nur einen Bereich.
 */
export function carrierScope(connector: DataInterface | null, carrier: Pick<Item, "id">, options: ScopeOptions = {}): TargetScope {
  const spaceOf = spaceOfConnector(connector)
  return scope({ carrierSpace: spaceOf ? spaceOf(carrier.id) : undefined, spaceOf, otherKind: options.otherKind })
}

/**
 * Kontext eines Trägers in einem BEKANNTEN Space — das Formular (sein Item
 * liegt nach dem Speichern im Formular-Space) oder ein Item, dessen Space die
 * Fläche kennt. Ohne Space (`null`/`undefined`) gilt der eine Bereich:
 * lokal ja, qualifiziert nicht prüfbar.
 */
export function spaceScope(
  connector: DataInterface | null,
  space: string | null | undefined,
  options: ScopeOptions & {
    /**
     * Items, die eine Abfrage MIT diesem Space (`ItemFilter.group`) lieferte:
     * Sie liegen dort, auch wenn der Connector eine Id in mehreren Spaces
     * nicht eindeutig zuordnet.
     */
    knownInSpace?: ReadonlySet<string>
  } = {},
): TargetScope {
  // Ohne bekannten Space des Trägers ist nichts gegen ihn prüfbar: lokale
  // Targets gelten im einen Bereich (etwa der Vorbelegung), qualifizierte
  // nicht — dieselbe Regel wie `sameSpaceScope`, zentral hier.
  if (space === null || space === undefined) return scope({ carrierSpace: undefined, otherKind: options.otherKind })
  const connectorSpaceOf = spaceOfConnector(connector)
  const known = options.knownInSpace
  const spaceOf = connectorSpaceOf || known
    ? (id: string) => (known?.has(id) && space ? space : connectorSpaceOf ? connectorSpaceOf(id) : null)
    : undefined
  return scope({ carrierSpace: spaceOf ? (space ?? null) : undefined, spaceOf, otherKind: options.otherKind })
}

/**
 * Kontext „alle Spaces" für aggregierte Ansichten (Graph, Übersicht,
 * Aktivität): Den Space eines Trägers und seiner Ziele sagt `spaceOf`. Die
 * Space-Prüfung bleibt an; ist ein Space unbekannt, gibt es kein Ziel. Ohne
 * `spaceOf` (keine Spaces) gibt es nur einen Bereich.
 */
export function allSpacesScope(source: SpaceSource, carrier: Pick<Item, "id">, options: ScopeOptions = {}): TargetScope {
  const spaceOf = spacesOf(source)
  return scope({ carrierSpace: spaceOf ? spaceOf(carrier.id) : undefined, spaceOf, otherKind: options.otherKind })
}

/** Woher „alle Spaces" ihre Auskunft nehmen: der Connector oder eine Funktion (reine Projektionen). */
export type SpaceSource = DataInterface | null | undefined | ((itemId: string) => string | null)

function spacesOf(source: SpaceSource): ((id: string) => string | null) | undefined {
  if (!source) return undefined
  return typeof source === "function" ? source : spaceOfConnector(source)
}

/**
 * Kontext einer Menge, die ganz in EINEM Space liegt (etwa die Statements
 * eines Space): lokale Targets gelten, qualifizierte sind nicht prüfbar.
 * `bareId` duldet alte `variantOf`-Werte ohne Präfix.
 */
export function sameSpaceScope(options: ScopeOptions & { bareId?: boolean } = {}): TargetScope {
  return scope({ carrierSpace: undefined, otherKind: options.otherKind, bareId: options.bareId })
}

/** Eine Fabrik, die zu jedem Träger seinen Kontext baut. */
export type ScopeFor = (carrier: Pick<Item, "id">, options?: ScopeOptions) => TargetScope

/** Kontexte je Träger über den Connector (Träger-Space vom Connector). */
export function scopesFromConnector(connector: DataInterface | null): ScopeFor {
  return (carrier, options) => carrierScope(connector, carrier, options)
}

/** Kontexte je Träger im Kontext „alle Spaces" (aggregierte Ansichten, reine Projektionen). */
export function scopesAcrossSpaces(source: SpaceSource): ScopeFor {
  return (carrier, options) => allSpacesScope(source, carrier, options)
}

// ---------------------------------------------------------------------------
// Auflösen

function pointsTo(target: unknown, candidate: Item, s: TargetScope): boolean {
  const ctx = s[SCOPE]
  const parsed = parseItemTarget(target) ?? (ctx.bareId && typeof target === "string" && target !== "" && !target.includes(":") ? { itemId: target } : null)
  if (!parsed || parsed.itemId !== candidate.id) return false
  if (ctx.otherKind && ctx.otherKind !== "item" && !hasItemType(candidate, ctx.otherKind)) return false
  const { spaceOf } = ctx
  // Ohne Spaces gibt es einen Bereich: lokal gilt, qualifiziert ist nicht prüfbar.
  if (!spaceOf) return parsed.space === undefined
  if (parsed.space === undefined) {
    // Lokal: im Space des Trägers. Unbekannter Träger-Space: kein Ziel.
    return ctx.carrierSpace !== undefined && ctx.carrierSpace !== null && spaceOf(candidate.id) === ctx.carrierSpace
  }
  return spaceOf(candidate.id) === parsed.space
}

/**
 * Das Item, das `target` im Kontext `scope` meint, aus den Kandidaten — oder
 * `undefined`: dann gibt es kein Ziel (nicht verbunden, nicht gezeigt,
 * nicht verortet; 08, Regel 8).
 */
export function resolveTarget(
  target: unknown,
  s: TargetScope,
  candidates: Iterable<Item> | ReadonlyMap<string, Item>,
): Item | undefined {
  if (candidates instanceof Map) {
    const id = parseItemTarget(target)?.itemId ?? (s[SCOPE].bareId && typeof target === "string" ? target : undefined)
    const hit = id !== undefined ? candidates.get(id) : undefined
    return hit && pointsTo(target, hit, s) ? hit : undefined
  }
  for (const candidate of candidates as Iterable<Item>) if (pointsTo(target, candidate, s)) return candidate
  return undefined
}

/** Wie {@link resolveTarget}, das Ziel frisch vom Connector gelesen. */
export async function resolveTargetFromConnector(target: unknown, s: TargetScope, connector: DataInterface): Promise<Item | undefined> {
  const parsed = parseItemTarget(target)
  if (!parsed) return undefined
  const item = await connector.getItem(parsed.itemId)
  return item && pointsTo(target, item, s) ? item : undefined
}

/**
 * Wie {@link resolveTarget}, lebend: ein Abo auf genau das gemeinte Item.
 * `loading`, solange es noch nicht gelesen ist.
 */
export function useResolvedTarget(target: unknown, s: TargetScope | null): { item: Item | undefined; loading: boolean } {
  const connector = useOptionalConnector()
  const id = s ? (parseItemTarget(target)?.itemId ?? null) : null
  const observable = useMemo(() => (connector && id ? connector.observeItem(id) : null), [connector, id])
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!observable) return
    rerender()
    return observable.subscribe(() => startTransition(rerender))
  }, [observable])
  const data = observable?.current ?? undefined
  const loading = !!observable && !data && observable.loaded === false
  return { item: data && s && pointsTo(target, data, s) ? data : undefined, loading }
}

/** Der Kontext eines Trägers mit dem Connector aus dem Provider (für Hooks). */
export function useCarrierScope(carrier: Pick<Item, "id"> | null | undefined, options: ScopeOptions = {}): TargetScope | null {
  const connector = useOptionalConnector()
  return carrier ? carrierScope(connector, carrier, options) : null
}

/**
 * Bleibt ein Target beim Wechsel des Formular-Space gültig? Nur ein
 * qualifiziertes (`space:{id}/item:`); ein lokales zeigte danach in den neuen
 * Space (04, Target-Konventionen).
 */
export function survivesSpaceChange(target: unknown): boolean {
  const parsed = parseItemTarget(target)
  return !parsed || parsed.space !== undefined
}

/** Ist das ein Item-Target (lokal oder qualifiziert)? Für „hat das Item Verweise". */
export function isItemTarget(target: unknown): boolean {
  return parseItemTarget(target) !== null
}
