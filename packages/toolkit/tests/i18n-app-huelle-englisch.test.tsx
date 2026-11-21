// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { RouterProvider, createMemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MockConnector } from "@real-life/mock-connector"
import type { AuthMethod, User } from "@real-life/data-interface"

import { de } from "../src/i18n/de"
import { en } from "../src/i18n/en"
import { getI18n, setLanguage } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

// Stabile Identität wie beim echten Hook — ein neues Array je Render liefe in eine Effektschleife.
const MEMBERS = { data: [{ id: "did:key:zME", displayName: "Me", isAdmin: true }], isLoading: false }
vi.mock("../src/hooks/use-groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/hooks/use-groups")>()),
  useMembers: () => MEMBERS,
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")
const { WorkspaceSyncNotice } = await import("../src/components/layout/workspace-switcher")
const { AppFrame } = await import("../src/components/frame/app-frame")
const { AuthScreen } = await import("../src/components/auth/auth-screen")
const { PassphraseConfirm } = await import("../src/components/auth/PassphraseInput")
const { ContactsDialog } = await import("../src/components/contacts/contacts-dialog")
const { IncomingContactRequestDialog } = await import("../src/components/contacts/incoming-contact-request-dialog")
const { IncomingSpaceInviteDialog } = await import("../src/components/contacts/incoming-space-invite-dialog")
const { MutualVerificationDialog } = await import("../src/components/contacts/mutual-verification-dialog")
const { ErrorBoundary } = await import("../src/components/primitives/error-boundary")
const { ModuleSettingsPlaceholder } = await import("../src/components/module-panel/module-settings-placeholder")
const { ConnectorProvider } = await import("../src/hooks/connector-context")
const { MemoryFocusProvider } = await import("../src/hooks/use-item-focus")
const { UnsavedChangesProvider, useUnsavedChanges } = await import("../src/hooks/use-unsaved-changes")
const { UnsavedChangesGuard } = await import("../src/router")
const { getModules } = await import("../src/lib/module-register")

/**
 * Die App-Hülle auf Englisch (i18n, Teil 2.1). Die übrigen Suiten laufen auf
 * Deutsch (`setup-i18n.ts`) und prüfen dort die deutschen Texte; hier steht je
 * migriertem Bereich mindestens ein Text in der englischen Fassung. `en.ts`
 * fängt fehlende Schlüssel schon beim Kompilieren (`satisfies`) — diese Suite
 * fängt, was der Compiler nicht sieht: eine Komponente, die am Wörterbuch
 * vorbei doch noch Deutsch zeigt.
 */
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  resetI18nForTests("en")
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

async function render(node: ReactNode) {
  await act(async () => { root.render(node) })
}
/** Dialoge rendern in ein Portal — deshalb der ganze Body. */
const text = () => document.body.textContent ?? ""
const labels = () => [...document.body.querySelectorAll("[aria-label]")].map((el) => el.getAttribute("aria-label"))

describe("Wörterbücher", () => {
  const placeholders = (message: unknown) =>
    [...new Set(JSON.stringify(message).match(/\{\w+\}/g) ?? [])].sort()

  it("jede englische Übersetzung trägt dieselben Platzhalter wie die deutsche", () => {
    const abweichend = (Object.keys(de) as (keyof typeof de)[]).filter(
      (key) => placeholders(de[key]).join() !== placeholders(en[key]).join(),
    )
    expect(abweichend).toEqual([])
  })

  it("Plural-Einträge sind in beiden Sprachen Plural-Einträge", () => {
    const abweichend = (Object.keys(de) as (keyof typeof de)[]).filter(
      (key) => typeof de[key] !== typeof en[key],
    )
    expect(abweichend).toEqual([])
  })
})

