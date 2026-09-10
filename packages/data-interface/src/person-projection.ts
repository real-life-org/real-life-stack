// Profile als person-Items — der gemeinsame Projektions-Baustein.
//
// Spec: docs/spec/04-items-relations-groups-spaces.md → §Profile.
//
// Jede Person hat EIN Profil. In jedem Space, dessen Mitglied sie ist,
// erscheint es als `person`-Item — abgeleitet, nicht gespeichert. Diesen
// Baustein teilen sich alle Connectoren (mock, local, wot, supabase), damit
// die Regel genau einmal existiert statt viermal leicht verschieden.

import type { Group, Item, Observable, Unsubscribe, User } from "./index.js"
import { createObservable } from "./base-connector.js"
import { deriveContext } from "./vocab.js"

/**
 * Profilfelder, aus denen eine Projektion entsteht. Bewusst schmaler als
 * `PublicProfileData`: jeder Connector füllt, was seine Quelle hergibt
 * (WoT: Persönliches Dokument bzw. Verzeichnis, Supabase: profiles-Row).
 */
export interface PersonProfileInput {
  /** Bindet die Projektion an die WoT-Identität (Spec 04 §Profile, Regel 1). */
  did?: string
  displayName?: string
  bio?: string
  avatarUrl?: string
  /** GeoJSON-Point, opt-in und global — nie je Space (Regel 4). */
  position?: unknown
  locationName?: string
  /** Entstehungszeit des Profils, wenn die Quelle sie kennt. */
  createdAt?: string
}

/**
 * `createdAt` einer Projektion ohne bekannte Profilzeit. Eine Projektion hat
 * kein eigenes Anlege-Ereignis; der Wert MUSS trotzdem über Neuberechnungen
 * stabil sein, sonst flackert jede nach Datum sortierte Liste bei jedem
 * Rebuild.
 */
export const PERSON_PROJECTION_CREATED_AT = "1970-01-01T00:00:00.000Z"

