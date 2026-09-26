"use client"

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type MutableRefObject, type ReactNode,
} from "react"
import type { Item } from "@real-life-stack/data-interface"

import { useItemFocus } from "../../hooks/use-item-focus"
import type { ItemEditorMapper } from "../../hooks/use-item-editor"
import { ComposerFullscreenShell } from "../composer/composer-fullscreen-shell"
import type { ContentComposerHandle, ContentComposerProps, ContentTypeConfig, WidgetData } from "../composer/content-composer"
import { ItemComposer } from "../composer/item-composer"
import { withFixedGroup } from "../composer/composer-mapping"
import { useLocationPick } from "../map/location-pick"
import { useModulePanel } from "../module-panel/module-panel"

/**
 * Der Erstellen-Host (Spec 01, „Der Modul-Host"). DASS und WAS erstellt
 * wird, hält der Fokus-Vertrag (`composeType`, in der App die URL); WIE —
 * welche Typen, welcher Mapper, welche Fläche — steht in der Konfiguration,
 * die ein Modul registriert; die Vorbelegung (ein angeklickter Kalendertag)
 * kommt je Aufruf.
 *
 * Bis zum 21.09.2026 in der Referenz-App und dort an den Router gebunden.
 * Jetzt liest er nur noch den Fokus-Vertrag — läuft also mit URL und ohne.
 */
export interface CreateConfig {
  /** Types offered in the create menu. */
  contentTypes: ContentTypeConfig[]
  /** Composer submission → item payload. */
  mapper: ItemEditorMapper
  /** Extra composer props (people options, …). */
  composerProps?: Partial<ContentComposerProps>
  /** Surface: side panel (sheet) or fullscreen. */
  shell: "sheet" | "fullscreen"
}

/** Constraints on a create form beyond its prefilled data. */
export interface CreateOptions {
  /** The new item must land in this space: the group widget offers nothing
      else (e.g. a variant, whose `variantOf` is a space-local reference). */
  fixedGroup?: string
}

export interface CreateHostValue {
  /** Whether a create form is currently open. */
  isComposing: boolean
  /** Open the create form for `type` (default: the module's first type), optionally prefilled. */
  startCreate: (type?: string, initialData?: Partial<WidgetData>, options?: CreateOptions) => void
  /** Patch the open create form's data (e.g. a different clicked date) without remounting. */
  patchCreate: (patch: Partial<WidgetData>) => void
}

const CreateHostContext = createContext<CreateHostValue | null>(null)

interface CreateOutletValue {
  store: ConfigStore
  composeType: string | null
  composerKey: number
  activeConfig: CreateConfig | null
  sheetComposing: boolean
  pendingInitialData: () => Partial<WidgetData> | undefined
  pendingOptions: () => CreateOptions | undefined
  onDone: (item: Item) => void
  cancel: () => void
  composerApiRef: MutableRefObject<ContentComposerHandle | null>
}
const CreateOutletContext = createContext<CreateOutletValue | null>(null)

interface ConfigStore {
  setConfig: (module: string, config: CreateConfig | null) => void
  setActiveModule: (module: string) => void
  getActiveConfig: () => CreateConfig | null
  getConfigFor: (module: string) => CreateConfig | null
  subscribe: (listener: () => void) => () => void
}

