import { useState, type ReactNode } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { DataInterface, Item } from "@real-life-stack/data-interface"
import { createObservable, isWritable } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "./connector-context"
import { useItems, useItem } from "./use-items"
import { useItemAuthor } from "./use-item-author"
import { useCreateItem, useUpdateItem, useDeleteItem } from "./use-mutations"
import { useItemPermissions } from "./use-item-permissions"
import { useOptionalCurrentUser } from "./use-auth"
import { useGroups, useCurrentGroup, useMembers } from "./use-groups"
import { useComments } from "./use-comments"
import { useReactions } from "./use-reactions"
import { useCommentCount } from "./use-comment-count"
import { useModuleFilteredItems } from "./use-filterable-items"
import { Button } from "../components/primitives/button"
import { ModulePanelProvider, useModulePanel } from "../components/module-panel/module-panel"
import { FilterProvider, useSharedFilter } from "../components/filter/filter-store"
import { STORY_ME, STORY_POST, STORY_TASK, StoryWorld } from "../story-support/story-world"

/**
 * **The hooks of the toolkit.**
 *
 * A surface in Real Life Stack never calls the connector directly. It asks
 * hooks, and the hooks talk to the connector. There is a reason: which backend
 * lies underneath the surface should not know — only what it may ask.
 *
 * Two rules that hold everywhere and are demonstrated here:
 *
 * 1. **Reading always answers.** If a connector cannot do something — no
 *    groups, no sign-in, no writing — the reading hook answers empty. It does
 *    not throw. "No groups" is a true answer, not an error.
 * 2. **Writing fails on the call, not on preparation.** Any surface may build
 *    a button; whether it does something is said by the capability check
 *    (`isWritable`, `useItemPermissions`), not by an exception while rendering.
 *
 * Every story below runs on a real data source. What you click takes effect.
 * The full list with one line per hook: [All hooks](?path=/docs/rls-foundations-all-hooks--docs).
 */

// ── Darstellung ────────────────────────────────────────────────────────────

function Zeile({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[14rem_minmax(0,1fr)] items-baseline gap-4 border-b py-2 last:border-b-0">
      <code className="font-mono text-[13px] text-primary">{name}</code>
      <span className="text-sm">{children}</span>
    </div>
  )
}

function Tafel({ titel, hinweis, children }: { titel: string; hinweis?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-6">
      <div>
        <h2 className="text-lg font-semibold">{titel}</h2>
        {hinweis && <p className="mt-1 text-sm text-muted-foreground">{hinweis}</p>}
      </div>
      <div className="rounded-xl border bg-card px-5 py-2">{children}</div>
    </div>
  )
}

/** A connector that can only read — for the counter-check in “Permissions”. */
function nurLesen(): DataInterface {
  const items = createObservable<Item[]>([STORY_POST])
  return {
    init: async () => {}, dispose: async () => {},
    getItems: async () => items.current, getItem: async () => STORY_POST,
    observe: () => items, observeItem: () => createObservable<Item | null>(STORY_POST),
  } as unknown as DataInterface
}

// ── 1. Items lesen ─────────────────────────────────────────────────────────

function ItemsLesen() {
  const { data: items, isLoading } = useItems()
  const { data: eines } = useItem(STORY_POST.id)
  const { data: members } = useMembers(null)
  const urheber = useItemAuthor(eines, members)
  const kommentare = useCommentCount(STORY_POST.id)
  return (
    <Tafel
      titel="Items lesen"
      hinweis="Alle vier beobachten die Datenquelle: Ändert sie sich, rendert die Fläche neu. Keiner von ihnen lädt auf Zuruf."
    >
      <Zeile name="useItems()">
        {isLoading ? "lädt …" : `${items.length} Items im aktiven Space`}
      </Zeile>
      <Zeile name="useItem(id)">{eines ? String(eines.data.title) : "nicht gefunden"}</Zeile>
      <Zeile name="useItemAuthor(item, members)">{urheber?.displayName ?? "unbekannt"}</Zeile>
      <Zeile name="useCommentCount(id)">{kommentare} Kommentare</Zeile>
    </Tafel>
  )
}

// ── 2. Items schreiben ─────────────────────────────────────────────────────

