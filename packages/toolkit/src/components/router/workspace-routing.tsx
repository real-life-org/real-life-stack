"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import type { Group, Item } from "@real-life-stack/data-interface"
import { hasGroups, type ModuleHints } from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { useColorScheme } from "../../hooks/use-color-scheme"
import { useCurrentGroup, useGroups } from "../../hooks/use-groups"
import { useItem } from "../../hooks/use-items"
import { scalesForColor } from "../../lib/color-scales"
import { getModule, moduleForItem, moduleIds, resolveActiveModule, resolveSpaceModules } from "../../lib/module-register"
import { instanceTheme } from "../../lib/runtime-config"
import { layoutTokens, readGray, readRadius, readSurfaces } from "../../lib/space-theme"
import { applyThemeTokens, clearThemeTokens, themeTokens } from "../../lib/theme-tokens"
import { getSpacePrimaryColor } from "../../lib/utils"
import type { Module } from "../layout/module-tabs"
import type { Workspace } from "../layout/workspace-switcher"

/**
 * Space, Modul und Item aus der URL — die Auflösung, die jede App mit Router
 * braucht (Spec 01, Der Modul-Host: „Was bei der App bleibt" ist der Router
 * selbst, nicht diese Regeln). Bis zum 21.09.2026 stand sie in der
 * Referenz-App (`hooks/use-workspace-routing.ts`), und die Netzwerk-App hatte
 * keine: Sie hielt Linse und Auswahl im Speicher, ohne Adresse.
 */

export const STORAGE_KEY_GROUP = "rls-active-group"
export const STORAGE_KEY_MODULE = "rls-active-module"

// Modul-Ids und Anzeigenamen kommen aus dem Register — Spec 01,
// "Modul-Register", Regel 1: keine zweite Aufzaehlung. Frueher standen hier
// eine eigene Liste UND eigene Labels, unabhaengig vom Katalog des
// Space-Dialogs; die beiden sind auseinandergelaufen.
/**
 * Die gueltigen Modul-Segmente. Als FUNKTION, nicht als Konstante: ein
 * Snapshot neben dem Import sieht die App-Schicht nicht, die erst in
 * main.tsx gebunden wird (Review #277).
 */
export const validModules = () => moduleIds()

// The aggregate ("Mein Netzwerk") keeps its internal scope id `__overview__`
// (used across the module views) but appears as `network` in the URL.
const OVERVIEW_ID = "__overview__"
const OVERVIEW_SLUG = "network"
/** Internal scope id → URL slug. */
export const scopeToSlug = (id: string) => (id === OVERVIEW_ID ? OVERVIEW_SLUG : id)
/** URL slug → internal scope id. */
const slugToScope = (slug: string) => (slug === OVERVIEW_SLUG ? OVERVIEW_ID : slug)

const OVERVIEW_WORKSPACE: Workspace = { id: OVERVIEW_ID, name: "Mein Netzwerk", scope: "overview" }

/**
 * Das Modul für einen Item-Link ohne Modul (`/{scope}/{itemId}`). Die Regel
 * selbst liegt im Modul-Register (`moduleForItem`); hier bleibt nur der
 * Aufruf. Ein ausdrückliches `/{scope}/{module}/{itemId}` gewinnt immer.
 */
export function resolveDefaultModule(itemOrHints: Item | ModuleHints, available: readonly string[], fallback?: string): string {
  const gewaehlt = moduleForItem(itemOrHints, available)
  if (gewaehlt) return gewaehlt
  // Den Rückfall wählt die App (Spec 01): die Referenz-App den Feed, die
  // Netzwerk-App die Liste. Ohne Angabe das erste Modul des Space.
  return fallback && available.includes(fallback) ? fallback : (available[0] ?? fallback ?? moduleIds()[0])
}

/**
 * Der kanonische Pfad fuer einen Redirect.
 *
 * Query und Fragment gehoeren zum Ort, nicht zum Modul: `?connector=` waehlt
 * den Connector, `?dev` schaltet den Entwicklermodus. Ein Redirect, der sie
 * abschneidet, aendert stumm das Verhalten der Seite — darum werden sie
 * durchgereicht statt neu gebildet.
 *
 * Als schlichte Funktion exportiert, damit die Regel ohne Router pruefbar ist.
 */
export function canonicalPath(
  slug: string,
  moduleId: string,
  itemId: string | undefined,
  search: string,
  hash: string,
): string {
  return `/${slug}/${moduleId}${itemId ? `/${itemId}` : ""}${search}${hash}`
}

