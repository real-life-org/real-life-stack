import { createContext, useContext, useMemo, type ReactNode } from "react"

/** Wohin ein Profil-Klick führen soll. */
export interface OpenProfileOptions {
  /**
   * `auto` (Vorgabe) überlässt der App Shell die Wahl der Fläche: seit
   * Spec 04 §Profile erscheint ein Mitglied als `person`-Item, und dann
   * gehört der Klick dorthin, wo die Person ohnehin steht — ins Detail.
   *
   * `dialog` verlangt ausdrücklich das Profil-Panel. Das brauchen die
   * Flächen, die es NUR dort gibt: der eigene Profil-Editor und die
   * Kontakt-/Verifikationsaktionen. Ohne diesen Weg drehte sich der Klick
   * aus dem person-Detail heraus im Kreis zurück ins person-Detail.
   */
  surface?: "auto" | "dialog"
}

/**
 * Imperative handle to open a profile view for a user. The actual
 * implementation lives in the App Shell — depending on the host app it
 * might open the own-profile editor (when the userId matches the
 * current user) or a read-only view for another user.
 *
 * The toolkit ships only the contract: a hook + a provider. App Shells
 * decide what "open profile" means and wire the dialog/route there.
 */
export type OpenProfile = (userId: string, options?: OpenProfileOptions) => void

const OpenProfileContext = createContext<OpenProfile | null>(null)

export interface OpenProfileProviderProps {
  openProfile: OpenProfile
  children: ReactNode
}

export function OpenProfileProvider({ openProfile, children }: OpenProfileProviderProps) {
  // Memoize so child consumers don't re-render when the host re-renders
  // with an unchanged handler.
  const value = useMemo(() => openProfile, [openProfile])
  return <OpenProfileContext.Provider value={value}>{children}</OpenProfileContext.Provider>
}

/**
 * Returns an `(userId: string) => void` callback that opens the user's
 * profile, or a no-op if no `OpenProfileProvider` is mounted above.
 *
 * The no-op fallback means avatar-click sites can call this hook
 * unconditionally without breaking stories or test harnesses that
 * don't bother to wire a provider.
 */
export function useOpenProfile(): OpenProfile {
  return useContext(OpenProfileContext) ?? noop
}

const noop: OpenProfile = () => {}
