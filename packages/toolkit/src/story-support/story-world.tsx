import { useEffect, useMemo, type ReactNode } from "react"
import type { Item, User } from "@real-life-stack/data-interface"
import { MockConnector, type MockConnectorSeed } from "@real-life-stack/mock-connector"
import { ConnectorProvider } from "../hooks/connector-context"

/**
 * Eine kleine, echte Welt für Stories.
 *
 * Warum es sie gibt: Mehrere Stories haben die Komponente, die sie zeigen
 * sollten, von Hand nachgebaut — eine „StandaloneReactionBar", eine
 * „StandaloneCommentSection", ein funktionsloser ⋮-Knopf. Der Grund war immer
 * derselbe: Die echte Komponente spricht über Hooks mit einem Connector, und
 * den hatte die Story nicht. Dann driftet der Nachbau lautlos von der
 * Wirklichkeit weg, und der Leser hält ihn für den Vertrag.
 *
 * Diese Datei gehört nicht zur Bibliothek. Sie wird von `src/index.ts` nicht
 * exportiert und landet deshalb in keinem Bündel; sie ist nur für Stories da.
 */

export const STORY_USERS: User[] = [
  { id: "mira", displayName: "Mira Beispiel", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: "jonas", displayName: "Jonas Klein" },
  { id: "lea", displayName: "Lea Weber" },
]

/** Die angemeldete Person in allen Stories. */
export const STORY_ME = STORY_USERS[0]

const iso = (day: number, hour = 10) => `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+02:00`

export const STORY_POST: Item = {
  id: "post-garten",
  type: "post",
  createdAt: iso(1),
  createdBy: "mira",
  tags: ["garten", "planung"],
  data: {
    title: "Samstagstreffen im Gemeinschaftsgarten",
    content: "Wir bereiten die Beete vor und planen die nächsten Schritte. Bringt Handschuhe mit.",
  },
}

export const STORY_EVENT: Item = {
  id: "event-erntefest",
  type: "event",
  createdAt: iso(2),
  createdBy: "mira",
  data: {
    title: "Erntefest",
    description: "Wir teilen unsere Ernte. Bring eine Schüssel und eine Idee mit.",
    start: iso(19, 14),
    end: iso(19, 18),
    locationName: "Am Gemeinschaftsgarten",
    position: { type: "Point", coordinates: [13.405, 52.52] },
  },
}

export const STORY_TASK: Item = {
  id: "task-giessen",
  type: "task",
  createdAt: iso(3),
  createdBy: "jonas",
  data: { title: "Beete gießen", description: "Wer übernimmt die Abendrunde?", status: "open" },
  relations: [{ predicate: "assignedTo", target: "global:lea" }],
}

/** Ein Kommentar an einem Item. `replyTo` macht daraus eine Antwort. */
export function storyComment(id: string, createdBy: string, content: string, on = STORY_POST.id, replyTo?: string): Item {
  return {
    id,
    type: "comment",
    createdAt: iso(4, 9 + Number(id.replace(/\D/g, "") || 0)),
    createdBy,
    data: replyTo ? { content, replyTo } : { content },
    relations: [{ predicate: "commentOn", target: `item:${on}` }],
  }
}

/** Eine Reaktion an einem Item — genau die Form, die `useReactions` schreibt. */
export function storyReaction(id: string, createdBy: string, emoji: string, on = STORY_POST.id): Item {
  return {
    id,
    type: "reaction",
    createdAt: iso(4),
    createdBy,
    data: { emoji },
    relations: [{ predicate: "reactsTo", target: `item:${on}` }],
  }
}

export const STORY_SEED: MockConnectorSeed = {
  users: STORY_USERS,
  groups: [
    { id: "garden", name: "Gemeinschaftsgarten" },
    { id: "workshop", name: "Offene Werkstatt" },
  ],
  groupMembers: { garden: ["mira", "jonas", "lea"], workshop: ["mira"] },
  groupItems: { garden: [STORY_POST.id, STORY_EVENT.id, STORY_TASK.id], workshop: [] },
  items: [
    STORY_POST,
    STORY_EVENT,
    STORY_TASK,
    storyComment("c1", "jonas", "Tolle Idee, bin dabei."),
    storyComment("c2", "lea", "Ich bringe Kuchen mit. 🎂"),
    storyComment("c3", "mira", "Super, dann bis Samstag.", STORY_POST.id, "c1"),
    storyReaction("r1", "jonas", "👍"),
    storyReaction("r2", "lea", "👍"),
    storyReaction("r3", "mira", "🎉"),
  ],
}

export interface StoryWorldOptions {
  /** Items zusätzlich zum Grundbestand, oder ein ganz eigener Bestand. */
  seed?: Partial<MockConnectorSeed>
  /** Welcher Space beim Start aktiv ist. Standard: der Gemeinschaftsgarten. */
  group?: string
}

/**
 * Ein frischer Connector je Story. `allowFixtureAuthors` behält die im Bestand
 * gesetzten Urheber, damit eine Story mehrere Menschen zeigen kann (Spec 08
 * erlaubt das ausdrücklich für Fixtures).
 */
export function makeStoryConnector({ seed, group = "garden" }: StoryWorldOptions = {}): MockConnector {
  const merged: MockConnectorSeed = { ...structuredClone(STORY_SEED), ...seed }
  // Der Mock-Connector zeigt im aktiven Space nur, was `groupItems` ihm
  // zuordnet. Ein Kommentar oder eine Reaktion, die dort fehlt, liegt außerhalb
  // und die Fläche bleibt leer — ein Fallstrick, den keine Story kennen muss.
  // Deshalb landet hier alles im aktiven Space, was nicht ausdrücklich woanders
  // zugeordnet ist.
  const assigned = new Set(Object.values(merged.groupItems ?? {}).flat())
  merged.groupItems = {
    ...merged.groupItems,
    [group]: [
      ...(merged.groupItems?.[group] ?? []),
      ...merged.items.filter((item) => !assigned.has(item.id)).map((item) => item.id),
    ],
  }
  const connector = new MockConnector(merged, { allowFixtureAuthors: true })
  connector.setCurrentGroup(group)
  return connector
}

/**
 * Hülle um eine Story: ein Connector, ein Provider. Die Komponente darin ist
 * die echte und spricht mit echten Daten — Kommentieren, Reagieren und
 * Bearbeiten wirken wirklich, für die Dauer der Sitzung.
 */
export function StoryWorld({ children, ...options }: StoryWorldOptions & { children: ReactNode }) {
  // EIN Connector je Welt, nicht je Render: Bis zum 21.09.2026 entstand er bei
  // jedem Render neu, und sobald ueber der Huelle Zustand lag (der Modul-Tab
  // in `HostWorld`), verschwand mit jedem Tabwechsel alles, was die Story
  // geschrieben hatte (rls#431). Neu entsteht er nur, wenn Seed oder Space
  // wirklich andere sind — der bewusste Reset einer Story bleibt moeglich.
  const key = JSON.stringify([options.group ?? null, options.seed ?? null])
  const connector = useMemo(() => makeStoryConnector(options), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void connector.dispose(), [connector])
  return <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
}

/** Als Storybook-Dekorator: `decorators: [storyWorld()]`. */
export function storyWorld(options: StoryWorldOptions = {}) {
  return function Decorator(Story: () => ReactNode) {
    return <StoryWorld {...options}>{Story()}</StoryWorld>
  }
}
