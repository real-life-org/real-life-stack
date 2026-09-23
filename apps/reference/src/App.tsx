import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"

import {
  AdaptivePanel,
  ProfilePanelContent,
  ConnectorSwitcher,
  ConnectorProvider,
  IncomingEventsProvider,
  useIncomingEvents,
  useConnector,
  useCurrentUser,
  useContacts,
  useRelayStatus,
  useModulePanel,
  DebugDashboard,
  RelayStatusBadge,
  AuthScreen,
  IncomingVerificationDialog,
  IncomingContactRequestDialog,
  IncomingSpaceInviteDialog,
  MutualVerificationDialog,
  getRuntimeConfig,
  type ProfileData,
  type ConnectorOption,
} from "@real-life-stack/toolkit"
import type { DataInterface, User } from "@real-life-stack/data-interface"
import { isAuthenticatable, hasMessaging, hasEncounterVerification, hasProfile } from "@real-life-stack/data-interface"
import { demoItems, demoGroups, demoUsers, demoGroupMembers, demoGroupItems } from "@real-life-stack/data-interface/demo-data"
import { MapLibreAdapterProvider } from "@real-life-stack/toolkit/maplibre"
import { MockConnector } from "@real-life-stack/mock-connector"
import { LocalConnector } from "@real-life-stack/local-connector"
// Der Rahmen mit Router: Fokus in der URL, Space/Modul/Item aus der URL,
// Provider, Panel, Kopfzeile, Controller — einmal im Toolkit (Spec 01).
import { RoutedAppFrame } from "@real-life-stack/toolkit/router"


const CONNECTOR_OPTIONS: ConnectorOption[] = [
  { id: "mock", name: "Mock", description: "In-Memory, kein Speichern" },
  { id: "local", name: "Local", description: "IndexedDB, persistent" },
  { id: "wot", name: "Web of Trust", description: "E2E-verschlüsselt, Multi-Device" },
  { id: "supabase", name: "Supabase", description: "PostgreSQL-Backend, Realtime" },
]

function RelayStatusBadgeWrapper() {
  const { state, pendingCount } = useRelayStatus()
  const panel = useModulePanel()
  // Debug shares the one app-level panel (content-swap). Toggle: a badge
  // click opens debug into the panel, or closes it if it's already showing.
  const toggleDebug = () => {
    if (panel.current?.kind === "debug") {
      panel.close()
    } else {
      panel.open({
        kind: "debug",
        content: <DebugDashboard />,
      })
    }
  }
  return (
    <RelayStatusBadge
      state={state}
      pendingCount={pendingCount}
      onClick={toggleDebug}
    />
  )
}

/**
 * Global incoming event dialogs — counter-verify, space invite, mutual verification.
 * Must be rendered inside IncomingEventsProvider.
 */
