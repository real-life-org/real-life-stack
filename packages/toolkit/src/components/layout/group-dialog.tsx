import { useState, useCallback, useEffect, useRef } from "react"
import { LogOut, UserMinus, UserPlus, Check, Loader2, ImagePlus, X, Camera, Pencil, ChevronUp, ChevronDown, GripVertical, Plus } from "lucide-react"
import { getModule, getModules, defaultModuleIds, displayableModules } from "@/lib/module-register"
import { parseSpaceKinds, kindIdFromLabel, type SpaceKind } from "@/lib/space-kinds"
import type { Group, ContactInfo } from "@real-life-stack/data-interface"
import { useMembers } from "../../hooks/use-groups"
import { resolveAdminView } from "../../lib/group-admin-view"
import { cn } from "../../lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "../primitives/dialog"
import { Button } from "../primitives/button"
import { Input } from "../primitives/input"
import { Label } from "../primitives/label"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { Skeleton } from "../primitives/skeleton"

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// Modul-Katalog kommt aus dem Register — Spec 01, "Modul-Register", Regel 1:
// keine zweite Aufzaehlung von Modul-Ids. Frueher stand hier eine eigene
// Liste, und ein neu gebautes Modul liess sich dadurch in KEINEM Space
// aktivieren, obwohl es in der Uebersicht erschien.

/**
 * Move a module one position within the active list. `data.modules` is an
 * ORDERED array — the nav renders it verbatim — so this IS the surface for
 * "which module comes first". Out-of-range moves return the list unchanged.
 */
export function moveModule(modules: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = modules.indexOf(id)
  const to = from + direction
  if (from === -1 || to < 0 || to >= modules.length) return [...modules]
  const next = [...modules]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

/**
 * Move `id` to the drop position `toIndex`, counted in the list AS SHOWN
 * (i.e. including the dragged element). That is what a drop indicator between
 * two rows means, so the caller can pass the indicator index verbatim; once
 * the element is removed, everything behind it shifts by one, which is
 * corrected here. Out-of-range positions clamp, unknown ids are ignored.
 *
 * This is the whole ordering contract for drag & drop — one gesture instead
 * of N clicks on a button that moves away under the finger after each click.
 */
export function reorderModule(modules: readonly string[], id: string, toIndex: number): string[] {
  const from = modules.indexOf(id)
  if (from === -1) return [...modules]
  const clamped = Math.max(0, Math.min(toIndex, modules.length))
  const target = clamped > from ? clamped - 1 : clamped
  if (target === from) return [...modules]
  const next = [...modules]
  next.splice(from, 1)
  next.splice(target, 0, id)
  return next
}

/**
 * The subset of `data.modules` this dialog can actually render — unknown or
 * legacy ids have no entry in the module register and produce no row. Guards
 * and positions MUST count this list, not the raw one: otherwise a legacy id
 * silently satisfies the "keep at least one module" rule and the admin can
 * remove the last VISIBLE module, leaving a space with no usable tab
 * (rls#249). Order is preserved.
 */
export function knownModules(modules: readonly string[]): string[] {
  return displayableModules(modules)
}

// Voreinstellung fuer neue Spaces — beim Aufruf gelesen, nie als Konstante
// festgehalten: ein Snapshot auf Modulebene sieht eine spaeter gebundene
// App-Schicht nicht mehr (Review #277).
const defaults = () => defaultModuleIds()

/**
 * Serialize saves so a slow older request can never overwrite a newer state:
 * at most one save runs at a time; states arriving meanwhile collapse to the
 * LATEST one, sent exactly once after the running save settles. A failure
 * retries with the newer queued state if there is one; only a failure with
 * nothing newer surfaces via `onError`, which receives the value that was
 * lost AND the last CONFIRMED value — the correct rollback anchor. (The
 * caller's props may still show an older baseline while a store round-trip
 * is in flight; only the saver knows what was actually acknowledged.)
 */
export function createLatestWinsSaver<T>(
  save: (value: T) => Promise<void>,
  onError: (error: unknown, failedValue: T, lastSavedValue: T | undefined) => void,
  /** A save was confirmed — the moment to clear a stale failure notice. */
  onSaved?: (value: T) => void,
): (value: T) => void {
  let inFlight = false
  let queued: { value: T } | null = null
  let lastSaved: T | undefined
  const run = (value: T) => {
    inFlight = true
    // A synchronous throw from save() must flow into the SAME failure path as
    // a rejection — otherwise inFlight never resets and the saver locks up.
    let settling: Promise<void>
    try {
      settling = save(value)
    } catch (error) {
      settling = Promise.reject(error)
    }
    settling.then(
      () => {
        lastSaved = value
        inFlight = false
        onSaved?.(value)
        if (queued) {
          const next = queued.value
          queued = null
          run(next)
        }
      },
      (error) => {
        inFlight = false
        if (queued) {
          // Something newer is waiting — the failed state is obsolete anyway.
          const next = queued.value
          queued = null
          run(next)
        } else {
          onError(error, value, lastSaved)
        }
      },
    )
  }
  return (value: T) => {
    if (inFlight) queued = { value }
    else run(value)
  }
}

/** Human-readable fallback for raw IDs (e.g. DIDs) */
function shortName(id: string): string {
  return `User-${id.slice(-6)}`
}

// --- Types ---

export type GroupDialogMode =
  | { type: "create" }
  | { type: "edit"; group: Group }

/** Ein Netzwerk zur Auswahl: Id, Name und seine Arten (Spec 04, "Netzwerk und Space-Art"). */
export interface NetworkOption {
  id: string
  name: string
  kinds: readonly SpaceKind[]
}

/** Was beim Anlegen ausser dem Namen gewaehlt wurde. */
export interface GroupCreateData {
  isNetwork?: boolean
  network?: string
  kind?: string
}

/** Eine Art in Bearbeitung: `id` bleibt leer, bis sie zum ersten Mal gespeichert ist. */
type KindRow = SpaceKind

export interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: GroupDialogMode
  contacts?: ContactInfo[]
  /** Current user's ID (DID) — used to determine creator status */
  currentUserId?: string
  /**
   * Die Netzwerke, in denen der Mensch Mitglied ist (Spec 04, "Netzwerk").
   * Ohne Netzwerke zeigt der Dialog weder Netzwerk noch Art — die Flaeche
   * sieht dann aus wie vorher.
   */
  networks?: readonly NetworkOption[]
  /** Vorauswahl beim Anlegen: das gerade aktive Netzwerk. */
  currentNetworkId?: string | null
  /**
   * Der Link, der in einen Space fuehrt — fuer den Knopf auf der Landingpage
   * eines Netzwerks. Die App kennt Basispfad und Routen, das Toolkit nicht.
   */
  spaceLink?: (groupId: string, domain?: string) => string
  /** `data` traegt Netzwerk-Haekchen, Netzwerk und Art (Spec 04); fehlt, wenn nichts gewaehlt wurde. */
  onCreateGroup: (name: string, data?: GroupCreateData) => Promise<void>
  onUpdateGroup: (id: string, updates: Partial<Group>) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  onInviteMember?: (groupId: string, userId: string) => Promise<void>
  onRemoveMember?: (groupId: string, userId: string) => Promise<void>
}