/** Ein `person`-Item aus Mitglied (+ Profil, wenn vorhanden). */
export function projectPersonItem(
  user: Pick<User, "id"> & Partial<Pick<User, "displayName" | "avatarUrl">>,
  profile?: PersonProfileInput | null,
): Item {
  const displayName = profile?.displayName || user.displayName || user.id
  const avatarUrl = profile?.avatarUrl || user.avatarUrl
  const bio = profile?.bio
  const data: Record<string, unknown> = {
    // Die Projektion trägt IMMER eine did: sie ist das einzige Merkmal, an
    // dem Module Projektion und Platzhalter unterscheiden (Regel 5).
    // Connectoren ohne DID-Identität binden über die Nutzer-Id.
    did: profile?.did || user.id,
    displayName,
    ...(bio ? { bio } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(profile?.position ? { position: profile.position } : {}),
    ...(profile?.locationName ? { locationName: profile.locationName } : {}),
  }
  return {
    id: user.id,
    "@context": deriveContext("person", data),
    type: "person",
    createdAt: profile?.createdAt ?? PERSON_PROJECTION_CREATED_AT,
    createdBy: user.id,
    data,
  }
}

/** Projektion (Profil) oder Platzhalter (gewöhnliches Item)? Nur `data.did`
 *  entscheidet — Spec 04 §Profile, Regel 5. */
export function isPersonProjection(item: Pick<Item, "type" | "data"> | null | undefined): boolean {
  if (!item || item.type !== "person") return false
  const did = (item.data as { did?: unknown }).did
  return typeof did === "string" && did.length > 0
}

/**
 * Wirft, wenn `item` eine Projektion ist. Projektionen sind abgeleitet und
 * haben genau einen Besitzer — den Profil-Editor (`ProfileCapable`).
 */
export function assertNotPersonProjection(
  item: Pick<Item, "type" | "data"> | null | undefined,
  operation: "update" | "delete",
): void {
  if (!isPersonProjection(item)) return
  const verb = operation === "update" ? "ändern" : "löschen"
  throw new Error(
    `Dieses person-Item ist die Projektion eines Profils (data.did) und lässt sich nicht ${verb} — ` +
      `Profile werden über den Profil-Editor gepflegt (ProfileCapable), siehe Spec 04 §Profile.`,
  )
}

/**
 * Projektionen in einen gespeicherten Item-Strom mischen. Ein gespeichertes
 * Item mit gleicher Id behält den Vortritt: der Strom bleibt kollisionsfrei,
 * und ein echter Datensatz wird nie von einer Ableitung verdeckt.
 */
export function mergePersonProjections(stored: readonly Item[], projections: readonly Item[]): Item[] {
  if (projections.length === 0) return stored as Item[]
  const taken = new Set(stored.map((item) => item.id))
  return [...stored, ...projections.filter((item) => !taken.has(item.id))]
}

export interface PersonProjectionStoreOptions {
  observeCurrentGroup(): Observable<Group | null>
  observeMembers(groupId: string | null): Observable<User[]>
  /**
   * Profil zu einer Nutzer-Id. Fehlt es (null) oder schlägt es fehl, bleibt
   * das minimale Item aus `User` — der Item-Strom wartet NIE auf das Netz.
   */
  loadProfile?: (userId: string) => Promise<PersonProfileInput | null>
  /** Der Connector benachrichtigt daraufhin seine Item-Observables. */
  onChange: () => void
}

/**
 * Hält die Projektionen des aktiven Space aktuell.
 *
 * Reaktiv über die Quellen, die der Connector ohnehin beobachtet: aktiver
 * Space und Mitgliederliste. Profile werden nachgeladen und gecacht; ein
 * `invalidateProfile` reicht eine Profiländerung nach. Kein Polling.
 */
export class PersonProjectionStore {
  private readonly options: PersonProjectionStoreOptions
  private groupUnsubscribe: Unsubscribe | null = null
  private membersUnsubscribe: Unsubscribe | null = null
  private groupId: string | null = null
  private members: User[] = []
  private profiles = new Map<string, PersonProfileInput | null>()
  private inFlight = new Set<string>()
  private items: Item[] = []
  private signature = ""
  private disposed = false

  constructor(options: PersonProjectionStoreOptions) {
    this.options = options
    // Defensiv gegen Connectoren ohne Gruppenquelle (Test-Harnesse, die nur
    // Teile verdrahten): ohne Space gibt es schlicht keine Mitglieder und
    // damit keine Projektion — das darf den Item-Strom nicht sprengen.
    const groupObs = options.observeCurrentGroup() as Observable<Group | null> | undefined
    this.groupId = groupObs?.current?.id ?? null
    this.groupUnsubscribe = groupObs?.subscribe((group) => this.setGroup(group?.id ?? null)) ?? null
    this.subscribeMembers()
  }

  /** Die Projektionen des aktiven Space, sofort verfügbar. */
  get current(): readonly Item[] {
    return this.items
  }

  /** Profil hat sich geändert (eigener Editor, eingehende Sync-Nachricht). */
  invalidateProfile(userId: string): void {
    this.profiles.delete(userId)
    this.inFlight.delete(userId)
    this.rebuild()
  }

  /** Alle Profile verwerfen (z. B. nach Anmeldung/Abmeldung). */
  invalidateAllProfiles(): void {
    this.profiles.clear()
    this.inFlight.clear()
    this.rebuild()
  }

  dispose(): void {
    this.disposed = true
    this.groupUnsubscribe?.()
    this.membersUnsubscribe?.()
    this.groupUnsubscribe = null
    this.membersUnsubscribe = null
    this.members = []
    this.items = []
    this.signature = ""
  }

  private setGroup(groupId: string | null): void {
    if (this.disposed || groupId === this.groupId) return
    this.groupId = groupId
    this.subscribeMembers()
    this.notifyIfChanged()
  }

  private subscribeMembers(): void {
    this.membersUnsubscribe?.()
    const observable = this.options.observeMembers(this.groupId) as Observable<User[]> | undefined
    this.members = observable?.current ?? []
    this.membersUnsubscribe = observable?.subscribe((members) => {
      if (this.disposed) return
      this.members = members ?? []
      this.rebuild()
    }) ?? null
    this.rebuildItems()
  }

  private rebuild(): void {
    if (this.disposed) return
    this.rebuildItems()
    this.notifyIfChanged()
  }

  private rebuildItems(): void {
    this.items = this.members.map((member) => projectPersonItem(member, this.profiles.get(member.id)))
    this.requestMissingProfiles()
  }

  private requestMissingProfiles(): void {
    const load = this.options.loadProfile
    if (!load) return
    for (const member of this.members) {
      if (this.profiles.has(member.id) || this.inFlight.has(member.id)) continue
      this.inFlight.add(member.id)
      void load(member.id)
        .then((profile) => {
          if (this.disposed) return
          this.profiles.set(member.id, profile ?? null)
          this.rebuild()
        })
        .catch(() => {
          // Ein unerreichbares Profil darf den Strom nicht anhalten: das
          // minimale Item aus `User` bleibt stehen, der nächste
          // invalidateProfile versucht es erneut.
          if (this.disposed) return
          this.profiles.set(member.id, null)
        })
        .finally(() => this.inFlight.delete(member.id))
    }
  }

  /** Nur melden, wenn sich wirklich etwas geändert hat — sonst kreist der
   *  Connector zwischen notifyObservers und rebuild. */
  private notifyIfChanged(): void {
    const next = JSON.stringify(this.items)
    if (next === this.signature) return
    this.signature = next
    this.options.onChange()
  }
}

// Nur referenziert, damit der Baustein sein eigenes Observable-Werkzeug
// mitbringt (Tests konstruieren damit Quellen).
void createObservable