function IncomingEventDialogs({ onCloseVerifyDialog }: { onCloseVerifyDialog?: () => void }) {
  const connector = useConnector()
  const { data: currentUser } = useCurrentUser()
  const { current: currentNotification, incomingVerification, spaceInvite, mutualVerification, contactRequest, contactConfirmed, dismiss } = useIncomingEvents()
  const { activateContact: activateIncomingContact } = useContacts()

  const handleConfirmContactRequest = async () => {
    if (!contactRequest) return
    // Fehler NICHT schlucken: der Dialog zeigt ihn und bleibt offen
    // (retry-fähig). Nur der Erfolg schließt.
    await activateIncomingContact(contactRequest.fromId)
    dismiss()
  }

  const handleCounterVerify = async () => {
    if (!incomingVerification || !hasEncounterVerification(connector)) return
    await connector.counterVerify(incomingVerification.fromId)
    dismiss()
  }

  const navigate = useNavigate()
  const handleOpenSpace = () => {
    if (spaceInvite) {
      navigate(`/${spaceInvite.spaceId}/feed`)
    }
    dismiss()
  }

  // Close the verify dialog when an incoming/mutual verification arrives
  useEffect(() => {
    if (incomingVerification || mutualVerification) onCloseVerifyDialog?.()
  }, [incomingVerification, mutualVerification, onCloseVerifyDialog])

  return (
    <>
      <IncomingVerificationDialog
        open={!!incomingVerification}
        fromId={incomingVerification?.fromId ?? ""}
        fromName={incomingVerification?.fromName}
        fromAvatar={incomingVerification?.fromAvatar}
        onConfirm={handleCounterVerify}
        onReject={dismiss}
      />
      <IncomingSpaceInviteDialog
        open={!!spaceInvite}
        spaceName={spaceInvite?.spaceName ?? ""}
        spaceImage={spaceInvite?.spaceImage}
        inviterName={spaceInvite?.fromName}
        onOpen={handleOpenSpace}
        onDismiss={dismiss}
      />
      <MutualVerificationDialog
        open={!!mutualVerification}
        peerName={mutualVerification?.fromName}
        peerAvatar={mutualVerification?.fromAvatar}
        myName={currentUser?.displayName}
        myAvatar={currentUser?.avatarUrl}
        onDismiss={dismiss}
      />
      {/* Gleiche Komponente, andere Variante: Anfrage-Bestätigung statt
          Begegnungs-Verifikation. */}
      <MutualVerificationDialog
        open={!!contactConfirmed}
        variant="contact"
        peerName={contactConfirmed?.fromName}
        peerAvatar={contactConfirmed?.fromAvatar}
        myName={currentUser?.displayName}
        myAvatar={currentUser?.avatarUrl}
        onDismiss={dismiss}
      />
      <IncomingContactRequestDialog
        open={!!contactRequest}
        requestKey={currentNotification?.id}
        fromId={contactRequest?.fromId}
        fromName={contactRequest?.fromName}
        fromAvatar={contactRequest?.fromAvatar}
        onConfirm={handleConfirmContactRequest}
        onDismiss={dismiss}
      />
    </>
  )
}

/**
 * Single App-Shell-level profile surface. Holds one AdaptivePanel that
 * both the own-profile editor and read-only foreign profiles render
 * into — opened from anywhere via the OpenProfileProvider. Modal by
 * default so an avatar click inside an open item-detail sidebar stacks
 * above it instead of replacing it.
 */