function ItemsSchreiben() {
  const { data: items } = useItems()
  const { mutate: anlegen } = useCreateItem()
  const { mutate: aendern } = useUpdateItem()
  const { mutate: loeschen } = useDeleteItem()
  const eigene = items.filter((i) => i.type === "post" && i.id.startsWith("neu-"))
  return (
    <Tafel
      titel="Items schreiben"
      hinweis="Drei Mutationen, ein Vertrag: Sie geben ein Versprechen zurück und lösen die Beobachter aus. Die Liste unten kommt aus useItems und rührt sich von selbst."
    >
      <Zeile name="useCreateItem()">
        <Button
          size="sm"
          onClick={() =>
            anlegen({ id: `neu-${Date.now()}`, type: "post", createdBy: STORY_ME.id, data: { title: "Frisch angelegt", content: "Aus der Story heraus." } })
          }
        >
          Beitrag anlegen
        </Button>
      </Zeile>
      <Zeile name="useUpdateItem()">
        <Button size="sm" variant="outline" disabled={!eigene.length} onClick={() => eigene[0] && aendern(eigene[0].id, { data: { ...eigene[0].data, title: "Umbenannt" } })}>
          Ersten umbenennen
        </Button>
      </Zeile>
      <Zeile name="useDeleteItem()">
        <Button size="sm" variant="outline" disabled={!eigene.length} onClick={() => eigene[0] && loeschen(eigene[0].id)}>
          Ersten löschen
        </Button>
      </Zeile>
      <Zeile name="useItems()">
        {eigene.length === 0 ? "noch nichts angelegt" : eigene.map((i) => String(i.data.title)).join(" · ")}
      </Zeile>
    </Tafel>
  )
}

// ── 3. Rechte und Fähigkeiten ──────────────────────────────────────────────

function Rechte() {
  const rechte = useItemPermissions(STORY_POST)
  const { data: user } = useOptionalCurrentUser()
  const { data: groups } = useGroups()
  const space = useCurrentGroup()
  const { data: members } = useMembers(null)
  return (
    <>
      <Zeile name="useOptionalCurrentUser()">{user ? user.displayName : "niemand angemeldet"}</Zeile>
      <Zeile name="useGroups()">{groups.length} Spaces</Zeile>
      <Zeile name="useCurrentGroup()">{space?.name ?? "keiner"}</Zeile>
      <Zeile name="useMembers(null)">{members.length} Menschen</Zeile>
      <Zeile name="useItemPermissions(item)">
        bearbeiten: {String(rechte.canEdit)} · löschen: {String(rechte.canDelete)}
      </Zeile>
    </>
  )
}

function RechteVergleich() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-2">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Voller Connector</h2>
          <p className="mt-1 text-sm text-muted-foreground">Write, Gruppen, Anmeldung.</p>
        </div>
        <div className="rounded-xl border bg-card px-5 py-2">
          <StoryWorld>
            <Rechte />
          </StoryWorld>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Nur-Lese-Connector</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dieselben Hooks, dieselbe Fläche. Nichts wirft, alles antwortet leer.
          </p>
        </div>
        <div className="rounded-xl border bg-card px-5 py-2">
          <ConnectorProvider connector={nurLesen()}>
            <Rechte />
          </ConnectorProvider>
        </div>
      </div>
    </div>
  )
}

// ── 4. Beziehungen ─────────────────────────────────────────────────────────

function Beziehungen() {
  const { comments, createComment } = useComments(STORY_POST.id)
  const { reactions, react, canReact } = useReactions(STORY_POST.id)
  const [text, setText] = useState("")
  return (
    <Tafel
      titel="Beziehungen: Kommentare und Reaktionen"
      hinweis="Beides sind eigene Items, die per Relation auf das Item zeigen (commentOn, reactsTo). Die Hooks verbergen das und geben fertige Listen."
    >
      <Zeile name="useComments(id)">
        {comments.length} Kommentare
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) void createComment(text.trim())
            setText("")
          }}
        >
          <input
            className="h-8 flex-1 rounded-md border px-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Kommentar schreiben …"
          />
          <Button size="sm" type="submit">Senden</Button>
        </form>
      </Zeile>
      <Zeile name="useReactions(id)">
        {reactions.length === 0 ? "noch keine" : reactions.map((r) => `${r.emoji} ${r.count}`).join(" · ")}
        <div className="mt-2 flex gap-2">
          {["👍", "🎉", "❤️"].map((emoji) => (
            <Button key={emoji} size="sm" variant="outline" disabled={!canReact} onClick={() => void react(emoji)}>
              {emoji}
            </Button>
          ))}
        </div>
      </Zeile>
    </Tafel>
  )
}

