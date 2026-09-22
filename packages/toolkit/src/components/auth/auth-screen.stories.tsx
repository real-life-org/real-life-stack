import type { Meta, StoryObj } from "@storybook/react-vite"
import type { AuthMethod, AuthState, Authenticatable, User } from "@real-life-stack/data-interface"
import { createObservable } from "@real-life-stack/data-interface"
import { AuthScreen } from "./auth-screen"

/**
 * **Die Anmeldung.**
 *
 * Der Bildschirm steht vor der App-Hülle, nicht darin: Ohne Identität gibt es
 * keinen Space und keine Karte. Welche Wege er anbietet, entscheidet er nicht
 * selbst, sondern fragt den Connector über `getAuthMethods()`. Ein Connector,
 * der nur anonymen Zugang kennt, bekommt einen Knopf; einer mit E-Mail bekommt
 * zwei Formulare.
 *
 * Das Trust Protocol geht einen eigenen Weg: Dort ist die Identität ein
 * Schlüsselpaar und die Anmeldung ein Seed-Onboarding, kein Passwort. Deshalb
 * bringt der Connector dafür seinen eigenen Bildschirm mit, und dieser hier
 * bleibt für Server-Connectoren wie Supabase.
 */

function authConnector(methods: AuthMethod[]): Authenticatable {
  const user: User = { id: "mira", displayName: "Mira Beispiel" }
  const state = createObservable<AuthState>({ status: "unauthenticated" })
  return {
    getAuthState: () => state,
    getAuthMethods: () => methods,
    authenticate: async () => {
      state.set({ status: "authenticated", user })
      return user
    },
    logout: async () => state.set({ status: "unauthenticated" }),
    observeCurrentUser: () => createObservable<User | null>(null),
    getCurrentUser: async () => null,
    getUser: async () => user,
  } as unknown as Authenticatable
}

const meta: Meta<typeof AuthScreen> = {
  id: "rls-app-shell-anmeldung",
  title: "RLS/App shell/Sign-in",
  component: AuthScreen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof AuthScreen>

/** E-Mail mit Registrierung, dazu ein anonymer Schnellstart. Der volle Fall. */
export const Alles: Story = {
  name: "Alle Wege",
  render: () => (
    <AuthScreen
      connector={authConnector([
        { method: "email", label: "E-Mail" },
        { method: "email-signup", label: "Registrieren" },
        { method: "anonymous", label: "Ohne Konto ansehen" },
      ])}
      onAuthenticated={() => {}}
    />
  ),
}

/** Nur E-Mail, keine Registrierung: eine geschlossene Instanz. */
export const NurAnmeldung: Story = {
  name: "Nur Anmeldung",
  render: () => (
    <AuthScreen connector={authConnector([{ method: "email", label: "E-Mail" }])} onAuthenticated={() => {}} />
  ),
}

/** Nur anonym: eine öffentliche Ansicht, in die man einfach hineingeht. */
export const NurAnonym: Story = {
  name: "Nur anonym",
  render: () => (
    <AuthScreen
      connector={authConnector([{ method: "anonymous", label: "Ohne Konto ansehen" }])}
      onAuthenticated={() => {}}
      title="Willkommen"
    />
  ),
}
