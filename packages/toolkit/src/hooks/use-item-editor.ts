import { useCallback, useState } from "react"
import type { DataInterface, Item, Relation } from "@real-life-stack/data-interface"
import { deriveContext, hasGroups, hasGroupScope, hasItemGroups } from "@real-life-stack/data-interface"
import { useCreateItem, useUpdateItem, useDeleteItem } from "./use-mutations"
import { useConnector } from "./connector-context"
import type { ContentComposerSubmitData } from "../components/composer/content-composer"
import { writeOwnStatement, type OwnStatement } from "../lib/own-statement"

/**
 * The shape a caller-supplied mapper returns. The hook handles the
 * `@context` derivation and createdBy fallback so the mapper can focus
 * on field-mapping (title/content/description, etc.).
 */
export interface ItemEditorPayload {
  type: string
  createdBy?: string
  data: Record<string, unknown>
  tags?: string[]
  relations?: Relation[]
  /**
   * Optional override. When omitted the hook calls
   * `deriveContext(type, data)`. Pass an explicit list only when a
   * vocabulary outside the activation heuristic is needed.
   */
  "@context"?: string[]
  /**
   * Eigene Aussagen an Record-Kanten, die nach dem Speichern geschrieben
   * werden (Event: Zusagen im Personenfeld, 08 → Teilnahme am Event). Nie
   * Teil des Items.
   */
  statements?: readonly OwnStatement[]
}

/**
 * Maps a composer submission to a payload the connector can persist.
 *
 * - `mode === "create"`: hook will call `createItem` with the payload.
 * - `mode === "edit"`: hook will call `updateItem(existingItem.id, ...)`.
 *
 * Return `null` to abort the submission (validation failure, etc.) —
 * the hook will surface no error and leave the editor open.
 */
export type ItemEditorMapper = (
  submission: ContentComposerSubmitData,
  ctx: { mode: "create" | "edit"; existingItem: Item | null },
) => ItemEditorPayload | null

export interface UseItemEditorOptions {
  /** Identifier of the current user; written to createdBy on new items. */
  currentUserId: string | undefined
  /** Caller-supplied field mapping (see ItemEditorMapper). */
  mapSubmission: ItemEditorMapper
  /** Optional side-effect after a successful create. */
  onCreated?: (item: Item) => void | Promise<void>
  /** Optional side-effect after a successful update. */
  onUpdated?: (item: Item) => void | Promise<void>
  /** Optional side-effect after a successful delete. */
  onDeleted?: (itemId: string) => void | Promise<void>
}

export interface UseItemEditorResult {
  /** Whether the editor surface (modal/drawer/panel) should be visible. */
  isOpen: boolean
  /** "create" when opening fresh; "edit" when editing an existing item. */
  mode: "create" | "edit"
  /** The item being edited; null when in create mode. */
  currentItem: Item | null
  /** Latest submission/delete error, cleared on next attempt. */
  error: Error | null
  /** True while a submit/remove call is in flight. */
  isSubmitting: boolean

  /** Open the editor in create mode. */
  openCreate(): void
  /** Open the editor in edit mode for the given item. */
  openEdit(item: Item): void
  /** Close the editor without persisting. */
  close(): void

  /**
   * Persist the composer's submission. Resolves with the resulting Item
   * on success, or `null` when the mapper aborted or an error was caught.
   *
   * `options.existingItem`: edit that item instead of whatever is in the
   * hook's `currentItem` state. Views that manage their own
   * open-target state (e.g. Kanban's `panelState`) can pass the item
   * inline without round-tripping through `openEdit`.
   */
  submit(
    submission: ContentComposerSubmitData,
    options?: {
      existingItem?: Item
      /** Receives the caught error (the reason) before `submit` resolves `null`. */
      onError?: (error: Error) => void
      /**
       * The item is stored (created or updated) — called before the follow-up
       * steps (space, statements). If one of those fails, a retry continues
       * on this item instead of creating a second one (#523).
       */
      onPersisted?: (item: Item) => void
      /**
       * Setzt ein Anlegen fort, dessen Folgeschritt scheiterte (#523): Hat
       * sich am Item nichts geändert, wird es nicht noch einmal geschrieben,
       * nur die Folgeschritte laufen. Das Item kann in einem anderen als dem
       * geöffneten Space liegen (Space des Formulars, Regel 6).
       */
      resume?: boolean
    },
  ): Promise<Item | null>

  /**
   * Delete an item. Without an id, falls back to the hook's
   * `currentItem`. Returns silently when there is nothing to delete.
   */
  remove(itemId?: string): Promise<void>
}