describe("layout — Space-Dialog und Space-Auswahl", () => {
  const props = {
    open: true,
    onOpenChange: () => {},
    currentUserId: "did:key:zME",
    contacts: [],
    onCreateGroup: async () => {},
    onUpdateGroup: async () => {},
    onDeleteGroup: async () => {},
    onInviteMember: async () => {},
  }

  it("legt eine neue Gruppe auf Englisch an", async () => {
    await render(createElement(GroupDialog, { ...props, mode: { type: "create" } } as never))
    expect(text()).toContain("New group")
    expect(text()).toContain("Create a new group for your team.")
    expect(text()).toContain("Cancel")
  })

  it("zählt Mitglieder im englischen Plural und benennt die Bereiche", async () => {
    await render(createElement(GroupDialog, {
      ...props,
      mode: { type: "edit", group: { id: "g1", name: "Garden", data: {} } },
    } as never))
    expect(text()).toContain("1 member")
    expect(text()).toContain("you're an admin")
    expect(text()).toContain("Invite")
    expect(text()).toContain("Leave")
  })

  it("wechselt die Sprache im offenen Dialog", async () => {
    await render(createElement(GroupDialog, { ...props, mode: { type: "create" } } as never))
    expect(text()).toContain("New group")
    await act(async () => { setLanguage("de") })
    expect(text()).toContain("Neue Gruppe")
  })

  it("meldet den Erstabgleich der Gruppen", async () => {
    await render(createElement("div", null,
      createElement(WorkspaceSyncNotice, { loaded: 1, expected: 3 }),
      createElement(WorkspaceSyncNotice, { loaded: 1, expected: null }),
    ))
    expect(text()).toContain("1 of 3 groups loaded …")
    expect(text()).toContain("1 group loaded, more are on the way …")
  })
})

describe("frame + host + router — Rahmen, Outlet und Overview", () => {
  async function rendereRahmen(routing: Record<string, unknown>) {
    const groups = [{ id: "garten", name: "Garden", data: { modules: ["feed"] } }]
    const connector = new MockConnector(
      { items: [], groups, users: [{ id: "u1", displayName: "Uli" }], groupMembers: { garten: ["u1"] }, groupItems: { garten: [] } },
      { allowFixtureAuthors: true },
    )
    await connector.init()
    connector.setCurrentGroup("garten")
    await render(createElement(ConnectorProvider, { connector },
      createElement(MemoryFocusProvider, { module: "feed", scope: "garten" },
        createElement(AppFrame, {
          routing: {
            groups,
            workspaces: groups.map((g) => ({ id: g.id, name: g.name })),
            activeWorkspace: { id: "garten", name: "Garden" },
            activeModule: "feed",
            modules: getModules().filter((m) => m.id === "feed").map((m) => ({ id: m.id, label: m.label, icon: m.icon })),
            handleWorkspaceChange: () => {},
            handleModuleChange: () => {},
            goTo: () => {},
            goHome: () => {},
            ...routing,
          },
        } as never))))
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  }

  it("sagt ohne Zugang auf Englisch, was los ist", async () => {
    await rendereRahmen({ activeWorkspace: null, urlSpaceId: "fremd" })
    expect(text()).toContain("You're not a member of this space")
    expect(text()).toContain("Back to overview")
  })

  it("beschriftet Plusknopf und Umschalter auf Englisch", async () => {
    await rendereRahmen({})
    expect(labels()).toContain("Create")
    expect(labels()).toContain("Dark theme")
  })

  it("hält beim Verlassen ungespeicherter Eingaben auf Englisch an", async () => {
    let markDirty: () => void = () => {}
    function Sonde() {
      const unsaved = useUnsavedChanges()
      markDirty = () => unsaved?.setDirty(true)
      return null
    }
    const router = createMemoryRouter(
      [{ path: "*", element: createElement(UnsavedChangesProvider, null, createElement(Sonde), createElement(UnsavedChangesGuard)) }],
      { initialEntries: ["/g/collection?compose=task"] },
    )
    await render(createElement(RouterProvider, { router }))
    await act(async () => { markDirty() })
    await act(async () => { await router.navigate("/g/collection") })
    expect(text()).toContain("Discard changes?")
    expect(text()).toContain("Keep editing")
  })
})