/**
 * Native Auswahl mit einem leeren Eintrag. Ein Wert, den die Liste nicht
 * kennt, bleibt als roher Wert sichtbar und waehlbar: er stammt aus einer
 * anderen Liste oder Version und wird nie still ersetzt (Spec 04, Regel 5).
 * Native statt Radix, weil das Feld in einem Dialog sitzt und auf dem
 * Telefon den System-Picker oeffnen soll. `color-scheme` folgt dem
 * Dunkelmodus, sonst zeichnet der Browser die Liste hell auf hell.
 */
function NativeSelect({
  id,
  options,
  value,
  emptyLabel,
  onChange,
}: {
  id: string
  options: readonly { id: string; label: string }[]
  value: string
  emptyLabel: string
  onChange: (value: string) => void
}) {
  const unbekannt = value !== "" && !options.some((o) => o.id === value)
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none [color-scheme:light] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:[color-scheme:dark]"
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
      {unbekannt && <option value={value}>{value}</option>}
    </select>
  )
}

/**
 * Die Arten eines Netzwerks bearbeiten: Farbe, Einzahl, Mehrzahl je Zeile.
 * Gespeichert wird beim Verlassen eines Feldes und beim Entfernen — der
 * Schluessel einer Art entsteht beim ersten Speichern aus der Einzahl und
 * bleibt danach, damit Spaces beim Umbenennen zugeordnet bleiben.
 */