/**
 * Centralises the boilerplate every Space Module otherwise duplicates:
 * open/close state for the composer modal, mode tracking, deriveContext
 * call, createItem/updateItem dispatch, and error handling.
 *
 * Spec: docs/spec/06-schema-composition.md (deriveContext is the source
 * of truth for `@context` on created/updated items). Field-mapping —
 * which composer widget maps to which item field — stays in the caller
 * because every module makes that decision differently (Feed maps text
 * to `content` for posts and `description` otherwise; Kanban maps text
 * to `description` always; Calendar will likely map differently again).
 *
 * Optimistic updates are intentionally NOT implemented here; the hook
 * is fire-and-await. When we adopt server connectors with perceivable
 * latency, an `optimistic: true` mode can be added without API breaks.
 */
/**
 * Build the `createItem` payload from a mapped submission. Pure for
 * testing. `currentUserId` is the fallback for `createdBy`; "anonymous"
 * is the final fallback when no user is known.
 *
 * Omits `tags` when the mapped value is empty or absent (so the on-the-
 * wire item shape stays minimal). Omits `relations` only when absent —
 * an explicit empty array is preserved.
 */
export function buildCreatePayload(
  mapped: ItemEditorPayload,
  currentUserId: string | undefined,
): Omit<Item, "id" | "createdAt"> {
  const ctx = mapped["@context"] ?? deriveContext(mapped.type, mapped.data)
  return {
    type: mapped.type,
    createdBy: mapped.createdBy ?? currentUserId ?? "anonymous",
    "@context": ctx,
    data: mapped.data,
    ...(mapped.tags && mapped.tags.length > 0 ? { tags: mapped.tags } : {}),
    ...(mapped.relations !== undefined ? { relations: mapped.relations } : {}),
  }
}

/**
 * Build the `updateItem` updates from a mapped submission. Pure for
 * testing. Unlike create, an explicit empty `tags: []` is preserved —
 * that's how a caller signals "clear the tag list". `tags` is dropped
 * from the patch only when it's `undefined` (no change requested).
 */
export function buildUpdatePayload(
  mapped: ItemEditorPayload,
  _existingItem: Item,
): Partial<Item> {
  const ctx = mapped["@context"] ?? deriveContext(mapped.type, mapped.data)
  return {
    data: mapped.data,
    "@context": ctx,
    ...(mapped.tags !== undefined ? { tags: mapped.tags } : {}),
    ...(mapped.relations !== undefined ? { relations: mapped.relations } : {}),
  }
}

/** Ändert `update` nichts an `stored`? (Leere Tags/Relationen gleich fehlenden.) */
function sameAsStored(update: Partial<Item>, stored: Item): boolean {
  const norm = (key: string, value: unknown) =>
    JSON.stringify(value ?? (key === "tags" || key === "relations" ? [] : null))
  return Object.entries(update).every(([key, value]) => norm(key, value) === norm(key, (stored as unknown as Record<string, unknown>)[key]))
}

/** Der Space des Formulars aus der Einreichung; leer = keiner. */
function formGroupOf(submission: ContentComposerSubmitData): string | undefined {
  const group = submission.data.group
  return typeof group === "string" && group !== "" ? group : undefined
}

/**
 * Anlegen in einem Schritt (shared-components → Space des Formulars, Regel
 * 6): mit `hasGroupScope()` direkt im Formular-Space
 * (`createItem(item, { group })`), nie anlegen und danach verschieben. Ohne
 * die Zusage legt der Connector im geöffneten Space an; zeigt das Formular
 * einen anderen, scheitert das Speichern, statt das Item still woanders
 * abzulegen (Regel 7).
 */
function createOptionsFor(connector: DataInterface, group: string | undefined): { group: string } | undefined {
  if (group === undefined) return undefined
  if (hasGroupScope(connector)) return { group }
  const open = hasGroups(connector) ? (connector.getCurrentGroup()?.id ?? null) : null
  if (open !== group) throw new Error("Dieser Speicher kann nur im geöffneten Space anlegen")
  return undefined
}

/**
 * Beim Bearbeiten: Wechselt der Space im Formular, verschiebt das Item
 * (`moveItemToGroup`, Regel 6). Die Zuordnung ist keine Item-Eigenschaft;
 * Mapper lassen `data.group` weg. No-op ohne Gruppen, ohne Wert oder wenn er
 * schon stimmt.
 */
