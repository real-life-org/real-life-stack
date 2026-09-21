import { useCallback, useMemo, useState } from "react"
import type { DataInterface } from "@real-life-stack/data-interface"
import {
  AdaptivePanel,
  ConnectorProvider,
  ProfilePanelContent,
  useMembers,
  useOptionalCurrentUser,
} from "@real-life-stack/toolkit"
import { MapLibreAdapterProvider } from "@real-life-stack/toolkit/maplibre"
import { RoutedAppFrame } from "@real-life-stack/toolkit/router"

interface AppProps {
  connector: DataInterface
}

/**
 * Die Netzwerk-App: Connector, Karten-Engine, der Rahmen aus dem Toolkit
 * (`RoutedAppFrame`, Spec 01 „Was bei der App bleibt") und das Register
 * (`module-register.tsx`). Eigenes gibt es genau eines — das Profil-Overlay,
 * bis das Profil ein Item ist (Spec 09).
 *
 * Bis zum 21.09.2026 stand hier eine Shell mit sechs handverdrahteten
 * Linsen; danach ein Tag lang dieselbe Provider-Liste wie in der
 * Referenz-App, von Hand — und ohne den Guard vor Entwurfsverlust (rls#429).
 */
function NetworkShell() {
  const { data: currentUser } = useOptionalCurrentUser()
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const { data: knownUsers } = useMembers(null)
  const profileUser = useMemo(() => {
    if (!profileUserId) return null
    if (currentUser?.id === profileUserId) return currentUser
    return knownUsers.find((user) => user.id === profileUserId) ?? { id: profileUserId }
  }, [currentUser, knownUsers, profileUserId])
  const openProfile = useCallback((userId: string) => setProfileUserId(userId), [])
  const closeProfile = useCallback(() => setProfileUserId(null), [])

  return (
    <MapLibreAdapterProvider>
      {/* Der Rueckfall ohne Feld ist die Liste (Spec 01, Der Modul-Host). */}
      <RoutedAppFrame fallbackModule="collection" openProfile={openProfile}>
        <AdaptivePanel open={profileUser !== null} onClose={closeProfile} allowedModes={["modal"]} modalClassName="sm:max-w-sm">
          {profileUser && (
            <ProfilePanelContent
              key={profileUser.id}
              mode="view"
              profile={{ did: profileUser.id, name: profileUser.displayName ?? profileUser.id, avatar: profileUser.avatarUrl }}
              onClose={closeProfile}
            />
          )}
        </AdaptivePanel>
      </RoutedAppFrame>
    </MapLibreAdapterProvider>
  )
}

export default function App({ connector }: AppProps) {
  return (
    <ConnectorProvider connector={connector}>
      <NetworkShell />
    </ConnectorProvider>
  )
}