function KindsEditor({
  rows,
  onChange,
  onCommit,
  onRemove,
}: {
  rows: KindRow[]
  onChange: (rows: KindRow[]) => void
  onCommit: (rows: KindRow[]) => void
  onRemove: (rows: KindRow[], index: number) => void
}) {
  const update = (i: number, patch: Partial<KindRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((row, i) => (
        <div key={row.id || `neu-${i}`} className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label="Farbe"
            value={row.color ?? "#6b7280"}
            onChange={(e) => update(i, { color: e.target.value })}
            onBlur={() => onCommit(rows)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <Input
            value={row.label}
            placeholder="Einzahl, z.B. Stiftung"
            aria-label="Einzahl"
            className="h-8 text-sm"
            onChange={(e) => update(i, { label: e.target.value })}
            onBlur={() => onCommit(rows)}
          />
          <Input
            value={row.labelPlural}
            placeholder="Mehrzahl"
            aria-label="Mehrzahl"
            className="h-8 text-sm"
            onChange={(e) => update(i, { labelPlural: e.target.value })}
            onBlur={() => onCommit(rows)}
          />
          <button
            type="button"
            aria-label={`${row.label || "Art"} entfernen`}
            onClick={() => onRemove(rows, i)}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { id: "", label: "", labelPlural: "" }])}
        className="flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Art hinzufügen
      </button>
    </div>
  )
}

// --- Component ---