async function applyItemGroup(
  connector: DataInterface,
  itemId: string,
  group: unknown,
): Promise<void> {
  if (typeof group !== "string" || group === "") return
  if (!hasItemGroups(connector)) return
  if (connector.getItemGroupId(itemId) === group) return
  await connector.moveItemToGroup(itemId, group)
}

/**
 * Open the composer and save an input as an item, including its space.
 *
 * @answers `{isOpen, mode, submit, remove, …}`
 * @without throws on call
 * @group write
 * @see story rls-foundations-hooks--write
 * @see spec docs/spec/02-data-interface.md
 */
export function useItemEditor(options: UseItemEditorOptions): UseItemEditorResult {
  const { currentUserId, mapSubmission, onCreated, onUpdated, onDeleted } = options
  const connector = useConnector()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()

  const [isOpen, setIsOpen] = useState(false)
  const [currentItem, setCurrentItem] = useState<Item | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mode: "create" | "edit" = currentItem ? "edit" : "create"

  const openCreate = useCallback(() => {
    setCurrentItem(null)
    setError(null)
    setIsOpen(true)
  }, [])

  const openEdit = useCallback((item: Item) => {
    setCurrentItem(item)
    setError(null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setError(null)
  }, [])

  const submit = useCallback(
    async (
      submission: ContentComposerSubmitData,
      submitOptions?: { existingItem?: Item; onError?: (error: Error) => void; onPersisted?: (item: Item) => void; resume?: boolean },
    ): Promise<Item | null> => {
      const existingItem = submitOptions?.existingItem ?? currentItem
      const activeMode: "create" | "edit" = existingItem ? "edit" : "create"
      const mapped = mapSubmission(submission, { mode: activeMode, existingItem })
      if (mapped === null) {
        // Intentional abort — clear any stale error so the UI doesn't
        // show one from a previous attempt.
        setError(null)
        return null
      }

      setIsSubmitting(true)
      setError(null)
      try {
        if (activeMode === "create") {
          const payload = buildCreatePayload(mapped, currentUserId)
          const created = await createItem(payload, createOptionsFor(connector, formGroupOf(submission)))
          submitOptions?.onPersisted?.(created)
          await applyStatements(connector, created, mapped.statements)
          await onCreated?.(created)
          return created
        }

        const update = buildUpdatePayload(mapped, existingItem!)
        const unchanged = submitOptions?.resume && sameAsStored(update, existingItem!)
        // Fortsetzen mit geänderten Feldern: Bearbeiten erreicht nur Items im
        // geöffneten Space. Liegt das angelegte Item woanders, sagt das
        // Formular es, statt zu scheitern oder etwas vorzutäuschen (Codex R2/1).
        if (submitOptions?.resume && !unchanged && !(await connector.getItem(existingItem!.id))) {
          throw new Error("Schon in einem anderen Space angelegt – Änderungen dort bearbeiten; ohne Änderung setzt „Erneut“ fort")
        }
        const updated = unchanged ? existingItem! : await updateItem(existingItem!.id, update)
        submitOptions?.onPersisted?.(updated)
        await applyItemGroup(connector, updated.id, submission.data.group)
        await applyStatements(connector, updated, mapped.statements)
        if (currentItem && currentItem.id === existingItem!.id) {
          setCurrentItem(updated)
        }
        await onUpdated?.(updated)
        return updated
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err))
        setError(wrapped)
        submitOptions?.onError?.(wrapped)
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [currentItem, mapSubmission, currentUserId, createItem, updateItem, onCreated, onUpdated, connector],
  )

  const remove = useCallback(async (itemId?: string) => {
    const id = itemId ?? currentItem?.id
    if (!id) return
    setIsSubmitting(true)
    setError(null)
    try {
      await deleteItem(id)
      await onDeleted?.(id)
      if (currentItem && currentItem.id === id) {
        setIsOpen(false)
        setCurrentItem(null)
      }
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err))
      setError(wrapped)
    } finally {
      setIsSubmitting(false)
    }
  }, [currentItem, deleteItem, onDeleted])

  return {
    isOpen,
    mode,
    currentItem,
    error,
    isSubmitting,
    openCreate,
    openEdit,
    close,
    submit,
    remove,
  }
}

/** Nach dem Speichern: die eigenen Aussagen, der Reihe nach (Fehler brechen ab und zeigen sich im Formular). */
async function applyStatements(connector: DataInterface, item: Item, statements: readonly OwnStatement[] | undefined): Promise<void> {
  for (const statement of statements ?? []) await writeOwnStatement(connector, item, statement)
}
