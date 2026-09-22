"use client"

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import type { Item, User } from "@real-life-stack/data-interface"

import { useCurrentUser } from "../../hooks/use-auth"
import { useMembers } from "../../hooks/use-groups"
import { useItemFocus } from "../../hooks/use-item-focus"
import type { ItemDetailEditConfig } from "../../hooks/use-item-detail-edit"
import { moduleIds } from "../../lib/module-register"
import { ItemDetailBody } from "../detail/item-detail-body"
import { ItemDetailView } from "../detail/item-detail-view"
import { useModulePanel } from "../module-panel/module-panel"
import { ItemScopeBadge } from "../preview/item-scope-badge"
import { ItemTypeBadge } from "../preview/item-type-badge"
import { renderTypeFooter, resolveTypePresentation } from "../preview/type-presentation"
import { ReactionBar } from "../reactions/reaction-bar"

/**
 * Der Detail-Host: EIN Panel für das offene Item, über alle Module hinweg
 * (Spec 01, „Der Modul-Host"). Bis zum 21.09.2026 in der Referenz-App;
 * jedes Modul registrierte seine Konfiguration selbst. Die Netzwerk-App
 * hatte keinen und baute das Panel neu.
 *
 * Modules whose detail (read↔edit) is owned by the host — that is all of
 * them. Derived from the register instead of enumerated (spec 01, rule 1).
 */
const hostModules = () => moduleIds()

/** Per-item detail config a module registers with the host. */
export interface DetailConfig extends ItemDetailEditConfig {
  /** Reaction bars on comments. */
  renderCommentReactions?: (commentId: string) => ReactNode
  /** Share/copy a link to the item. */
  onShare?: () => void
  /** Dimming backdrop behind the panel. Overlay modules (map) set `false` to stay pannable. */
  backdrop?: boolean
}

interface ConfigStore {
  setConfig: (module: string, config: DetailConfig | null) => void
  setActiveModule: (module: string) => void
  setActiveGroupId: (groupId: string | null) => void
  getActiveConfig: () => DetailConfig | null
  getActiveGroupId: () => string | null
  subscribe: (listener: () => void) => () => void
}

/**
 * External store for the registered detail configs, keyed by module id. A
 * plain subscribable — NOT React state — so registering a config does NOT
 * re-render the whole subtree. Keyed by module so a module that stays MOUNTED
 * while inactive (the map, kept alive) can't overwrite the active module's
 * config.
 */