function createConfigStore(): ConfigStore {
  const configs = new Map<string, CreateConfig>()
  let activeModule = ""
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
    getActiveConfig: () => configs.get(activeModule) ?? null,
    getConfigFor: (module) => configs.get(module) ?? null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function CreateHostProvider({ children }: { children: ReactNode }) {
  const focus = useItemFocus()
  const { isPicking } = useLocationPick()

  const storeRef = useRef<ConfigStore | null>(null)
  if (!storeRef.current) storeRef.current = createConfigStore()
  const store = storeRef.current

  // Live module so the stable callbacks read it at call time.
  const moduleRef = useRef(focus.module)
  moduleRef.current = focus.module

  const module = focus.module
  const composeType = focus.composeType
  const isComposing = composeType !== null && !!module

  // The module that STARTED the current create. The create stays bound to it
  // even if the module changes — e.g. a map-pick excursion must not swap the
  // composer over to the map's config (which would lose its data).
  const composeOriginRef = useRef<string | undefined>(undefined)
  const composeConfigRef = useRef<CreateConfig | null>(null)

  useEffect(() => {
    if (isComposing) {
      if (!composeOriginRef.current && module) composeOriginRef.current = module
      return
    }
    composeOriginRef.current = undefined
    composeConfigRef.current = null
  }, [isComposing, module])

  useEffect(() => {
    const target = isComposing ? (composeOriginRef.current ?? module) : module
    if (target) store.setActiveModule(target)
  }, [isComposing, module, store])
  const registeredActiveConfig = useSyncExternalStore(store.subscribe, store.getActiveConfig, store.getActiveConfig)
  useEffect(() => {
    if (isComposing && registeredActiveConfig) composeConfigRef.current = registeredActiveConfig
  }, [isComposing, registeredActiveConfig])
  const activeConfig = registeredActiveConfig ?? (isComposing ? composeConfigRef.current : null)

  const pendingInitialDataRef = useRef<Partial<WidgetData> | undefined>(undefined)
  const pendingOptionsRef = useRef<CreateOptions | undefined>(undefined)
  const [composerKey, setComposerKey] = useState(0)
  const composerApiRef = useRef<ContentComposerHandle | null>(null)

  const { startCompose, stopCompose, focusCreated } = focus
  const stopCreate = useCallback(() => stopCompose(), [stopCompose])

  const startCreate = useCallback(
    (type?: string, initialData?: Partial<WidgetData>, options?: CreateOptions) => {
      const modul = moduleRef.current
      if (!modul) return
      const cfg = store.getConfigFor(modul)
      const resolvedType = type ?? cfg?.contentTypes[0]?.id ?? ""
      composeOriginRef.current = modul
      composeConfigRef.current = cfg
      pendingOptionsRef.current = options
      pendingInitialDataRef.current = options?.fixedGroup ? { ...initialData, group: options.fixedGroup } : initialData
      setComposerKey((k) => k + 1)
      startCompose(resolvedType)
    },
    [startCompose, store],
  )

  const onDone = useCallback((item: Item) => focusCreated(item.id), [focusCreated])

  const outletValue = useMemo<CreateOutletValue>(
    () => ({
      store, composeType, composerKey, activeConfig,
      sheetComposing: isComposing && activeConfig?.shell === "sheet",
      pendingInitialData: () => pendingInitialDataRef.current,
      pendingOptions: () => pendingOptionsRef.current,
      onDone, cancel: stopCreate, composerApiRef,
    }),
    [store, composeType, composerKey, activeConfig, isComposing, onDone, stopCreate],
  )

  const patchCreate = useCallback((patch: Partial<WidgetData>) => { composerApiRef.current?.patchData(patch) }, [])
  const value = useMemo<CreateHostValue>(() => ({ isComposing, startCreate, patchCreate }), [isComposing, startCreate, patchCreate])

  const showFullscreen = isComposing && activeConfig?.shell === "fullscreen"

  return (
    <CreateHostContext.Provider value={value}>
      <CreateOutletContext.Provider value={outletValue}>
        {children}
        <ComposerFullscreenShell open={!!showFullscreen} suspended={isPicking} onRequestClose={stopCreate}>
          {showFullscreen && <CreateComposerOutlet className="p-4 sm:p-6" />}
        </ComposerFullscreenShell>
      </CreateOutletContext.Provider>
    </CreateHostContext.Provider>
  )
}

/** Opens/closes the shared ModulePanel for the SHEET shell. Mounted BELOW the panel. */
export function CreateSheetController() {
  const modulePanel = useModulePanel()
  const ctx = useContext(CreateOutletContext)
  const sheetComposing = !!ctx?.sheetComposing
  const cancel = ctx?.cancel
  const ownedRef = useRef(false)
  useEffect(() => {
    if (sheetComposing) {
      if (ownedRef.current && modulePanel.current?.kind === "composer") return
      ownedRef.current = true
      modulePanel.open({ kind: "composer", content: <CreateComposerOutlet className="p-4 sm:p-6" />, onClose: cancel })
    } else if (ownedRef.current) {
      ownedRef.current = false
      if (modulePanel.current?.kind === "composer") modulePanel.close({ silent: true })
    }
  }, [sheetComposing, modulePanel, cancel])
  return null
}

function CreateComposerOutlet({ className }: { className?: string }) {
  const ctx = useContext(CreateOutletContext)
  const config = ctx?.activeConfig
  if (!ctx || !config) return null
  const fixedGroup = ctx.pendingOptions()?.fixedGroup
  return (
    <ItemComposer
      key={ctx.composerKey}
      apiRef={ctx.composerApiRef}
      className={className}
      contentTypes={fixedGroup ? withFixedGroup(config.contentTypes, fixedGroup) : config.contentTypes}
      initialContentType={ctx.composeType ?? undefined}
      initialData={ctx.pendingInitialData()}
      mapper={config.mapper}
      composerProps={config.composerProps}
      onDone={ctx.onDone}
      onCancel={ctx.cancel}
    />
  )
}

/**
 * Register the create configuration of the active module — the host's job, never a module's (guarded by `check-shared-derivations`).
 *
 * Register a module's create config. Pass a memoised config; removed on unmount.
 *
 * @answers `void`
 * @without no-op
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useRegisterCreate(module: string, config: CreateConfig): void {
  const ctx = useContext(CreateOutletContext)
  const store = ctx?.store
  useEffect(() => {
    if (!store) return
    store.setConfig(module, config)
    return () => store.setConfig(module, null)
  }, [module, config, store])
}

/**
 * Start creating — with suggestion and prefill, never with restriction.
 *
 * @answers `{isComposing, startCreate, patchCreate}`
 * @without throws on render
 * @group host
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useCreate(): CreateHostValue {
  const ctx = useContext(CreateHostContext)
  if (!ctx) throw new Error("useCreate must be used inside <CreateHostProvider>")
  return ctx
}

/**
 * The create host, or `null` where a surface may stand without one (story, test).
 *
 * Wie {@link useCreate}, aber `null` ohne Provider — fuer Flaechen, die auch nackt laufen (Story, Test).
 *
 * @answers `CreateHostValue | null`
 * @without value — null
 * @group host
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useOptionalCreate(): CreateHostValue | null {
  return useContext(CreateHostContext)
}