export function ProfilePanelHost({
  userId,
  currentUser,
  connector,
  contactCount,
  onSaveProfile,
  onClose,
  onAddContact,
  contactStatusFor,
  contactDirectionFor,
}: {
  userId: string | null
  currentUser: User | null | undefined
  connector: DataInterface
  contactCount?: number
  onSaveProfile: (updates: { name: string; bio: string; avatar?: string }) => Promise<void>
  onClose: () => void
  onAddContact?: (id: string) => Promise<unknown>
  contactStatusFor?: (id: string) => "pending" | "active" | undefined
  contactDirectionFor?: (id: string) => "incoming" | "outgoing" | undefined
}) {
  const isOwn = userId != null && userId === currentUser?.id
  const [foreign, setForeign] = useState<User | null>(null)

  // Own bio lives in the connector's profile item (person/v1), not in the
  // User object — without this the editor reopens with an empty bio even
  // though updateMyProfile persisted it (applies to WoT and Supabase alike).
  const [myBio, setMyBio] = useState("")
  useEffect(() => {
    if (!isOwn || !hasProfile(connector)) {
      setMyBio("")
      return
    }
    // Stale/error guard: a resolve after the effect re-ran (connector or
    // profile switch) must not apply, and a rejecting connector must not
    // surface as unhandledrejection.
    let cancelled = false
    const observable = connector.observeMyProfile()
    const apply = (item: import("@real-life-stack/data-interface").Item | null) => {
      if (cancelled) return
      setMyBio(typeof item?.data.bio === "string" ? item.data.bio : "")
    }
    apply(observable.current)
    connector.getMyProfile().then(apply).catch((error) => {
      console.error("[ProfilePanelHost] getMyProfile failed", error)
    })
    const unsubscribe = observable.subscribe(apply)
    return () => { cancelled = true; unsubscribe() }
  }, [isOwn, connector])

  useEffect(() => {
    // Clear any previously loaded user first, so switching from one
    // foreign profile to another doesn't briefly show the stale one.
    setForeign(null)
    if (userId == null || isOwn) return
    let cancelled = false
    if (isAuthenticatable(connector)) {
      connector.getUser(userId)
        .then((u) => { if (!cancelled) setForeign(u) })
        .catch(() => { if (!cancelled) setForeign(null) })
    }
    return () => { cancelled = true }
  }, [userId, isOwn, connector])

  const profile: ProfileData | null = useMemo(() => {
    if (userId == null) return null
    if (isOwn) {
      return {
        did: currentUser?.id ?? "",
        name: currentUser?.displayName ?? "",
        bio: myBio,
        avatar: currentUser?.avatarUrl,
      }
    }
    // Foreign profile: use the loaded user, fall back to the bare id
    // while getUser is still resolving (or if the connector can't
    // resolve it).
    return {
      did: foreign?.id ?? userId,
      name: foreign?.displayName ?? userId,
      avatar: foreign?.avatarUrl,
    }
  }, [userId, isOwn, currentUser, foreign, myBio])

  return (
    <AdaptivePanel
      open={userId !== null}
      onClose={onClose}
      allowedModes={["modal"]}
      modalClassName="sm:max-w-sm"
    >
      {profile && (
        // Two concrete branches so the discriminated union narrows:
        // edit carries onSave, view forbids it.
        isOwn ? (
          <ProfilePanelContent
            key={profile.did}
            mode="edit"
            profile={profile}
            contactCount={contactCount}
            onSave={onSaveProfile}
            onClose={onClose}
            profileUrl={`${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(profile.did)}`}
          />
        ) : (
          <ProfilePanelContent
            key={profile.did}
            mode="view"
            profile={profile}
            onClose={onClose}
            onAddContact={onAddContact && userId ? () => onAddContact(userId) : undefined}
            contactStatus={userId ? contactStatusFor?.(userId) : undefined}
            contactDirection={userId ? contactDirectionFor?.(userId) : undefined}
          />
        )
      )}
    </AdaptivePanel>
  )
}

/**
 * Die Shell der Referenz-App: der Rahmen aus dem Toolkit (`RoutedAppFrame`,
 * Spec 01 „Was bei der App bleibt") plus das, was nur diese App hat — das
 * Profil-Overlay in der URL, die WoT-Ereignisdialoge, der Relay-Status, der
 * Connector-Umschalter im Dev-Modus. Bis zum 21.09.2026 zaehlte `Home` hier
 * zehn Provider und vier Controller von Hand auf.
 */
