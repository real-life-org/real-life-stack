import { useState, useCallback, useRef } from "react"
import { LogOut, UserMinus, UserPlus, Check, Loader2, ImagePlus, X, Camera, Pencil, ChevronUp, ChevronDown, GripVertical, Users, LayoutGrid, Search, Contrast, Check as CheckIcon, RotateCcw, type LucideIcon } from "lucide-react"
import { getModule, getModules, defaultModuleIds, displayableModules } from "@/lib/module-register"
import type { Group, ContactInfo } from "@real-life-stack/data-interface"
import { useMembers } from "../../hooks/use-groups"
import { resolveAdminView } from "../../lib/group-admin-view"
import { cn, getReadableTextColor, getSpacePrimaryColor, resolveAssetUrl, SPACE_COLOR_SWATCHES } from "../../lib/utils"
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

/** Die Bereiche der Space-Konfiguration (Entwurf "Space Menu", Turn 3/4). */
export type SpaceConfigSectionId = "members" | "modules" | "invite" | "theme"

export interface SpaceConfigSection {
  id: SpaceConfigSectionId
  label: string
  icon: LucideIcon
}

/**
 * Welche Bereiche dieser Dialog zeigt — die EINE Stelle, die das beantwortet.
 *
 * Menue, Inhalte und Startwert fragen alle hier; sonst waere dieselbe Liste
 * dreimal geschrieben und liefe lautlos auseinander, wie es die fuenf
 * Modul-Listen vor dem Modul-Register (Spec 01) getan haben.
 *
 * Bild und Name sind KEIN Bereich: sie stehen im Kopf, wo sie immer sichtbar
 * und immer aenderbar sind.
 *
 * Module sind Admin-Sache: wer sie nicht aendern darf, bekommt keinen leeren
 * Bereich zu sehen, sondern gar keinen.
 *
 * Einladen ist ein eigener Bereich, kein Unterzustand von Mitgliedern
 * (Entwurf Turn 4), und haengt NICHT am Adminrecht: im WoT laedt jedes
 * Mitglied ein, nur der Creator entfernt.
 *
 * Aussehen dagegen IST Admin-Sache wie die Module: das Design eines Space ist
 * geteilte Wirklichkeit, kein persoenlicher Geschmack. Reihenfolge: erst die
 * Menschen, dann das Aussehen, dann die Flaechen.
 */
export function spaceConfigSections({
  isAdmin,
  canInvite,
  canTheme,
}: {
  isAdmin: boolean
  canInvite: boolean
  canTheme: boolean
}): SpaceConfigSection[] {
  const sections: SpaceConfigSection[] = [
    { id: "members", label: "Mitglieder", icon: Users },
  ]
  if (canInvite) sections.push({ id: "invite", label: "Einladen", icon: UserPlus })
  if (canTheme) sections.push({ id: "theme", label: "Aussehen", icon: Contrast })
  if (isAdmin) sections.push({ id: "modules", label: "Module", icon: LayoutGrid })
  return sections
}

/**
 * Welcher Farbvorschlag den Haken traegt.
 *
 * Die geltende Farbe kann aus dem Space-Bild stammen (`dominantColor`) oder
 * deterministisch aus der Id abgeleitet sein — beides trifft die Palette in
 * aller Regel nicht. Dann ist "custom" die richtige Antwort, nicht "keine":
 * es gilt ja eine Farbe, sie steht nur nicht zur Auswahl.
 */
export function activeSpaceSwatch(effectiveColor: string): string {
  const hex = effectiveColor.toLowerCase()
  return SPACE_COLOR_SWATCHES.includes(hex) ? hex : "custom"
}

/**
 * Die Kontaktliste im Bereich "Einladen" (Entwurf 4a): dieselbe Quelle wie
 * zuvor der Picker — aktiv, nicht Mitglied, nicht gerade eingeladen —, nur
 * zusaetzlich nach Suchbegriff gefiltert. Gesucht wird ueber Name UND
 * Kennung: ohne gesetzten Namen ist die Kennung alles, was eine Zeile
 * unterscheidet.
 */