describe("auth — Anmeldung", () => {
  const methods: AuthMethod[] = [
    { method: "email", label: "Email login" },
    { method: "email-signup", label: "Email signup" },
  ]
  const connector = {
    getAuthMethods: () => methods,
    authenticate: async (): Promise<User> => ({ id: "u1" }),
    getCurrentUser: async () => null,
    observeCurrentUser: () => ({ current: null, subscribe: () => () => {} }),
    getUser: async () => null,
    getAuthState: () => ({ current: { status: "unauthenticated" as const }, subscribe: () => () => {} }),
    logout: async () => {},
  }

  it("zeigt den Anmeldeschirm auf Englisch", async () => {
    await render(createElement(AuthScreen, { connector: connector as never, onAuthenticated: () => {} }))
    expect(text()).toContain("Sign in")
    expect(text()).toContain("Continue with your account.")
    expect(text()).toContain("Password")
    expect(text()).toContain("No account yet?")
  })

  it("nennt die Mindestlänge im englischen Plural", async () => {
    await render(createElement(PassphraseConfirm, {
      passphrase: "abc", confirm: "abd", onPassphraseChange: () => {}, onConfirmChange: () => {},
    }))
    expect(text()).toContain("At least 8 characters")
    expect(text()).toContain("Passwords don't match")
  })
})

describe("contacts — Kontakte und Begegnungen", () => {
  it("zeigt die Kontaktliste auf Englisch", async () => {
    await render(createElement(ContactsDialog, {
      open: true, onOpenChange: () => {}, activeContacts: [], pendingContacts: [],
      onRemove: () => {}, onEditName: () => {}, onAdd: () => {}, onVerify: () => {},
    }))
    expect(text()).toContain("Contacts")
    expect(text()).toContain("0 active · 0 pending")
    expect(text()).toContain("Add contact")
    expect(text()).toContain("No contacts yet")
  })

  it("setzt hervorgehobene Namen in den englischen Satz", async () => {
    await render(createElement("div", null,
      createElement(IncomingContactRequestDialog, { open: true, fromName: "Anna", onConfirm: () => {}, onDismiss: () => {} }),
    ))
    expect(text()).toContain("Anna would like to add you as a contact.")
    await render(createElement(IncomingSpaceInviteDialog, { open: true, spaceName: "Garden", inviterName: "Ben", onOpen: () => {}, onDismiss: () => {} }))
    expect(text()).toContain("Ben invited you to Garden.")
    await render(createElement(MutualVerificationDialog, { open: true, peerName: "Anna", variant: "contact", onDismiss: () => {} }))
    expect(text()).toContain("You and Anna are now contacts.")
  })
})

describe("primitives + module-panel", () => {
  it("meldet einen ausgefallenen Bereich auf Englisch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    function Boom(): never { throw new Error("kaputt") }
    await render(createElement(ErrorBoundary, null, createElement(Boom)))
    expect(text()).toContain("This area couldn't be displayed")
    expect(text()).toContain("Try again")
    vi.restoreAllMocks()
  })

  it("beschriftet den Platzhalter der Moduleinstellungen auf Englisch", async () => {
    await render(createElement(ModuleSettingsPlaceholder, { moduleLabel: "Map", plannedItems: ["Layers"] }))
    expect(text()).toContain("Map settings")
    expect(text()).toContain("Planned")
  })
})

describe("hooks — außerhalb von React", () => {
  it("getI18n liest die aktive Sprache zur Aufrufzeit", () => {
    expect(getI18n().t("item.untitled")).toBe("Untitled")
    setLanguage("de")
    expect(getI18n().t("item.untitled")).toBe("Ohne Titel")
  })
})