export interface WorkspaceRouting {
  groups: Group[]
  /** Overview pseudo-workspace + one workspace per group. */
  workspaces: Workspace[]
  /**
   * Resolved from URL → localStorage → first workspace. Null when the
   * URL names a space the user has no access to (groups loaded, id
   * unknown) — the UI shows the no-access notice in that case.
   */
  activeWorkspace: Workspace | null
  /** Resolved from URL → localStorage → first module of the space. */
  activeModule: string
  /** Modules available in the active workspace (group's data.modules). */
  modules: Module[]
  isOverview: boolean
  urlSpaceId?: string
  urlItemId?: string
  /** Navigate to a workspace, keeping the module if the target offers it. */
  handleWorkspaceChange: (workspace: Workspace) => void
  /** Navigate to a module within the active workspace. */
  handleModuleChange: (moduleId: string, opts?: { replace?: boolean }) => void
}

/**
 * Owns the workspace/module/item routing concern of an app with a router. URL
 * scheme (flat; the URL is the single source of truth for the focused item):
 *   /{scope}                   → redirect to /{scope}/{defaultModule}
 *   /{scope}/{module}          → module view
 *   /{scope}/{module}/{itemId} → module + focused item (canonical)
 *   /{scope}/{itemId}          → module-less item → resolveDefaultModule → redirect
 * `scope` is a space id, or `network` for the aggregate. The segment after the
 * scope is a module iff the register knows it, else a (module-less) item id —
 * generated ids never collide with the fixed module names.
 *
 * Pure glue — no rendering, no dialog state. Home composes the shell around this.
 */
export interface WorkspaceRoutingOptions {
  /** Das Modul, wenn kein Feld eines wählt (Spec 01: die App wählt den Rückfall). Standard: das erste des Space. */
  fallbackModule?: string
}