function createConfigStore(): ConfigStore {
  const configs = new Map<string, DetailConfig>()
  let activeModule = ""
  let activeGroupId: string | null = null
  const listeners = new Set<() => void>()
  const notify = () => { for (const l of listeners) l() }
  return {
    setConfig(module, config) {
      if (config === null) {
        if (!configs.has(module)) return
        configs.delete(module)
      } else {
        if (configs.get(module) === config) return
        configs.set(module, config)
      }
      if (module === activeModule) notify()
    },
    setActiveModule(module) {
      if (module === activeModule) return
      activeModule = module
      notify()
    },
    setActiveGroupId(groupId) {
      if (groupId === activeGroupId) return
      activeGroupId = groupId
      notify()
    },
    getActiveConfig: () => configs.get(activeModule) ?? null,
    getActiveGroupId: () => activeGroupId,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const DetailHostContext = createContext<ConfigStore | null>(null)

function useConfigStore(): ConfigStore {
  const ctx = useContext(DetailHostContext)
  if (!ctx) throw new Error("useConfigStore must be used within <DetailHostProvider>")
  return ctx
}

function useActiveDetailConfig(): DetailConfig | null {
  const store = useConfigStore()
  return useSyncExternalStore(store.subscribe, store.getActiveConfig, store.getActiveConfig)
}

function useActiveGroupId(): string | null {
  const store = useConfigStore()
  return useSyncExternalStore(store.subscribe, store.getActiveGroupId, store.getActiveGroupId)
}

/**
 * Holds the config store (a stable ref — the provider never re-renders on a
 * config change). Lives ABOVE the ModulePanel so the panel content can read
 * it; the open/close itself happens in `DetailHostController` (below the panel).
 */
export function DetailHostProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<ConfigStore | null>(null)
  if (!storeRef.current) storeRef.current = createConfigStore()
  return <DetailHostContext.Provider value={storeRef.current}>{children}</DetailHostContext.Provider>
}

/**
 * Register the detail configuration of the active module — the host's job, never a module's.
 *
 * A module registers its detail config here, keyed by its module id. Pass a
 * memoised config so it only re-registers on real change. Removes its config
 * on unmount so a torn-down module can't leave a stale config behind.
 *
 * @answers `void`
 * @without no-op
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useRegisterDetail(module: string, config: DetailConfig): void {
  // Ohne Provider ein No-op, wie beim Erstellen-Host: Der Modul-Host ruft
  // das fuer jede Flaeche, auch fuer eine, die nackt in einer Story laeuft.
  const store = useContext(DetailHostContext)
  useEffect(() => {
    if (!store) return
    store.setConfig(module, config)
    return () => store.setConfig(module, null)
  }, [module, config, store])
}

/**
 * The read view of the shared detail panel.
 *
 * **What it shows follows the ITEM, not the module.** The panel is one surface;
 * a task is a task whether it was opened from Kanban or from the collection.
 * The module only says which space we are in (`groupId`) — for the author
 * lookup, the scope badge and the group colour.
 */
export function ItemDetailRead({ item, actions, groupId }: { item: Item; actions: ReactNode; groupId: string | null }) {
  // No space (or the aggregate) → `null` asks for the union of all known
  // members, so an author from another space still resolves.
  const isOverview = groupId === "__overview__"
  const scopedGroupId = isOverview ? null : groupId
  const { data: members } = useMembers(scopedGroupId)
  const { data: currentUser } = useCurrentUser()

  // Space members first, then the signed-in user — who is not in `members` for
  // their own personal space.
  const resolveUser = (userId: string): User | undefined =>
    members.find((member) => member.id === userId) ?? (currentUser?.id === userId ? currentUser : undefined)

  const author = resolveUser(item.createdBy)
  const presentation = resolveTypePresentation(item.type)

  return (
    <ItemDetailBody
      item={item}
      author={author}
      headerAdornment={
        <>
          <ItemTypeBadge type={item.type} />
          {isOverview && <ItemScopeBadge item={item} />}
        </>
      }
      actions={actions}
      // Was in der Meta-Box steht, sagt der TYP (spec 06) — derselbe Slot,
      // aus dem auch die Vorschau ihre Zeile zieht.
      meta={<presentation.detail item={item} />}
      footer={
        <div className="flex w-full flex-col gap-2">
          {renderTypeFooter(item)}
          <ReactionBar itemId={item.id} />
        </div>
      }
    />
  )
}

function DetailHostOutlet() {
  const { itemId: focusedId, isEditing, isCommenting, clearFocus, editItem, stopEditing, stopCommenting } = useItemFocus()
  const config = useActiveDetailConfig()
  const groupId = useActiveGroupId()
  if (!focusedId || !config) return null
  return (
    <ItemDetailView
      key={focusedId}
      itemId={focusedId}
      mode={isEditing ? "edit" : "read"}
      onModeChange={(next) => (next === "edit" ? editItem() : stopEditing())}
      renderRead={(item, actions) => <ItemDetailRead item={item} actions={actions} groupId={groupId} />}
      contentTypes={config.contentTypes}
      mapper={config.mapper}
      editInitialData={config.editInitialData}
      composerProps={config.composerProps}
      renderCommentReactions={config.renderCommentReactions}
      focusComposer={isCommenting}
      onComposerFocused={stopCommenting}
      onShare={config.onShare}
      onClose={clearFocus}
    />
  )
}

/**
 * Owns the shared panel for the focused item across all host modules — opens
 * once per item, persists across module switches, closes when the focus
 * clears or the user leaves the host modules.
 */
export function DetailHostController({ activeModule, activeGroupId }: { activeModule: string; activeGroupId: string | null }) {
  const modulePanel = useModulePanel()
  const { itemId: focusedId, clearFocus } = useItemFocus()
  const store = useConfigStore()
  const config = useActiveDetailConfig()
  const hostOwns = hostModules().includes(activeModule)
  const panelOwnedRef = useRef(false)
  const openedIdRef = useRef<string | null>(null)

  useEffect(() => { store.setActiveModule(activeModule) }, [store, activeModule])
  useEffect(() => { store.setActiveGroupId(activeGroupId) }, [store, activeGroupId])

  useEffect(() => {
    if (hostOwns && focusedId) {
      // The active host module's config isn't registered yet (module still
      // mounting). A transient wait, NOT a reason to close.
      if (!config) return
      if (openedIdRef.current === focusedId && panelOwnedRef.current) {
        if (modulePanel.current?.itemId === "__activity__") panelOwnedRef.current = false
        return
      }
      openedIdRef.current = focusedId
      panelOwnedRef.current = true
      modulePanel.open({ kind: "detail", itemId: focusedId, backdrop: config.backdrop, content: <DetailHostOutlet />, onClose: clearFocus })
    } else {
      // SILENT close: leaving for a module that can't show the item must NOT
      // clear the URL focus — the focus is owned by its provider; the
      // controller only opens/closes the panel as a consequence of it.
      openedIdRef.current = null
      if (panelOwnedRef.current) {
        panelOwnedRef.current = false
        if (modulePanel.current?.kind === "detail") modulePanel.close({ silent: true })
      }
    }
  }, [hostOwns, focusedId, config, modulePanel, clearFocus])

  return null
}