// ── 5. Flächen ─────────────────────────────────────────────────────────────

function Flaechen() {
  const panel = useModulePanel()
  const { value, searchText, setSearchText } = useSharedFilter()
  const { data: items } = useItems()
  const gefiltert = useModuleFilteredItems(items)
  return (
    <Tafel
      titel="Flächen: das geteilte Panel und der geteilte Filter"
      hinweis="Beide leben in einem Provider über den Modulen, nicht im Modul. Deshalb überdauern sie den Modulwechsel, und es gibt immer nur ein Panel."
    >
      <Zeile name="useSharedFilter()">
        <input
          className="h-8 w-56 rounded-md border px-2 text-sm"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Suchen …"
        />
        <span className="ml-3 text-muted-foreground">
          {gefiltert.length} von {items.length} · Typen: {value.types?.length ?? 0}
        </span>
      </Zeile>
      <Zeile name="useModulePanel()">
        <Button
          size="sm"
          onClick={() =>
            panel.open({
              kind: "custom",
              itemId: STORY_TASK.id,
              content: <div className="p-5 text-sm">Irgendein Inhalt. Es gibt nur dieses eine Panel.</div>,
            })
          }
        >
          Panel öffnen
        </Button>
        <span className="ml-3 text-muted-foreground">
          {panel.current ? `offen (${panel.current.kind})` : "zu"}
        </span>
      </Zeile>
    </Tafel>
  )
}

// ── Stories ────────────────────────────────────────────────────────────────

const meta: Meta = {
  id: "rls-foundations-hooks",
  title: "RLS/Foundations/Hooks",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj

export const Read: Story = {
  name: "1 · Read items",
  render: () => (
    <StoryWorld>
      <ItemsLesen />
    </StoryWorld>
  ),
}

export const Write: Story = {
  name: "2 · Write items",
  render: () => (
    <StoryWorld>
      <ItemsSchreiben />
    </StoryWorld>
  ),
}

export const Permissions: Story = {
  name: "3 · Permissions and capabilities",
  render: () => <RechteVergleich />,
}

export const Relations: Story = {
  name: "4 · Relations",
  render: () => (
    <StoryWorld>
      <Beziehungen />
    </StoryWorld>
  ),
}

export const Surfaces: Story = {
  name: "5 · Surfaces",
  render: () => (
    <StoryWorld>
      <FilterProvider>
        <ModulePanelProvider allowedModes={["floating", "drawer"]}>
          <Flaechen />
        </ModulePanelProvider>
      </FilterProvider>
    </StoryWorld>
  ),
}

/** The capability check every writing surface makes before it shows a button. */
export const CapabilityCheck: Story = {
  name: "6 · Check a capability",
  render: function Render() {
    function Probe() {
      const { data: items } = useItems()
      return (
        <>
          <Zeile name="isWritable(connector)">
            <Schreibbar />
          </Zeile>
          <Zeile name="useItems()">{items.length} Items</Zeile>
        </>
      )
    }
    function Schreibbar() {
      const rechte = useItemPermissions(STORY_POST)
      return <>{rechte.canEdit ? "ja, Knopf zeigen" : "nein, Knopf weglassen"}</>
    }
    return (
      <div className="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Schreibbar</h2>
          <div className="rounded-xl border bg-card px-5 py-2">
            <StoryWorld>
              <Probe />
            </StoryWorld>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Nur lesend</h2>
          <div className="rounded-xl border bg-card px-5 py-2">
            <ConnectorProvider connector={nurLesen()}>
              <Probe />
            </ConnectorProvider>
          </div>
        </div>
        <p className="text-sm text-muted-foreground md:col-span-2">
          Die Prüfung heißt <code className="font-mono">{String(isWritable.name)}</code> und kommt aus dem
          Datenvertrag, nicht aus dem Toolkit. Dieselbe Form gibt es für Gruppen, Anmeldung,
          Relationen und Verlauf.
        </p>
      </div>
    )
  },
}