function Home({ activeConnectorId, onConnectorChange }: { activeConnectorId: string; onConnectorChange: (id: string) => void }) {
  const connector = useConnector()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: currentUser } = useCurrentUser()
  const { activeContacts, contacts: allContacts, addContact, supportsContacts } = useContacts()

  // Das Profil-Overlay lebt in der URL (`?profile={userId}`): verlinkbar, und
  // Zurueck im Browser schliesst es (derselbe Push-Marker wie der
  // Dialog-Stack des Rahmens). Bleibt App-Sache, bis das Profil ein Item ist.
  const profileUserId = searchParams.get("profile")
  const openProfile = useCallback((userId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("profile", userId)
    const prev = (typeof location.state === "object" && location.state) || {}
    setSearchParams(params, { state: { ...prev, rlsDialogPush: true } })
  }, [searchParams, setSearchParams, location.state])
  const closeProfile = useCallback(() => {
    const pushed = (location.state as { rlsDialogPush?: boolean } | null)?.rlsDialogPush
    if (pushed) {
      navigate(-1)
    } else {
      const params = new URLSearchParams(searchParams)
      params.delete("profile")
      setSearchParams(params, { replace: true })
    }
  }, [location.state, navigate, searchParams, setSearchParams])
  const handleSaveProfile = useCallback(async (updates: { name: string; bio: string; avatar?: string }) => {
    if (hasProfile(connector)) await connector.updateMyProfile(updates)
  }, [connector])
  // Eine eingehende Verifikation schliesst den eigenen Verify-Dialog des
  // Rahmens (`?dialog=…,verify`) — per replace, ohne die App zu verlassen.
  const closeVerifyOverlay = useCallback(() => {
    const stack = searchParams.get("dialog")?.split(",") ?? []
    if (!stack.includes("verify")) return
    const next = stack.filter((x) => x !== "verify")
    const params = new URLSearchParams(searchParams)
    if (next.length > 0) params.set("dialog", next.join(","))
    else params.delete("dialog")
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <MapLibreAdapterProvider>
      <RoutedAppFrame
        fallbackModule="feed"
        build={__RLS_BUILD__}
        openProfile={openProfile}
        navbarEnd={hasMessaging(connector) ? <RelayStatusBadgeWrapper /> : null}
      >
        <ProfilePanelHost
          userId={profileUserId}
          currentUser={currentUser}
          connector={connector}
          contactCount={activeContacts.length}
          onSaveProfile={handleSaveProfile}
          onClose={closeProfile}
          onAddContact={supportsContacts ? addContact : undefined}
          contactStatusFor={(id) => allContacts.find((contact) => contact.id === id)?.status}
          contactDirectionFor={(id) => allContacts.find((contact) => contact.id === id)?.direction}
        />
        <IncomingEventDialogs onCloseVerifyDialog={closeVerifyOverlay} />
        {/* Connector FAB — bottom-left, above BottomNav (only with ?dev URL param) */}
        {initialDevMode && (
          <div className="fixed bottom-20 left-4 z-50">
            <ConnectorSwitcher
              connectors={CONNECTOR_OPTIONS}
              activeConnector={activeConnectorId}
              onConnectorChange={onConnectorChange}
            />
          </div>
        )}
      </RoutedAppFrame>
    </MapLibreAdapterProvider>
  )
}

const demoData = {
  items: demoItems,
  groups: demoGroups,
  users: demoUsers,
  groupMembers: demoGroupMembers,
  groupItems: demoGroupItems,
}

async function createConnector(type: string): Promise<DataInterface> {
  if (type === "wot") {
    const { WotConnector } = await import("@real-life-stack/wot-connector")
    // 0.3.0: vaultUrl entfernt (Connector nutzt kein Vault); Defaults auf die
    // aktiven web-of-trust.de-Dienste (utopia-lab-Legacy ist abgeschaltet).
    // Endpunkte kommen zur Laufzeit (Spec 11) — dasselbe Artefakt bedient
    // damit jede Instanz; die VITE_-Werte tragen als Stufe 2 weiter.
    const { relayUrl, profilesUrl } = getRuntimeConfig().endpoints
    const connector = new WotConnector({
      relayUrl: relayUrl ?? "wss://relay.web-of-trust.de",
      profilesUrl: profilesUrl ?? "https://profiles.web-of-trust.de",
    })
    await connector.init()
    return connector
  }
  if (type === "local") {
    const c = new LocalConnector(demoData)
    await c.init()
    return c
  }
  if (type === "supabase") {
    const { createSupabaseConnector } = await import("@real-life-stack/supabase-connector")
    const { supabaseUrl, supabaseAnonKey } = getRuntimeConfig().endpoints
    const connector = createSupabaseConnector(
      supabaseUrl ?? "http://127.0.0.1:54321",
      supabaseAnonKey ?? "",
    )
    await connector.init()
    // No auto-login: the AuthGate presents the generic AuthScreen (email
    // login/signup + anonymous). supabase-js persists sessions, so an
    // existing login survives reloads and skips the gate.
    return connector
  }
  const c = new MockConnector()
  await c.init()
  return c
}

const STORAGE_KEY_CONNECTOR = "rls-connector"
const initialDevMode = new URLSearchParams(window.location.search).has('dev')

function getInitialConnectorId(): string {
  const params = new URLSearchParams(window.location.search)
  // `?connector=` sticht die Instanz-Vorgabe (Spec 11).
  const configured = getRuntimeConfig().defaultConnector
  return params.get("connector") ?? configured ?? localStorage.getItem(STORAGE_KEY_CONNECTOR) ?? "wot"
}