export function filterInvitableContacts<T extends { id: string; name?: string }>(
  contacts: readonly T[],
  search: string,
): T[] {
  const needle = search.trim().toLowerCase()
  if (!needle) return [...contacts]
  return contacts.filter(
    (c) =>
      (c.name ?? "").toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle),
  )
}

/**
 * Haelt die Auswahl auf einem Bereich, den es wirklich gibt.
 *
 * `isAdmin` stammt aus den Mitgliedern und steht beim Oeffnen noch nicht fest
 * (useMembers laedt). Der Modul-Bereich kann darum nach dem ersten Rendern
 * verschwinden — der Dialog zeigte dann den Inhalt eines Eintrags an, den es
 * nicht mehr gibt. Der Rueckfall ist der erste Bereich.
 */
export function resolveConfigSection(
  requested: SpaceConfigSectionId,
  sections: readonly SpaceConfigSection[],
): SpaceConfigSectionId {
  return sections.some((s) => s.id === requested) ? requested : sections[0].id
}

/** Ab wie vielen Mitgliedern die Liste ein Suchfeld bekommt. */
const MEMBER_SEARCH_THRESHOLD = 8

/**
 * Ob die Mitgliederliste ein Suchfeld zeigt.
 *
 * Sichtbarkeit des Feldes und Wirksamkeit des Filters MUESSEN dieselbe Frage
 * beantworten. Vorher hing das Feld an der Mitgliederzahl und der Filter am
 * Suchbegriff: sank die Zahl waehrend einer Suche unter die Schwelle — weil
 * das gesuchte Mitglied entfernt wurde oder eine Synchronisierung eintraf —
 * verschwand das Feld, der Suchbegriff blieb, und die verbliebenen
 * Mitglieder waren nicht mehr erreichbar. Ohne Feld liess sich der Filter
 * auch nicht loeschen; nur Schliessen und Wiederoeffnen half (#377).
 *
 * Darum haelt ein eingegebener Suchbegriff das Feld offen, unabhaengig von
 * der Zahl. Es verschwindet erst, wenn die Suche geleert ist.
 */
export function showsMemberSearch(memberCount: number, search: string): boolean {
  return memberCount > MEMBER_SEARCH_THRESHOLD || search !== ""
}

/**
 * Teilt die Mitglieder in Admins und uebrige und filtert sie nach Suchbegriff
 * (Entwurf "Space Menu", 3a).
 *
 * `members` ist nach DID sortiert, das Admin-Abzeichen stand also an
 * beliebiger Stelle einer flachen Liste — wer den Space verwaltet, war nicht
 * auf einen Blick erkennbar. Gesucht wird ueber Anzeigename UND Kennung:
 * ohne gesetzten Namen ist die Kennung alles, was eine Zeile unterscheidet.
 */
export function groupMembersForDisplay<T extends { id: string; displayName?: string }>(
  members: readonly T[],
  isAdmin: (member: T) => boolean,
  search: string,
): { admins: T[]; others: T[] } {
  const needle = search.trim().toLowerCase()
  const matches = (m: T) =>
    !needle ||
    (m.displayName ?? "").toLowerCase().includes(needle) ||
    m.id.toLowerCase().includes(needle)
  const visible = members.filter(matches)
  return {
    admins: visible.filter(isAdmin),
    others: visible.filter((m) => !isAdmin(m)),
  }
}

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

/** Ueberschrift einer Mitglieder-Gruppe (Entwurf "Space Menu", 3a). */
function MemberGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-2.5 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  )
}

// --- Types ---

export type GroupDialogMode =
  | { type: "create" }
  | { type: "edit"; group: Group }

export interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: GroupDialogMode
  contacts?: ContactInfo[]
  /** Current user's ID (DID) — used to determine creator status */
  currentUserId?: string
  onCreateGroup: (name: string) => Promise<void>
  onUpdateGroup: (id: string, updates: Partial<Group>) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  onInviteMember?: (groupId: string, userId: string) => Promise<void>
  onRemoveMember?: (groupId: string, userId: string) => Promise<void>
}

// --- Component ---

