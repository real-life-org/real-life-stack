import type { Meta, StoryObj } from "@storybook/react-vite"
import type { AuthMethod, AuthState, Authenticatable, User } from "@real-life-stack/data-interface"
import { createObservable } from "@real-life-stack/data-interface"
import { AuthScreen } from "./auth-screen"

/**
 * **Sign-in.**
 *
 * The screen stands before the app shell, not inside it: without an identity
 * there is no space and no card. Which ways it offers it does not decide
 * itself — it asks the connector through `getAuthMethods()`. A connector that
 * only knows anonymous access gets one button; one with e-mail gets two forms.
 *
 * The trust protocol goes its own way: there the identity is a key pair and
 * sign-in is a seed onboarding, not a password. So that connector brings its
 * own screen, and this one stays for server connectors like Supabase.
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
  id: "rls-app-shell-sign-in",
  title: "RLS/App shell/Sign-in",
  component: AuthScreen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof AuthScreen>

/** E-mail with sign-up, plus an anonymous quick start. The full case. */
export const AllWays: Story = {
  name: "All ways",
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

/** E-mail only, no sign-up: a closed instance. */
export const SignInOnly: Story = {
  name: "Sign-in only",
  render: () => (
    <AuthScreen connector={authConnector([{ method: "email", label: "E-Mail" }])} onAuthenticated={() => {}} />
  ),
}

/** Anonymous only: a public view you simply walk into. */
export const AnonymousOnly: Story = {
  name: "Anonymous only",
  render: () => (
    <AuthScreen
      connector={authConnector([{ method: "anonymous", label: "Ohne Konto ansehen" }])}
      onAuthenticated={() => {}}
      title="Willkommen"
    />
  ),
}