// Lazy-load the DIDAuthScreen to keep WoT bundle separate
const LazyDIDAuthScreen = lazy(() =>
  import("@real-life-stack/wot-connector/components").then((m) => ({
    default: m.DIDAuthScreen,
  }))
)

/** Methods the generic AuthScreen can actually present. */
const GENERIC_AUTH_METHODS = new Set(["email", "email-signup", "anonymous"])

export function AuthGate({ connector, wot, children }: { connector: DataInterface; wot: boolean; children: React.ReactNode }) {
  // WoT: check auth state once at mount and LATCH — the DIDAuthScreen controls
  // when onAuthenticated fires (after seed backup etc.), so reacting to auth
  // state changes would skip the onboarding wizard.
  const [authenticated, setAuthenticated] = useState(() => {
    if (!isAuthenticatable(connector)) return true
    return connector.getAuthState().current.status === "authenticated"
  })

  // Generic backend path: the gate FOLLOWS the auth observable (spec
  // architektur2 → AuthState als Observable). A later session loss — expiry,
  // refresh failure, logout in another tab — must close the app again, and an
  // external login must open it.
  useEffect(() => {
    if (wot || !isAuthenticatable(connector)) return
    const observable = connector.getAuthState()
    setAuthenticated(observable.current.status === "authenticated")
    return observable.subscribe((state) => setAuthenticated(state.status === "authenticated"))
  }, [connector, wot])

  if (authenticated) {
    return <>{children}</>
  }

  if (!wot) {
    // Generic capability path (e.g. Supabase): email login/signup + anonymous.
    // A connector that offers none of these has no interactive flow — pass
    // through instead of dead-ending (matches the pre-gate behaviour of the
    // auto-authenticating demo connectors).
    if (isAuthenticatable(connector) && connector.getAuthMethods().some(({ method }) => GENERIC_AUTH_METHODS.has(method))) {
      return <AuthScreen connector={connector} onAuthenticated={() => setAuthenticated(true)} />
    }
    return <>{children}</>
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Lade Auth…</div>
        </div>
      }
    >
      <LazyDIDAuthScreen
        connector={connector as unknown as import("@real-life-stack/wot-connector").WotConnector}
        onAuthenticated={() => setAuthenticated(true)}
      />
    </Suspense>
  )
}

export default function App() {
  const [connectorId, setConnectorId] = useState(getInitialConnectorId)
  const [connector, setConnector] = useState<DataInterface | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONNECTOR, connectorId)
    setLoading(true)
    setConnector(null)
    let cancelled = false
    let instance: DataInterface | null = null
    createConnector(connectorId).then((c) => {
      if (cancelled) return // Don't dispose — global singletons (PersonalDoc) are shared
      instance = c
      setConnector(c)
      setLoading(false)
    }).catch((err) => {
      console.error("[App] Failed to create connector:", err)
      if (!cancelled) setLoading(false) // Show empty state instead of infinite loader
    })
    return () => {
      cancelled = true
      // Only dispose on real unmount (connector switch), not Strict Mode re-mount.
      // We detect this by checking if the connector was actually set.
      if (instance) {
        instance.dispose()
      }
    }
  }, [connectorId])

  if (loading || !connector) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Lade {CONNECTOR_OPTIONS.find((o) => o.id === connectorId)?.name ?? connectorId}…
        </div>
      </div>
    )
  }

  return (
    <ConnectorProvider connector={connector} key={connectorId}>
      <IncomingEventsProvider>
        <AuthGate connector={connector} wot={connectorId === "wot"}>
          {/* Focus lives above the routes so it survives module switches — the
              shared panel's onClose must clear the focus on whatever module the
              user is on now, not the one that opened it. */}
          {/* Fokus, Routen (flaches Schema `/{scope}/{modul}/{item}`) und der
              Rahmen kommen aus `RoutedAppFrame`; Home stellt nur, was diese
              App zusaetzlich hat. */}
          <Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />
        </AuthGate>
      </IncomingEventsProvider>
    </ConnectorProvider>
  )
}