export function GroupDialog({
  open,
  onOpenChange,
  mode,
  contacts,
  currentUserId,
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
  // Eigener Zustand wie beim Modul-Fehler: haengt die Farbe am gemeinsamen
  // `error`, loescht ihr Erfolg die Meldung des Umbenennens oder Einladens
  // gleich mit. Zugehoerigkeit durch Konstruktion, nicht durch Vermutung
  // (rls#232).
  const [colorError, setColorError] = useState<string | null>(null)

  // Das gewaehlte Fach. `tabs` haengt an isCurrentUserAdmin, das aus den
  // Mitgliedern abgeleitet wird und beim Oeffnen noch nicht feststeht — daher
  // laeuft die Auswahl durch resolveConfigTab, statt roh an Radix zu gehen.
  const [requestedSection, setRequestedSection] = useState<SpaceConfigSectionId>("members")
  const sections = spaceConfigSections({
    isAdmin: isCurrentUserAdmin,
    canInvite: Boolean(onInviteMember),
    canTheme: isCurrentUserAdmin,
  })
  const activeSection = resolveConfigSection(requestedSection, sections)
  /** Suche in der Mitgliederliste (Entwurf 3a). */
  const [memberSearch, setMemberSearch] = useState("")
  /** Suche in der Kontaktliste des Bereichs "Einladen" (Entwurf 4a). */
  const [inviteSearch, setInviteSearch] = useState("")

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

  // Die gewaehlte Primaerfarbe liegt lokal, aus demselben Grund wie Name,
  // Bild und Modulliste: `mode.group` ist ein SNAPSHOT vom Oeffnen, den die
  // App nicht nachfuehrt, solange der Dialog steht. Direkt daraus gelesen
  // bewegte sich der Haken nach einem Klick nicht — gespeichert wurde, aber
  // es sah aus, als sei nichts passiert.
  const [primaryColorChoice, setPrimaryColorChoice] = useState<string | null>(() =>
    mode.type === "edit" ? ((mode.group.data?.primaryColor as string | undefined) ?? null) : null,
  )
  /**
   * Das Ziel haengt am WERT, nicht am Zeitpunkt der Ausfuehrung. Der Saver
   * lebt so lange wie der Dialog; ein eingereihter Vorgang laeuft erst, wenn
   * der vorige settled ist. Laese er das Ziel dann aus `modeRef`, schriebe er
   * in den Space, der inzwischen offen ist — ein fremder Space bekaeme still
   * die Farbe, die man dem vorigen zugedacht hatte.
   */
  /**
   * Laufende Nummer der Farbabsicht. Jede bewusste Wahl und jedes Entfernen
   * des Bildes zaehlt hoch; ein Zuruecksetzen, dessen Bildfarbe erst danach
   * eintrifft, erkennt daran, dass es ueberholt ist.
   */
  const colorRequestRef = useRef(0)

  /**
   * Die EINE Stelle, an der die angezeigte Farbe umgesetzt wird.
   *
   * `primaryColor` hat drei Schreibwege — die bewusste Wahl, das Entfernen
   * des Bildes und der Upload. Jeder MUSS hier durch, sonst zeigt der Dialog
   * eine andere Farbe als die App daneben. Genau das passierte, als die
   * ersten beiden einzeln nachgezogen wurden und der dritte liegen blieb.
   *
   * Die laufende Nummer entwertet zugleich ein Zuruecksetzen, dessen
   * Bildfarbe erst danach eintrifft: sie gehoerte zu einem frueheren Stand.
   */
  const rememberPrimaryColor = (hex: string | null) => {
    colorRequestRef.current++
    setPrimaryColorChoice(hex)
  }
  const savePrimaryColorRef = useRef<((v: { groupId: string; hex: string | null }) => void) | null>(null)
  if (!savePrimaryColorRef.current) {
    savePrimaryColorRef.current = createLatestWinsSaver<{ groupId: string; hex: string | null }>(
      ({ groupId: target, hex }) =>
        // Minimaler PATCH: `null` loescht den Schluessel und stellt damit den
        // Rueckfall her (Spec 04 Regel 3), ohne image/modules zu beruehren.
        onUpdateGroupRef.current(target, { data: { primaryColor: hex } }),
      (err, failed, lastSaved) => {
        const current = modeRef.current
        // Ein Fehlschlag fuer einen anderen Space darf die Anzeige des
        // gerade offenen nicht anfassen — gemeldet wird er trotzdem.
        if (current.type === "edit" && failed.groupId === current.group.id) {
          // Zurueck auf den zuletzt BESTAETIGTEN Wert — ein Haken auf einer
          // Farbe, die nie ankam, behauptet eine Aenderung, die es nicht gibt.
          setPrimaryColorChoice(
            lastSaved?.groupId === current.group.id
              ? lastSaved.hex
              : ((current.group.data?.primaryColor as string | undefined) ?? null),
          )
        }
        setColorError(err instanceof Error ? err.message : "Farbe konnte nicht gespeichert werden")
      },
      () => setColorError(null),
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
        setColorError(null)
        setInvitingId(null)
        setInvitedIds(new Set())
        setInviteErrors(new Map())
        // Der Dialog bleibt zwischen zwei Aufrufen montiert. Ohne diesen
        // Rueckfall oeffnete er fuer den NAECHSTEN Space im zuletzt
        // gewaehlten Bereich — mit Suchbegriff und offenem Kontakt-Picker
        // eines anderen Space.
        setRequestedSection("members")
        setMemberSearch("")
        setInviteSearch("")
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
      await onCreateGroup(name.trim())
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
      // Derselbe Weg wie die beiden anderen Schreiber: erst merken, dann
      // speichern. Ohne das behielt der Dialog die vorige Farbe, waehrend
      // die App schon die des neuen Logos trug.
      rememberPrimaryColor(primaryColor)
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
    // Der Patch unten verwirft `primaryColor` — die Anzeige muss mit.
    rememberPrimaryColor(null)
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

  const { admins: shownAdmins, others: shownOthers } = groupMembersForDisplay(
    members,
    memberIsAdmin,
    memberSearch,
  )

  const shownInvitable = filterInvitableContacts(invitableContacts, inviteSearch)

  /**
   * Die Farbe, die gerade GILT — gesetzter Wert, sonst die aus dem Logo
   * gewonnene, sonst der deterministische Rueckfall aus der Space-Id
   * (Spec 04, "Space-Primaerfarbe", Regel 3/5).
   */
  const effectiveColor = getSpacePrimaryColor(groupId, primaryColorChoice)
  const currentSwatch = activeSpaceSwatch(effectiveColor)

  /**
   * Erst die Anzeige, dann das Speichern: der Haken springt sofort, der
   * Saver holt es nach und rollt bei einem Fehlschlag zurueck.
   */
  const applyPrimaryColor = (hex: string | null) => {
    if (!isEdit) return
    rememberPrimaryColor(hex)
    savePrimaryColorRef.current?.({ groupId: mode.group.id, hex })
  }

  /**
   * Zurueck zum Vorschlag. Mit Bild heisst das: die dominante Farbe des
   * Bildes NEU bestimmen und schreiben.
   *
   * `null` allein genuegt hier nicht. Die aus dem Bild gewonnene Farbe steht
   * im selben Schluessel wie die von Hand gewaehlte; wer von Hand waehlt,
   * ueberschreibt sie. Ein spaeteres `null` fiele darum nicht auf das Bild
   * zurueck, sondern auf die Farbe aus der Space-Id — der Knopf haette
   * versprochen, was er nicht halten kann.
   *
   * Die Extraktion laeuft damit ein zweites Mal, aber auf ausdrueckliche
   * Nutzeraktion, nicht bei jedem Rendern (Spec 04, Regel 2).
   */
  const resetPrimaryColor = async () => {
    if (!isEdit) return
    if (!groupImage) {
      applyPrimaryColor(null)
      return
    }
    // Die Extraktion dauert. Waehlt der Nutzer inzwischen bewusst eine Farbe,
    // ist das Ergebnis ueberholt und DARF sie nicht ueberschreiben — sonst
    // sprang die Farbe Augenblicke nach dem Klick von selbst zurueck.
    const ticket = ++colorRequestRef.current
    const { dominantColor } = await import("../../lib/image-utils")
    // Liefert ein graustufiges Bild keine Farbe, bleibt der Id-Rueckfall.
    // Auch hier der aufgeloeste Pfad: sonst laedt die Farbextraktion unter
    // einem Unterpfad nichts und faellt still auf die Id-Farbe zurueck.
    const derived = await dominantColor(resolveAssetUrl(groupImage) ?? groupImage).catch(() => null)
    if (ticket !== colorRequestRef.current) return
    applyPrimaryColor(derived)
  }

  /** Zahlen am Menue — die Suche aendert sie nicht, sie zaehlen den Bestand. */
  const sectionCounts: Record<SpaceConfigSectionId, number | undefined> = {
    members: members.length || undefined,
    modules: visibleModules.length || undefined,
    invite: undefined,
    theme: undefined,
  }

  const renderMemberRow = (member: (typeof members)[number]) => (
    <div
      key={member.id}
      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/50"
    >
      <Avatar className="h-7 w-7">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
        <AvatarFallback className="text-[10px]">
          {getInitials(member.displayName ?? shortName(member.id))}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm">
        {member.displayName ?? shortName(member.id)}
        {member.id === currentUserId && (
          <span className="ml-1 text-xs text-muted-foreground">(du)</span>
        )}
      </span>
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
      <DialogContent
        className="flex h-[85vh] max-h-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px]"
        aria-describedby={undefined}
        // Dieser Dialog ist ein FENSTER IN DEN SPACE und traegt darum dessen
        // Primaerfarbe — auch wenn gerade ein anderer Space oder die
        // Uebersicht aktiv ist. Sonst stuenden zwei Farben nebeneinander: das
        // Menue in der Farbe des bearbeiteten Space, der Einladen-Knopf in
        // der der laufenden App.
        //
        // Gesetzt werden dieselben Variablen, die `use-workspace-routing` auf
        // `:root` legt, nur lokal. Alle Flaechen darin ziehen dadurch mit,
        // statt dass jede fuer sich eine Farbe inline bekommt — und ein
        // Farbwechsel im Bereich "Aussehen" faerbt den ganzen Dialog um,
        // nicht bloss den Menueeintrag.
        style={
          {
            "--primary": effectiveColor,
            "--primary-foreground": getReadableTextColor(effectiveColor),
            "--ring": effectiveColor,
            "--accent": `color-mix(in srgb, ${effectiveColor} 14%, transparent)`,
            // Text auf der schwach getoenten Flaeche muss in hell UND dunkel
            // lesbar bleiben; die rohe Space-Farbe waere es nicht.
            "--accent-foreground": "var(--foreground)",
          } as React.CSSProperties
        }
        // Ohne das faengt der Name als erstes Feld den Fokus und steht
        // markiert da — ein Tastendruck ueberschriebe den Space-Namen. Der
        // Fokus bleibt im Dialog (Tab und Escape wirken), nur eben nicht
        // in einem Eingabefeld.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
      >
        <DialogTitle className="sr-only">{isEdit ? mode.group.name : "Neue Gruppe"}</DialogTitle>
        {/* Kopf — Bild und Name gehoeren dem Space als Ganzem und bleiben
            ueber den Bereichen stehen, aenderbar egal welcher offen ist.
            Der Stift am Bild ist dauerhaft sichtbar statt erst bei Hover:
            auf einem Tastfeld gibt es kein Hover (Entwurf "Space Menu", 3a). */}
        <div className="flex shrink-0 items-center gap-3.5 border-b px-6 py-4">
          <div className="group relative shrink-0">
            {groupImage ? (
              <>
                {/* Ueber `resolveAssetUrl` wie `AvatarImage`: ein
                    wurzel-relativer Pfad wie `/logo.png` laedt sonst vom
                    falschen Ort, sobald die App unter einem Unterpfad
                    ausgeliefert wird. Data-URLs reicht die Funktion
                    unveraendert durch. */}
                <img src={resolveAssetUrl(groupImage)} alt={name} className="h-12 w-12 rounded-xl object-cover ring-2 ring-background shadow-sm" />
                <button
                  onClick={handleImageRemove}
                  aria-label="Bild entfernen"
                  className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
                <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
            <label
              title="Bild waehlen"
              className="absolute -right-1.5 -bottom-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-accent"
            >
              <Camera className="h-2.5 w-2.5 text-muted-foreground" />
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          <div className="min-w-0 flex-1 group/name">
            <div className="relative">
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                className="h-7 -ml-1.5 min-w-32 max-w-[calc(100%-2rem)] truncate border-transparent bg-transparent px-1 text-[17px] font-semibold shadow-none transition-all hover:bg-muted/50 focus:ml-0 focus:max-w-[calc(100%-2rem)] focus:border-input focus:bg-card focus:px-2 focus:shadow-sm"
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
                className="absolute top-1/2 -translate-y-1/2 text-muted-foreground/30 transition-colors group-hover/name:text-muted-foreground/60 group-focus-within/name:hidden"
                style={{ left: `${Math.min(name.length + 1, 20)}ch` }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {membersLoading
                ? "Mitglieder werden geladen…"
                : `${members.length} ${members.length === 1 ? "Mitglied" : "Mitglieder"}`}
              {isCurrentUserAdmin && " · du bist Admin"}
            </p>
          </div>
        </div>

        {/* Menue und Inhalt. Auf schmalen Schirmen liegt das Menue als
            waagerechte Leiste ueber dem Inhalt — 190px Seitenspalte plus
            Inhalt passen dort nicht nebeneinander. */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Ein Menue mit einem einzigen Eintrag waere eine Wahl ohne
              Alternative — ohne Modulrecht bleibt nur ein Bereich uebrig. */}
          {sections.length > 1 && (
            <nav
              aria-label="Bereiche"
              className="shrink-0 border-b bg-muted/50 p-2.5 sm:w-[190px] sm:border-b-0 sm:border-r dark:bg-muted/20"
            >
              <div className="flex gap-1 overflow-x-auto sm:flex-col sm:gap-0.5 sm:overflow-visible">
                {sections.map((section) => {
                  const Icon = section.icon
                  const active = section.id === activeSection
                  const count = sectionCounts[section.id]
                  return (
                    <button
                      key={section.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setRequestedSection(section.id)}
                      // Der aktive Eintrag traegt die Farbe des Space — Spec 04
                      // ("Verwendung der Primaerfarbe", Regel 1) nennt aktive
                      // Navigations- und Sidebar-Items ausdruecklich. Damit
                      // spricht das Menue dieselbe Sprache wie die Modulleiste
                      // in der Navbar. Die Farbe kommt aus den Tokens, die der
                      // Dialog setzt — keine zweite Mechanik daneben.
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                        active
                          ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                          : "font-medium text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", !active && "text-muted-foreground")} />
                      <span className="flex-1">{section.label}</span>
                      {count !== undefined && (
                        <span className={cn("text-[10px]", active ? "opacity-70" : "text-muted-foreground")}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </nav>
          )}

          {/* Der Name des Bereichs stand hier frueher als Ueberschrift — direkt
              neben dem Menueeintrag, der ihn auf gleicher Hoehe schon nennt
              und ihn in der Space-Farbe hervorhebt. Fuer Screenreader traegt
              ihn jetzt die Flaeche selbst, sichtbar wiederholt wird er nicht. */}
          <div
            role="region"
            aria-label={sections.find((s) => s.id === activeSection)?.label}
            className="min-w-0 flex-1 overflow-y-auto px-6 py-4"
          >
          {activeSection === "members" && (
            <>
              <div className="mb-3 flex items-center gap-2.5">
                {/* Einladen bleibt allen Mitgliedern offen, nicht nur Admins:
                    im WoT laedt jedes Mitglied ein, nur der Creator entfernt.
                    Der Knopf springt in den Bereich, statt einen Picker
                    aufzuklappen (Entwurf Turn 4). */}
                {onInviteMember && (
                  <Button
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={() => setRequestedSection("invite")}
                  >
                    <UserPlus className="h-3 w-3" />
                    <span className="ml-1">Einladen</span>
                  </Button>
                )}
              </div>

              {/* Suchen lohnt erst, wenn die Liste nicht mehr auf einen Blick
                  zu ueberschauen ist — ein laufender Suchbegriff haelt das
                  Feld aber offen, sonst bliebe der Filter ohne Bedienteil
                  zurueck (#377). */}
              {showsMemberSearch(members.length, memberSearch) && (
                <div className="relative mb-2">
                  <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Suchen…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              )}

              {membersLoading && members.length === 0 && (
                <div className="space-y-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`member-skeleton-${i}`} className="flex items-center gap-2.5 px-2.5 py-1.5" aria-hidden>
                      <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                      <Skeleton className="h-3.5 w-32" />
                    </div>
                  ))}
                </div>
              )}

              {/* Drei Gruppen statt einer flachen Liste: `members` ist nach
                  DID sortiert, das Admin-Abzeichen sass also an beliebiger
                  Stelle. Die Gruppe sagt es jetzt, das Abzeichen entfaellt. */}
              {shownAdmins.length > 0 && (
                <>
                  <MemberGroupLabel>Admin</MemberGroupLabel>
                  <div className="space-y-0.5">{shownAdmins.map(renderMemberRow)}</div>
                </>
              )}
              {shownOthers.length > 0 && (
                <>
                  <MemberGroupLabel>{`Mitglieder · ${shownOthers.length}`}</MemberGroupLabel>
                  <div className="space-y-0.5">{shownOthers.map(renderMemberRow)}</div>
                </>
              )}
              {!membersLoading && shownAdmins.length === 0 && shownOthers.length === 0 && (
                <p className="px-2.5 py-3 text-xs text-muted-foreground">Niemand gefunden.</p>
              )}

              {justInvitedContacts.length > 0 && (
                <>
                  <MemberGroupLabel>{`Eingeladen · ${justInvitedContacts.length}`}</MemberGroupLabel>
                  <div className="space-y-0.5">
                    {justInvitedContacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-green-500/5 px-2.5 py-1.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-green-500/10 text-[10px] text-green-700">
                            {getInitials(c.name ?? shortName(c.id))}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm">{c.name ?? shortName(c.id)}</span>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Einladen (Entwurf 4a): eigener Bereich, kein Unterzustand von
              Mitgliedern. Es gibt keine Einladung per Link — eingeladen wird
              nur, wen man persoenlich getroffen und verifiziert hat. Die
              Quelle ist darum dieselbe wie bisher: verifizierte Kontakte,
              die noch nicht Mitglied sind. */}
          {activeSection === "invite" && onInviteMember && (
            <>
              <div className="relative mb-3">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Kontakt suchen…"
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {shownInvitable.length > 0 ? (
                <>
                  <MemberGroupLabel>{`Kontakte · ${shownInvitable.length}`}</MemberGroupLabel>
                  <div className="space-y-0.5">
                    {shownInvitable.map((contact) => {
                      const isInviting = invitingId === contact.id
                      const inviteError = inviteErrors.get(contact.id)
                      return (
                        <div key={contact.id}>
                          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/50">
                            <Avatar className="h-7 w-7">
                              {contact.avatar && <AvatarImage src={contact.avatar} />}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(contact.name ?? contact.id)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {contact.name ?? shortName(contact.id)}
                            </span>
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
                            <p className="-mt-0.5 mb-1 ml-11 text-xs text-destructive">{inviteError}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="px-2.5 py-3 text-xs text-muted-foreground">
                  {invitableContacts.length > 0
                    ? "Kein Kontakt gefunden."
                    : (contacts ?? []).some((c) => c.status === "active")
                      ? "Alle Kontakte sind bereits Mitglied."
                      : "Keine verifizierten Kontakte."}
                </p>
              )}

              {/* "Von dir eingeladen" zeigt der Entwurf mit Zeitpunkt und
                  Status (Mitglied / Offen). Beides steht nicht im Modell:
                  `User` kennt nur `isAdmin`, `ContactInfo` keinen Bezug zu
                  diesem Space. Was hier steht, ist darum auf DIESE Sitzung
                  begrenzt — mehr traegt die Quelle nicht. */}
              {justInvitedContacts.length > 0 && (
                <>
                  <MemberGroupLabel>{`Von dir eingeladen · ${justInvitedContacts.length}`}</MemberGroupLabel>
                  <div className="space-y-0.5">
                    {justInvitedContacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
                        <Avatar className="h-7 w-7">
                          {c.avatar && <AvatarImage src={c.avatar} />}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(c.name ?? shortName(c.id))}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {c.name ?? shortName(c.id)}
                          <span className="ml-1 text-xs text-muted-foreground">gerade eben</span>
                        </span>
                        <span className="text-xs font-semibold text-primary">Offen</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Aussehen (Entwurf "Space Menu", 3c): die Primaerfarbe des Space.
              Sie wirkt, solange dieser Space aktiv ist — Spec 04
              ("Verwendung der Primaerfarbe"): Akzent, keine vollflaechige
              Themefarbe. Hintergruende und Karten bleiben unberuehrt. */}
          {activeSection === "theme" && isCurrentUserAdmin && (
            <>
              <MemberGroupLabel>Primärfarbe</MemberGroupLabel>

              <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
                {SPACE_COLOR_SWATCHES.map((hex) => {
                  const active = currentSwatch === hex
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Primärfarbe ${hex}`}
                      aria-pressed={active}
                      onClick={() => applyPrimaryColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                        active && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                      )}
                    >
                      {active && (
                        <CheckIcon className="h-3.5 w-3.5" style={{ color: getReadableTextColor(hex) }} />
                      )}
                    </button>
                  )
                })}

                {/* Eigene Farbe. Der native Farbwaehler ist hier der richtige:
                    er kennt die Bedienhilfen des Systems, und ein eigener
                    Farbkreis waere eine zweite Farbwelt neben der Palette. */}
                <label
                  title="Eigene Farbe"
                  className={cn(
                    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary",
                    currentSwatch === "custom" && "border-solid border-foreground",
                  )}
                  style={currentSwatch === "custom" ? { backgroundColor: effectiveColor } : undefined}
                >
                  {currentSwatch === "custom" ? (
                    // Fest weiss verschwand eine helle eigene Farbe (etwa
                    // #ffffff) im eigenen Untergrund — Spec 04 Regel 5
                    // verlangt lesbare Zeichen auf der Akzentflaeche.
                    <CheckIcon
                      className="h-3.5 w-3.5"
                      style={{ color: getReadableTextColor(effectiveColor) }}
                    />
                  ) : (
                    <span className="text-sm leading-none">+</span>
                  )}
                  {/* `title` am Label benennt das Bedienelement nicht — ohne
                      eigenes Label hiesse der Waehler fuer eine Vorlesehilfe
                      nur "+" oder "Haken". */}
                  <input
                    type="color"
                    aria-label="Eigene Farbe"
                    value={effectiveColor}
                    onChange={(e) => applyPrimaryColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Der Rueckweg. Spec 04 Regel 2/3: ohne eigenen Wert stammt die
                  Farbe aus dem Logo, sonst deterministisch aus der Space-Id —
                  `null` stellt genau das wieder her. */}
              {primaryColorChoice != null && (
                <button
                  type="button"
                  onClick={() => { void resetPrimaryColor() }}
                  className="mx-2.5 mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  {groupImage ? "Zurück zur Farbe aus dem Bild" : "Zurück zur Standardfarbe"}
                </button>
              )}

              <p className="mt-3 px-2.5 text-xs text-muted-foreground">
                Die Farbe gilt für alle im Space und wirkt, solange er geöffnet ist.
              </p>
            </>
          )}

          {/* Module (admin only): the ACTIVE list is ordered — data.modules
              is what the nav renders, top row = first tab. Reorder by DRAGGING
              a row (one gesture, any distance), deactivate via ✕; available
              modules append at the end. The ↑/↓ buttons stay as the keyboard
              path and appear ONLY on keyboard focus — with the mouse you
              drag, so showing them on hover was pure noise. Dragging alone
              would lock out keyboard and screen-reader users. */}
          {activeSection === "modules" && isCurrentUserAdmin && (
            <>
              <Label className="text-xs text-muted-foreground">Ziehen zum Sortieren</Label>
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
            </>
          )}
          </div>
        </div>

        {/* Errors: module-save failures have their own state (ownership by
            construction, rls#232) and can coexist with a general error.
            Beide stehen AUSSERHALB der Faecher: ein Fehler beim Speichern der
            Module darf nicht verschwinden, weil man inzwischen im Fach
            "Mitglieder" steht. */}
        {moduleError && (
          <p className="text-xs text-destructive px-6 pb-2">{moduleError}</p>
        )}
        {colorError && (
          <p className="text-xs text-destructive px-6 pb-2">{colorError}</p>
        )}
        {error && (
          <p className="text-xs text-destructive px-6 pb-2">{error}</p>
        )}

        {/* Footer */}
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