export function useWorkspaceRouting({ fallbackModule }: WorkspaceRoutingOptions = {}): WorkspaceRouting {
  const connector = useConnector()
  const navigate = useNavigate()
  const location = useLocation()
  const { scope: urlScope, seg: urlSeg, itemId: urlItemIdParam } = useParams<{
    scope?: string
    seg?: string
    itemId?: string
  }>()
  const { data: groups, isLoading: groupsLoading } = useGroups()
  const currentGroup = useCurrentGroup()

  // The segment after the scope is a module (known enum) or a module-less item id.
  const segIsModule = !!urlSeg && validModules().includes(urlSeg)
  const urlModule = segIsModule ? urlSeg : undefined
  const moduleLessItemId = !segIsModule ? urlSeg : undefined
  // Canonical focused item: the 3rd segment (/{scope}/{module}/{itemId}).
  const urlItemId = urlItemIdParam
  // The space the URL names (aggregate slug → internal overview id).
  const urlSpaceId = urlScope ? slugToScope(urlScope) : undefined

  // Hell oder dunkel entscheidet der Mensch, nicht der Space. Gelesen wird das
  // im Toolkit: der Space-Dialog zeigt die Kontraste derselben Skala und
  // braucht dasselbe Schema — zwei Leser mit eigenem Code waeren zwei
  // Wahrheiten.
  const scheme = useColorScheme()

  const workspaces: Workspace[] = useMemo(
    () => [
      OVERVIEW_WORKSPACE,
      ...groups.map((g) => ({
        id: g.id,
        name: g.name,
        avatar: g.data?.image as string | undefined,
        scope: g.data?.scope as string | undefined,
        primaryColor: g.data?.primaryColor as string | undefined,
        // Ungeprueft durchgereicht; `scalesForColor` kappt und verwirft.
        tint: g.data?.tint as number | undefined,
        gray: readGray(g.data?.gray) ?? undefined,
        radius: readRadius(g.data?.radius) ?? undefined,
        surfaces: readSurfaces(g.data?.surfaces) ?? undefined,
      })),
    ],
    [groups]
  )

  // Derive active workspace from the URL scope (fallback localStorage → first space).
  const activeWorkspace: Workspace | null = useMemo(() => {
    if (urlSpaceId) {
      const found = workspaces.find((w) => w.id === urlSpaceId)
      if (found) return found
      // Scope id from URL but not in the list. While groups are still loading we
      // can't tell "no access" from "not yet loaded" — assume it exists
      // (optimistic placeholder) so valid deep-links don't flash the no-access
      // notice. Once groups are LOADED and it still doesn't resolve, it's a
      // foreign/inaccessible space → null so the UI says so. `groupsLoading` is a
      // real loaded signal (Observable.loaded).
      if (groupsLoading) return { id: urlSpaceId, name: "" }
      return null
    }
    const savedId = localStorage.getItem(STORAGE_KEY_GROUP)
    if (savedId) {
      const found = workspaces.find((w) => w.id === savedId)
      if (found) return found
    }
    return workspaces[0] ?? null
  }, [urlSpaceId, workspaces, groupsLoading])

  // Available modules for the active space (overview = all modules).
  const isOverview = activeWorkspace?.scope === "overview"
  const activeGroup = isOverview ? null : groups.find((g) => g.id === activeWorkspace?.id)
  const groupModuleIds = resolveSpaceModules(
    isOverview ? undefined : (activeGroup?.data?.modules as string[] | undefined),
  )

  // Aktives Modul aus URL, sonst zuletzt benutztes. Die Aufloesung laeuft
  // ueber dieselbe zentrale Regel wie jede andere Auswahl: eine gespeicherte
  // Vorauswahl aus einer anderen App-Version oder aus einem Space, der das
  // Modul nicht fuehrt, darf nicht zu einem leeren Tab werden.
  const activeModule = resolveActiveModule(
    urlModule ?? localStorage.getItem(STORAGE_KEY_MODULE) ?? undefined,
    isOverview ? undefined : (activeGroup?.data?.modules as string[] | undefined),
  )

  // Module-less item link (/{scope}/{itemId}): resolve the item's default module,
  // then redirect to the canonical /{scope}/{module}/{itemId}. The lookup must run
  // against the URL's scope — getItem is scope-dependent in the WoT connector, and
  // the scope is synced to the connector in a separate effect below. So gate the
  // lookup (and redirect) on the connector's currentGroup actually matching the
  // URL scope; otherwise a direct module-less deep-link to another space could
  // resolve "not found" against the still-current space and pick the wrong module.
  const expectedGroupId = activeWorkspace
    ? (activeWorkspace.scope === "overview" ? null : activeWorkspace.id)
    : null
  const scopeSynced = !!activeWorkspace && (currentGroup?.id ?? null) === expectedGroupId
  const { data: moduleLessItem, isLoading: moduleLessLoading } = useItem(
    moduleLessItemId && scopeSynced ? moduleLessItemId : "",
  )

  // Redirect bare/short paths to the canonical form.
  useEffect(() => {
    if (workspaces.length === 0 || !activeWorkspace) return
    const slug = scopeToSlug(activeWorkspace.id)
    // Query und Fragment gehoeren zum Ort, nicht zum Modul: `?connector=`
    // waehlt den Connector, `?dev` schaltet den Entwicklermodus. Ein Redirect,
    // der sie abschneidet, aendert stumm das Verhalten der Seite.
    const { search, hash } = location
    // (a) No module/item segment (`/` or `/{scope}`) → default module.
    if (!urlSeg) {
      navigate(canonicalPath(slug, activeModule, undefined, search, hash), { replace: true })
      return
    }
    // (a2) Die URL nennt ein Modul, das dieser Space nicht fuehrt (oder das
    // Register nicht kennt). resolveActiveModule hat dann etwas anderes
    // gewaehlt — ohne diesen Redirect zeigte die URL /map, gerendert wuerde
    // aber der Feed. Alles, was die URL liest (Verlinken, Zurueck, ein Pick
    // auf der Karte), liefe gegen eine Flaeche, die gar nicht offen ist.
    if (urlModule && urlModule !== activeModule) {
      navigate(canonicalPath(slug, activeModule, urlItemId, search, hash), { replace: true })
      return
    }
    // (b) Module-less item — only once the scope is synced AND the lookup settled.
    if (moduleLessItemId && scopeSynced && !moduleLessLoading) {
      const mod = moduleLessItem
        ? resolveDefaultModule(moduleLessItem, groupModuleIds, fallbackModule)
        : groupModuleIds[0]
      navigate(canonicalPath(slug, mod, moduleLessItemId, search, hash), { replace: true })
    }
  }, [
    workspaces.length,
    activeWorkspace,
    urlSeg,
    urlModule,
    urlItemId,
    location.search,
    location.hash,
    activeModule,
    moduleLessItemId,
    scopeSynced,
    moduleLessLoading,
    moduleLessItem,
    fallbackModule,
    groupModuleIds,
    navigate,
  ])

  // Sync connector current group when workspace changes
  useEffect(() => {
    if (activeWorkspace && hasGroups(connector)) {
      connector.setCurrentGroup(activeWorkspace.scope === "overview" ? null : activeWorkspace.id)
    }
  }, [activeWorkspace?.id, connector]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to localStorage for next session
  useEffect(() => {
    if (activeWorkspace) localStorage.setItem(STORAGE_KEY_GROUP, activeWorkspace.id)
    if (urlModule) localStorage.setItem(STORAGE_KEY_MODULE, urlModule)
  }, [activeWorkspace?.id, urlModule]) // eslint-disable-line react-hooks/exhaustive-deps

  const modules: Module[] = useMemo(
    // displayableModules zuerst: eine Id aus einer anderen App-Version bleibt
    // gespeichert, bekommt aber keinen Tab (Spec 01, Regel 4). Ohne diesen
    // Filter waere der Registerzugriff darunter undefined.
    () => groupModuleIds
      .map((id) => getModule(id)!)
      .map((m) => ({ id: m.id, label: m.label, icon: m.icon })),
    [groupModuleIds.join(",")] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Re-theme the app's primary color to the active space's identity color, so
  // every space has its own visual identity (buttons, focus rings, active
  // sidebar items, hover tints). Set on <html> so portaled content (dialogs,
  // dropdowns) re-themes too. The overview ("Mein Netzwerk") and the no-access
  // state keep the default brand color.
  useEffect(() => {
    const root = document.documentElement
    if (!activeWorkspace || isOverview) {
      clearThemeTokens(root)
      return
    }
    // Aus der Space-Farbe wird eine zwoelfstufige Skala, aus ihr und einer
    // neutralen Skala die Tokens, aus denen jede Flaeche schoepft. Frueher
    // wurden nur Primaer- und Akzent-Token gesetzt und der Rest blieb fest;
    // jetzt zieht der ganze Satz mit — Flaechen, Rahmen, Text.
    const seed = getSpacePrimaryColor(activeWorkspace.id, activeWorkspace.primaryColor)
    // `scalesForColor` waehlt zur Akzentskala den Grauton, der sie ergaenzt
    // — Radix paart beides automatisch. Der Unterschied ist klein und soll
    // es sein: er gestaltet nicht, er stimmt ab.
    // Die Toenung ist die zweite Achse des Space: wie stark die Flaechen die
    // Farbe tragen. Setzt der Space keine, erbt er die der Instanz — so
    // bleibt eine cremefarbene Instanz auch in jedem Space cremefarben.
    const inherited = instanceTheme()
    const scales = scalesForColor(seed, scheme, {
      tint: activeWorkspace.tint ?? inherited.tint,
      gray: activeWorkspace.gray ?? inherited.gray,
    })
    // Rundung und Flaechen gehoeren zum selben Satz: gesetzt und weggeraeumt
    // mit den Farben, sonst bliebe die Rundung eines Space in der Uebersicht.
    const layout = layoutTokens({
      radius: activeWorkspace.radius ?? inherited.radius,
      surfaces: activeWorkspace.surfaces ?? inherited.surfaces,
    })
    applyThemeTokens(root, { ...themeTokens({ ...scales, scheme }), ...layout })
    return () => clearThemeTokens(root)
  }, [activeWorkspace?.id, activeWorkspace?.primaryColor, activeWorkspace?.tint, activeWorkspace?.gray, activeWorkspace?.radius, activeWorkspace?.surfaces, isOverview, scheme])

  // Switch workspace (keep the module if offered). Item focus is space-scoped → dropped.
  const handleWorkspaceChange = useCallback((workspace: Workspace) => {
    const group = groups.find((g) => g.id === workspace.id)
    const mods = resolveSpaceModules(group?.data?.modules as string[] | undefined)
    const mod = mods.includes(activeModule) ? activeModule : mods[0]
    navigate(`/${scopeToSlug(workspace.id)}/${mod}`)
  }, [groups, activeModule, navigate])

  // Switch module within the active space, carrying the focused item if any —
  // plus its query, so an in-progress edit (`?edit`, needs the itemId) or create
  // (`?compose`, no itemId) continues seamlessly across module switches. The
  // create case is load-bearing for the map-pick: picking switches to the Map
  // module, and dropping `?compose` there would abort the create mid-pick.
  const handleModuleChange = useCallback((moduleId: string, opts?: { replace?: boolean }) => {
    if (!activeWorkspace) return
    const slug = scopeToSlug(activeWorkspace.id)
    const carryQuery = !!urlItemId || new URLSearchParams(location.search).has("compose")
    const base = urlItemId ? `/${slug}/${moduleId}/${urlItemId}` : `/${slug}/${moduleId}`
    const path = carryQuery ? `${base}${location.search}` : base
    navigate(path, opts?.replace ? { replace: true } : undefined)
  }, [activeWorkspace, urlItemId, location.search, navigate])

  return {
    groups,
    workspaces,
    activeWorkspace,
    activeModule,
    modules,
    isOverview,
    urlSpaceId,
    urlItemId,
    handleWorkspaceChange,
    handleModuleChange,
  }
}