export function GroupDialog({
  open,
  onOpenChange,
  mode,
  contacts,
  currentUserId,
  networks = [],
  currentNetworkId = null,
  spaceLink,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onInviteMember,
  onRemoveMember,
}: GroupDialogProps) {
  const isEdit = mode.type === "edit"
  const groupId = isEdit ? mode.group.id : "__none__"
  const { data: members, isLoading: membersLoading } = useMembers(groupId)
  // Admin-gated controls follow the authoritative admin set (member.isAdmin,
  // derived from space.admins/createdBy), NOT list position: space.members is
  // DID-sorted, so members[0] is an arbitrary member. Backward-compatible for
  // connectors that don't annotate (falls back to members[0]) — see resolveAdminView.
  const { isAdmin: memberIsAdmin, currentUserIsAdmin } = resolveAdminView(members, currentUserId)
  const isCurrentUserAdmin = isEdit && currentUserIsAdmin

  const [name, setName] = useState(() =>
    isEdit ? mode.group.name : ""
  )
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupImage, setGroupImage] = useState(() =>
    isEdit ? (mode.group.data?.image as string | undefined) ?? "" : ""
  )

  // Netzwerk und Art (Spec 04, "Netzwerk und Space-Art"). Ein Space kann ein
  // Netzwerk sein UND zu einem gehoeren; ein Netzwerk traegt die Arten seiner
  // Gruppen. Leer = keins / keine.
  const [isNetwork, setIsNetwork] = useState(() => isEdit && mode.group.data?.isNetwork === true)
  const [network, setNetwork] = useState<string>(() =>
    isEdit
      ? (typeof mode.group.data?.network === "string" ? mode.group.data.network : "")
      : (currentNetworkId ?? "")
  )
  const [kind, setKind] = useState<string>(() =>
    isEdit && typeof mode.group.data?.kind === "string" ? mode.group.data.kind : ""
  )
  const [kindRows, setKindRows] = useState<KindRow[]>(() =>
    isEdit ? parseSpaceKinds(mode.group.data?.spaceKinds, "Arten") : []
  )
  // Domain der Landingpage eines Netzwerks: nur Auskunft und Link-Grundlage.
  const [domain, setDomain] = useState<string>(() =>
    isEdit && typeof mode.group.data?.domain === "string" ? mode.group.data.domain : ""
  )
  const [linkKopiert, setLinkKopiert] = useState(false)
  // Nur der Hostname, ohne Schema und Pfad; der Link wird daraus gebaut.
  const hostname = (d: string) => d.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()
  const link = isEdit && spaceLink ? spaceLink(mode.group.id, hostname(domain) || undefined) : ""
  // Ein Space ist nie sein eigenes Netzwerk.
  const otherNetworks = networks.filter((n) => !isEdit || n.id !== mode.group.id)
  const networkOptions = otherNetworks.map((n) => ({ id: n.id, label: n.name }))
  const availableKinds = otherNetworks.find((n) => n.id === network)?.kinds ?? []

  // Der Create-Dialog bleibt gemountet (fester key in der App): Beim Oeffnen
  // beginnt er frisch, mit dem gerade aktiven Netzwerk vorbelegt. Sonst erbt
  // die naechste Gruppe die Wahl der vorigen.
  useEffect(() => {
    if (!open || isEdit) return
    setIsNetwork(false)
    setNetwork(currentNetworkId ?? "")
    setKind("")
    setDomain("")
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // `null` entfernt den Schluessel (Patch-Vertrag, rls#234); `undefined`
  // ginge im JSON-Transport verloren und liesse den alten Wert stehen.
  // Im Create-Modus wird nichts gepatcht, die Werte gehen mit onCreateGroup.
  const patchData = (data: Record<string, unknown>, was: string) => {
    if (!isEdit) return
    setError(null)
    onUpdateGroup(mode.group.id, { data }).catch((err) => {
      setError(err instanceof Error ? err.message : `${was} konnte nicht gespeichert werden`)
    })
  }
  const handleIsNetworkChange = (value: boolean) => {
    setIsNetwork(value)
    patchData({ isNetwork: value ? true : null }, "Netzwerk")
  }
  const handleNetworkChange = (value: string) => {
    setNetwork(value)
    setKind("")
    patchData({ network: value || null, kind: null }, "Netzwerk")
  }
  const handleKindChange = (value: string) => {
    setKind(value)
    patchData({ kind: value || null }, "Art")
  }
  const commitDomain = () => {
    const clean = hostname(domain)
    setDomain(clean)
    const stored = isEdit && typeof mode.group.data?.domain === "string" ? mode.group.data.domain : ""
    if (clean === stored) return
    patchData({ domain: clean || null }, "Domain")
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setLinkKopiert(true)
      setTimeout(() => setLinkKopiert(false), 1500)
    } catch {
      setError("Link konnte nicht kopiert werden")
    }
  }

  // Arten speichern: wie die Modul-Liste ueber den Latest-wins-Saver, damit
  // zwei schnelle Aenderungen nicht in falscher Reihenfolge landen. Gespeichert
  // wird nur, was vollstaendig ist; eine bestehende Art, deren Name gerade
  // leer ist, behaelt ihren gespeicherten Stand. Loeschen geht nur ueber das ✕.
  const lastSavedKinds = useRef<SpaceKind[]>(isEdit ? parseSpaceKinds(mode.group.data?.spaceKinds, "Arten") : [])
  const saveKindsRef = useRef<((kinds: SpaceKind[]) => void) | null>(null)
  if (!saveKindsRef.current) {
    saveKindsRef.current = createLatestWinsSaver<SpaceKind[]>(
      (kinds) => {
        if (mode.type !== "edit") return Promise.resolve()
        return onUpdateGroup(mode.group.id, { data: { spaceKinds: kinds.length > 0 ? kinds : null } })
      },
      (err) => setError(err instanceof Error ? err.message : "Arten konnten nicht gespeichert werden"),
      (kinds) => { lastSavedKinds.current = kinds },
    )
  }
  const commitKinds = (rows: KindRow[]) => {
    const complete = (r: KindRow) => r.label.trim() !== "" && r.labelPlural.trim() !== ""
    const ids = new Set(rows.map((r) => r.id).filter(Boolean))
    // Neue, vollstaendige Zeilen bekommen jetzt ihren Schluessel: einmal, dauerhaft.
    const mitId = rows.map((r) => {
      if (r.id || !complete(r)) return r
      const id = kindIdFromLabel(r.label, ids)
      ids.add(id)
      return { ...r, id }
    })
    setKindRows(mitId)
    const gespeichert = lastSavedKinds.current
    const zumSpeichern = mitId
      .filter((r) => r.id)
      .map((r) => (complete(r) ? r : gespeichert.find((k) => k.id === r.id)))
      .filter((r): r is KindRow => r !== undefined)
    const clean = parseSpaceKinds(zumSpeichern, "Arten")
    if (JSON.stringify(clean) === JSON.stringify(gespeichert)) return
    setError(null)
    saveKindsRef.current?.(clean)
  }
  const removeKind = (rows: KindRow[], index: number) => commitKinds(rows.filter((_, j) => j !== index))

  // Module state
  const [activeModules, setActiveModules] = useState<string[]>(() =>
    isEdit ? (mode.group.data?.modules as string[] | undefined) ?? defaults() : defaults()
  )

  // Module-save errors get their OWN state: sharing the dialog-wide `error`
  // state made ownership ambiguous — a successful module save could only
  // guess (flag, then message equality) whether the shown error was its own,
  // and two operations failing with the same text (`Network request failed`)
  // still collided. Separate state = ownership by construction (rls#232).
  const [moduleError, setModuleError] = useState<string | null>(null)

  // Persisting the module list: rapid ↑/↓ clicks fire faster than a save
  // round-trips, and two in-flight saves can settle out of order — the older
  // one would then win in the store. The saver serializes to one in-flight
  // save with latest-wins; it lives in a ref (stable for the dialog's
  // lifetime) and reads mode/onUpdateGroup through refs. The payload is a
  // minimal PATCH ({modules} only) — updateGroup merges per key (rls#234),
  // so this writer cannot erase image/accent saved by another writer.
  const modeRef = useRef(mode)
  modeRef.current = mode
  const onUpdateGroupRef = useRef(onUpdateGroup)
  onUpdateGroupRef.current = onUpdateGroup
  const saveModulesRef = useRef<((modules: string[]) => void) | null>(null)
  if (!saveModulesRef.current) {
    saveModulesRef.current = createLatestWinsSaver<string[]>(
      (modules) => {
        const current = modeRef.current
        if (current.type !== "edit") return Promise.resolve()
        return onUpdateGroupRef.current(current.group.id, { data: { modules } })
      },
      (err, _failed, lastSaved) => {
        // Roll the UI back to the last CONFIRMED order — a silently divergent
        // list would suggest the reorder stuck when it didn't. The saver's
        // lastSaved beats the prop: after "A saved, B failed" the group prop
        // may still show the state before A (store round-trip in flight).
        const current = modeRef.current
        setActiveModules(
          lastSaved ??
            (current.type === "edit"
              ? ((current.group.data?.modules as string[] | undefined) ?? defaults())
              : defaults()),
        )
        setModuleError(err instanceof Error ? err.message : "Module konnten nicht gespeichert werden")
      },
      () => setModuleError(null),
    )
  }
  const applyModules = useCallback((next: string[]) => {
    setActiveModules(next)
    saveModulesRef.current?.(next)
  }, [])

  // Drag & drop reordering. `dropIndex` is the position in the list AS SHOWN
  // (0 = above the first row), which is exactly what the indicator line
  // between two rows means — reorderModule corrects for the removal shift.
  const [draggedModule, setDraggedModule] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Which row currently holds keyboard focus on its reorder buttons. Explicit
  // state instead of a `focus-visible:` utility: the arrows must be INVISIBLE
  // for mouse users (they drag) yet VISIBLE the moment a keyboard reaches
  // them — an invisible focused control is worse than a noisy one.
  const [keyboardRow, setKeyboardRow] = useState<string | null>(null)
  // Only renderable modules drive rows, guards and drop positions; unknown
  // ids stay untouched in data.modules (we never silently drop foreign data).
  const visibleModules = knownModules(activeModules)
  /**
   * Rows, guards and drop indices all count VISIBLE modules, so reordering
   * happens on that list. Unknown/legacy ids are preserved (we never silently
   * drop foreign data) and appended — their position is irrelevant because
   * neither this dialog nor the nav renders them.
   */
  const applyVisibleOrder = useCallback((nextVisible: string[]) => {
    const unknown = activeModules.filter((id) => !visibleModules.includes(id))
    applyModules([...nextVisible, ...unknown])
  }, [activeModules, visibleModules, applyModules])

  const handleModuleDragOver = useCallback((event: React.DragEvent, rowIndex: number) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    // Above the row's midpoint means "in front of it", below means "after it".
    const rect = event.currentTarget.getBoundingClientRect()
    const next = event.clientY < rect.top + rect.height / 2 ? rowIndex : rowIndex + 1
    setDropIndex((prev) => (prev === next ? prev : next))
  }, [])

  const handleModuleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const id = draggedModule
    const target = dropIndex
    setDraggedModule(null)
    setDropIndex(null)
    if (!id || target === null) return
    const next = reorderModule(visibleModules, id, target)
    // An unchanged order must not trigger a save — a drop onto the row's own
    // position is a no-op, not an edit.
    if (next.length === visibleModules.length && next.every((mod, i) => mod === visibleModules[i])) return
    applyVisibleOrder(next)
  }, [draggedModule, dropIndex, visibleModules, applyVisibleOrder])

  // Invite state
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [inviteErrors, setInviteErrors] = useState<Map<string, string>>(new Map())

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfirmDelete(false)
        setError(null)
        setModuleError(null)
        setInvitingId(null)
        setInvitedIds(new Set())
        setInviteErrors(new Map())
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onCreateGroup(name.trim(), {
        isNetwork: isNetwork || undefined,
        network: network || undefined,
        kind: kind || undefined,
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen")
    } finally {
      setSaving(false)
    }
  }

  const handleNameBlur = () => {
    if (!isEdit || !name.trim() || name.trim() === mode.group.name) return
    setError(null)
    onUpdateGroup(mode.group.id, { name: name.trim() }).catch((err) => {
      setError(err instanceof Error ? err.message : "Fehler beim Umbenennen")
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isEdit) return
    if (!file.type.startsWith("image/")) return
    try {
      const { resizeImage, dominantColor } = await import("../../lib/image-utils")
      const dataUrl = await resizeImage(file, 200, 0.8)
      setGroupImage(dataUrl)
      // Cache the logo's dominant color as the space accent (once, here). On a
      // grayscale logo dominantColor returns null -> clear it so reads fall
      // back to the deterministic id color.
      const primaryColor = await dominantColor(dataUrl).catch(() => null)
      // Minimal patch — updateGroup merges per key (null removes), so this
      // cannot clobber e.g. a module order saved meanwhile (rls#234).
      void onUpdateGroup(mode.group.id, {
        data: { image: dataUrl, primaryColor },
      })
    } catch {
      setError("Bild konnte nicht verarbeitet werden")
    }
    e.target.value = ""
  }

  const handleImageRemove = () => {
    if (!isEdit) return
    setGroupImage("")
    // Drop the cached accent too, so it falls back to the deterministic id
    // color — `null` removes the key (patch contract), `undefined` would be
    // dropped by JSON transports and leave the stale accent behind.
    void onUpdateGroup(mode.group.id, { data: { image: "", primaryColor: null } })
  }

  const handleLeave = async () => {
    if (!isEdit) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onDeleteGroup(mode.group.id)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Verlassen")
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  const handleInviteContact = async (contactId: string) => {
    if (!isEdit || !onInviteMember) return
    setInvitingId(contactId)
    setInviteErrors((prev) => { const m = new Map(prev); m.delete(contactId); return m })
    try {
      await onInviteMember(mode.group.id, contactId)
      setInvitedIds((prev) => new Set([...prev, contactId]))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Einladung fehlgeschlagen"
      setInviteErrors((prev) => new Map([...prev, [contactId, msg]]))
    } finally {
      setInvitingId(null)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!isEdit || !onRemoveMember) return
    setError(null)
    try {
      await onRemoveMember(mode.group.id, userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Entfernen")
    }
  }

  const memberIds = new Set(members.map((m) => m.id))
  const invitableContacts = (contacts ?? []).filter(
    (c) => c.status === "active" && !memberIds.has(c.id) && !invitedIds.has(c.id)
  )
  const justInvitedContacts = (contacts ?? []).filter(
    (c) => invitedIds.has(c.id) && !memberIds.has(c.id)
  )

  // --- Create Mode ---
  if (!isEdit) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
          <div className="px-6 pt-7 pb-5">
            <DialogTitle className="text-lg font-semibold">Neue Gruppe</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Erstelle eine neue Gruppe fuer dein Team.</p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="group-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Nachbarschaft, Projekt-Team..."
                autoFocus
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isNetwork}
                onChange={(e) => handleIsNetworkChange(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Als Netzwerk anlegen
            </label>
            {otherNetworks.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="group-network" className="text-xs text-muted-foreground">{isNetwork ? "Gehört zum Netzwerk" : "Netzwerk"}</Label>
                <NativeSelect id="group-network" options={networkOptions} value={network} emptyLabel="Keins" onChange={handleNetworkChange} />
              </div>
            )}
            {availableKinds.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="group-kind" className="text-xs text-muted-foreground">Art</Label>
                <NativeSelect id="group-kind" options={availableKinds} value={kind} emptyLabel="Keine" onChange={handleKindChange} />
              </div>
            )}
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? "Erstellen..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // --- Edit Mode ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden max-h-[90dvh] flex flex-col" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{isEdit ? mode.group.name : "Neue Gruppe"}</DialogTitle>
        {/* Der Koerper scrollt, die Fusszeile bleibt stehen — ein Space mit
            Netzwerk, Arten, Mitgliedern und Modulen ist laenger als ein Schirm. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Group Identity Header */}
        <div className="relative px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            {/* Group Image */}
            <div className="relative group shrink-0">
              {groupImage ? (
                <>
                  <img src={groupImage} alt={name} className="w-14 h-14 rounded-xl object-cover ring-2 ring-background shadow-sm" />
                  <button
                    onClick={handleImageRemove}
                    className="absolute -top-1 -right-1 p-0.5 bg-destructive text-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <label className="absolute -bottom-0.5 -right-0.5 p-1 bg-card border border-border rounded-full shadow-sm cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent">
                    <Camera className="h-2.5 w-2.5 text-muted-foreground" />
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </>
              ) : (
                <label className="w-14 h-14 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 flex items-center justify-center cursor-pointer transition-all hover:bg-muted/50">
                  <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Name Input */}
            <div className="flex-1 min-w-0 pt-1 group/name">
              <div className="relative">
                <Input
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameBlur}
                  className="h-8 text-base font-semibold border-transparent shadow-none bg-transparent -ml-1.5 px-1 min-w-32 max-w-[calc(100%-2rem)] hover:bg-muted/50 focus:shadow-sm focus:bg-card focus:border-input focus:ml-0 focus:px-2 focus:max-w-[calc(100%-2rem)] transition-all truncate"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleNameBlur()
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => nameInputRef.current?.focus()}
                  className="absolute top-1/2 -translate-y-1/2 group-focus-within/name:hidden text-muted-foreground/30 group-hover/name:text-muted-foreground/60 transition-colors"
                  style={{ left: `${Math.min(name.length + 1, 20)}ch` }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {membersLoading ? "Mitglieder werden geladen…" : `${members.length} Mitglieder`}
              </p>
            </div>
          </div>
        </div>

        {/* Netzwerk und Art (Spec 04): der Admin waehlt, Mitglieder lesen. Was
            einer nicht darf, erscheint nicht — kein ausgegrauter Regler. */}
        {isCurrentUserAdmin ? (
          <div className="px-6 pb-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isNetwork}
                onChange={(e) => handleIsNetworkChange(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Dieser Space ist ein Netzwerk
            </label>
            {isNetwork && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Arten der Gruppen in diesem Netzwerk</Label>
                  <KindsEditor rows={kindRows} onChange={setKindRows} onCommit={commitKinds} onRemove={removeKind} />
                </div>
                <div>
                  <Label htmlFor="group-domain" className="text-xs text-muted-foreground">Domain der Landingpage</Label>
                  <Input
                    id="group-domain"
                    value={domain}
                    placeholder="z.B. lichtung.ooo"
                    className="mt-1.5 h-9 text-sm"
                    onChange={(e) => setDomain(e.target.value)}
                    onBlur={commitDomain}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDomain() } }}
                  />
                </div>
                {link && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Link für den Knopf auf eurer Landingpage</Label>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Input readOnly value={link} className="h-9 text-sm" onFocus={(e) => e.currentTarget.select()} />
                      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={copyLink}>
                        {linkKopiert ? <Check className="h-3.5 w-3.5" /> : "Kopieren"}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Führt Mitglieder direkt hinein. Wer noch kein Mitglied ist, braucht eine Einladung.
                    </p>
                  </div>
                )}
              </>
            )}
            {/* Ein Netzwerk kann zugleich zu einem anderen gehoeren — die
                Lichtung ist ein Projekt in Real Life und selbst ein Netzwerk. */}
            {otherNetworks.length > 0 && (
              <div>
                <Label htmlFor="group-network" className="text-xs text-muted-foreground">
                  {isNetwork ? "Gehört zum Netzwerk" : "Netzwerk"}
                </Label>
                <div className="mt-1.5">
                  <NativeSelect id="group-network" options={networkOptions} value={network} emptyLabel="Keins" onChange={handleNetworkChange} />
                </div>
              </div>
            )}
            {availableKinds.length > 0 && (
              <div>
                <Label htmlFor="group-kind" className="text-xs text-muted-foreground">Art</Label>
                <div className="mt-1.5">
                  <NativeSelect id="group-kind" options={availableKinds} value={kind} emptyLabel="Keine" onChange={handleKindChange} />
                </div>
              </div>
            )}
          </div>
        ) : isNetwork || network || kind ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            {[
              isNetwork ? (domain ? `Netzwerk · ${domain}` : "Netzwerk") : undefined,
              otherNetworks.find((n) => n.id === network)?.name,
              availableKinds.find((k) => k.id === kind)?.label ?? (kind || undefined),
            ].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        {/* Members */}
        <div className="px-6 pb-2">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {membersLoading &&
              members.length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`member-skeleton-${i}`} className="flex items-center gap-2.5 px-2 py-1.5" aria-hidden>
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              ))}
            {members.map((member) => (
              <div
                key={member.id}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-7 w-7">
                  {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.displayName ?? shortName(member.id))}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm">
                  {member.displayName ?? shortName(member.id)}
                </span>
                {memberIsAdmin(member) && (
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded-full">Admin</span>
                )}
                {isCurrentUserAdmin && onRemoveMember && member.id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveMember(member.id)}
                    title="Mitglied entfernen"
                    className="h-6 w-6 opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}

            {/* Just invited feedback */}
            {justInvitedContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 bg-green-500/5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] bg-green-500/10 text-green-700">
                    {getInitials(c.name ?? shortName(c.id))}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm">{c.name ?? shortName(c.id)}</span>
                <Check className="h-3.5 w-3.5 text-green-600" />
              </div>
            ))}
          </div>

          {/* Invite Section */}
          {onInviteMember && invitableContacts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Kontakt einladen</Label>
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {invitableContacts.map((contact) => {
                  const isInviting = invitingId === contact.id
                  const inviteError = inviteErrors.get(contact.id)
                  return (
                    <div key={contact.id}>
                      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                        <Avatar className="h-7 w-7">
                          {contact.avatar && <AvatarImage src={contact.avatar} />}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(contact.name ?? contact.id)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm">{contact.name ?? shortName(contact.id)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleInviteContact(contact.id)}
                          disabled={isInviting || invitingId !== null}
                        >
                          {isInviting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <UserPlus className="h-3 w-3" />
                          )}
                          <span className="ml-1">Einladen</span>
                        </Button>
                      </div>
                      {inviteError && (
                        <p className="text-xs text-destructive ml-11 -mt-0.5 mb-1">{inviteError}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* No contacts hint */}
          {onInviteMember && invitableContacts.length === 0 && justInvitedContacts.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
              {(contacts ?? []).some((c) => c.status === "active")
                ? "Alle Kontakte sind bereits Mitglied."
                : "Keine verifizierten Kontakte."}
            </p>
          )}

          {/* Modules (admin only): the ACTIVE list is ordered — data.modules
              is what the nav renders, top row = first tab. Reorder by DRAGGING
              a row (one gesture, any distance), deactivate via ✕; available
              modules append at the end. The ↑/↓ buttons stay as the keyboard
              path and appear ONLY on keyboard focus — with the mouse you
              drag, so showing them on hover was pure noise. Dragging alone
              would lock out keyboard and screen-reader users. */}
          {isCurrentUserAdmin && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Module (ziehen zum Sortieren)</Label>
              <div className="mt-2 space-y-0.5" onDragOver={(e) => e.preventDefault()} onDrop={handleModuleDrop}>
                {visibleModules.map((id, index) => {
                  const mod = getModule(id)!
                  const Icon = mod.icon
                  // Guard and positions count the VISIBLE rows — a legacy id
                  // must not silently satisfy "keep one module" (rls#249).
                  const isOnly = visibleModules.length === 1
                  const isDragged = draggedModule === id
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move"
                        // Firefox starts no drag without payload.
                        e.dataTransfer.setData("text/plain", id)
                        setDraggedModule(id)
                      }}
                      onDragEnd={() => { setDraggedModule(null); setDropIndex(null) }}
                      onDragOver={(e) => handleModuleDragOver(e, index)}
                      className={cn(
                        "group relative flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 active:cursor-grabbing",
                        isDragged && "opacity-40",
                        // Drop indicator: a line on the edge the row would land on.
                        dropIndex === index && "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded-full before:bg-primary",
                        dropIndex === index + 1 && "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
                      )}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm">{mod.label}</span>
                      {/* Keyboard path — appears only while focused (see keyboardRow). */}
                      <button
                        type="button"
                        aria-label={`${mod.label} nach oben`}
                        disabled={index === 0}
                        onClick={() => applyVisibleOrder(moveModule(visibleModules, id, -1))}
                        onFocus={() => setKeyboardRow(id)}
                        onBlur={() => setKeyboardRow((prev) => (prev === id ? null : prev))}
                        className={cn(
                          "rounded p-1 text-muted-foreground transition-opacity hover:text-foreground",
                          keyboardRow === id ? "opacity-100 disabled:opacity-30" : "opacity-0",
                        )}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${mod.label} nach unten`}
                        disabled={index === visibleModules.length - 1}
                        onClick={() => applyVisibleOrder(moveModule(visibleModules, id, 1))}
                        onFocus={() => setKeyboardRow(id)}
                        onBlur={() => setKeyboardRow((prev) => (prev === id ? null : prev))}
                        className={cn(
                          "rounded p-1 text-muted-foreground transition-opacity hover:text-foreground",
                          keyboardRow === id ? "opacity-100 disabled:opacity-30" : "opacity-0",
                        )}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${mod.label} deaktivieren`}
                        disabled={isOnly}
                        onClick={() => applyVisibleOrder(visibleModules.filter((m) => m !== id))}
                        className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              {getModules().some((m) => !activeModules.includes(m.id)) && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Verfügbar</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {getModules().filter((m) => !activeModules.includes(m.id)).map((mod) => {
                      const Icon = mod.icon
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => applyVisibleOrder([...visibleModules, mod.id])}
                          className="flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                        >
                          <Icon className="h-3 w-3" />
                          {mod.label} +
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Errors: module-save failures have their own state (ownership by
            construction, rls#232) and can coexist with a general error. */}
        {moduleError && (
          <p className="text-xs text-destructive px-6 pb-2">{moduleError}</p>
        )}
        {error && (
          <p className="text-xs text-destructive px-6 pb-2">{error}</p>
        )}

        {/* Footer */}
        </div>
        <DialogFooter className="flex-row! px-6 py-3 border-t bg-muted/20">
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            onClick={handleLeave}
            disabled={saving}
            className="mr-auto"
          >
            <LogOut className="h-3.5 w-3.5 mr-1" />
            {confirmDelete ? "Wirklich verlassen?" : "Verlassen"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Schliessen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
