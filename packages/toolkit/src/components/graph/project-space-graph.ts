import {
  canonicalItemType,
  isAuthoredSystemItem,
  type Item,
  type RelationRecord,
  type User,
} from "@real-life-stack/data-interface"
import { itemTitle } from "../../lib/item-text"
import type { GraphEdge, GraphNode, GraphTypeDescriptor } from "./types"

/**
 * Items und Beziehungen als Graph.
 *
 * `GraphView` nimmt fertige Knoten und Kanten. Wer den Graphen füttern will,
 * musste diese Umrechnung deshalb selbst bauen — und beide Apps haben das
 * getan, verschieden. Diese hier ist die vollständigere: Sie kennt Personen
 * als Knoten, Ziele in anderen Spaces und die Namensräume der Knoten-Ids.
 *
 * Bis zum 21.09.2026 hatte die Netzwerk-App eine eigene, ohne Namensräume
 * (`project-relation-graph.ts`); seit sie auf dem Modul-Host läuft, ist dies
 * die eine Umrechnung. Von dort stammt das Bild am Item-Knoten: Eine Person,
 * die als Item steht (Spec 09, Profil als Spiegel), trägt ihr Bild in
 * `data.avatarUrl`.
 */

/** Ein Bild aus den Daten — nur, was ein Browser gefahrlos laden kann. */
function itemAvatarUrl(item: Item): string | undefined {
  for (const key of ["avatarUrl", "avatar", "avatarThumbnail"] as const) {
    const value = item.data[key]
    if (typeof value === "string" && /^(?:data:image\/|https:\/\/)/.test(value)) return value
  }
  return undefined
}


/** Palette per type id; register supplies the labels. Deliberately local:
 *  colour-on-canvas is a graph concern, not a register concern. */
const NODE_COLORS: Record<string, { color: string; darkColor: string }> = {
  person: { color: "#2a78d6", darkColor: "#3987e5" },
  post: { color: "#8b5cf6", darkColor: "#7c4fe0" },
  event: { color: "#eda100", darkColor: "#c98500" },
  place: { color: "#1baf7a", darkColor: "#199e70" },
  task: { color: "#d97706", darkColor: "#b45309" },
  statement: { color: "#0ea5e9", darkColor: "#0284c7" },
  project: { color: "#16a34a", darkColor: "#15803d" },
  resource: { color: "#e11d48", darkColor: "#be123c" },
}
const FALLBACK_COLOR = { color: "#64748b", darkColor: "#475569" }

/**
 * Graph node ids are NAMESPACED by identity kind (`item:` / `user:`). Item
 * ids and user ids come from different sources and share no namespace — a
 * collision used to merge both into one node, and a click on the person then
 * opened the item instead of the profile (rls#248).
 */
export const graphItemNodeId = (id: string): string => `item:${id}`
export const graphUserNodeId = (id: string): string => `user:${id}`

/** Decode a namespaced graph node id back to kind + original id. */
export function graphNodeRef(nodeId: string): { kind: "item" | "user"; id: string } | null {
  if (nodeId.startsWith("item:")) return { kind: "item", id: nodeId.slice("item:".length) }
  if (nodeId.startsWith("user:")) return { kind: "user", id: nodeId.slice("user:".length) }
  return null
}

export interface GraphProjection {
  nodes: GraphNode[]
  edges: GraphEdge[]
  nodeTypes: GraphTypeDescriptor[]
}

const label = (item: Item): string =>
  itemTitle(item)

/** `item:x` / `space:s/item:x` → item id (+ claimed space); `global:u` → user id. */
function parseTarget(
  target: string,
): { kind: "item"; id: string; spaceId?: string } | { kind: "user"; id: string } | null {
  if (target.startsWith("global:")) return { kind: "user", id: target.slice("global:".length) }
  if (target.startsWith("item:")) return { kind: "item", id: target.slice("item:".length) }
  const cross = target.match(/^space:([^/]+)\/item:(.+)$/)
  if (cross) return { kind: "item", id: cross[2], spaceId: cross[1] }
  return null
}

/**
 * Pure projection: items + relation records + users → graph. Exported for
 * tests. Person nodes appear only when an edge actually reaches them — the
 * graph shows the space's fabric, not the member list.
 */
export function projectSpaceGraph(
  items: readonly Item[],
  records: readonly RelationRecord[],
  users: readonly User[],
  resolveLabel: (typeId: string) => string,
  opts?: {
    /** Which space an item ACTUALLY lives in (connector knowledge), or null. */
    resolveItemSpace?: (itemId: string) => string | null
  },
): GraphProjection {
  const cardItems = items.filter((item) => !isAuthoredSystemItem(item.type))
  const itemIds = new Set(cardItems.map((item) => item.id))
  const usersById = new Map(users.map((user) => [user.id, user]))

  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const usedTypes = new Set<string>()

  for (const item of cardItems) {
    const nodeId = graphItemNodeId(item.id)
    const avatarUrl = itemAvatarUrl(item)
    // Der Knotentyp ist die erste Klasse (Farbe, Legende) — eine UI-Wahl (Spec 06, Regel 9).
    const type = canonicalItemType(item.type)
    nodes.set(nodeId, { id: nodeId, label: label(item), type, ...(avatarUrl ? { avatarUrl } : {}) })
    usedTypes.add(type)
  }

  /** Adds the person node lazily; returns null for unknown endpoints. */
  const endpointNode = (target: string): string | null => {
    const parsed = parseTarget(target)
    if (!parsed) return null
    if (parsed.kind === "item") {
      if (!itemIds.has(parsed.id)) return null
      // A space-qualified target claims a HOME for the item. Connect only when
      // the connector confirms the local item really lives there — a local id
      // that merely collides with a foreign item's id must not link. No
      // resolver → unverifiable → drop, never guess.
      if (parsed.spaceId !== undefined) {
        if (opts?.resolveItemSpace?.(parsed.id) !== parsed.spaceId) return null
      }
      return graphItemNodeId(parsed.id)
    }
    const user = usersById.get(parsed.id)
    if (!user) return null
    const nodeId = graphUserNodeId(user.id)
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        label: user.displayName ?? user.id,
        type: "person",
        avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : undefined,
      })
      usedTypes.add("person")
    }
    return nodeId
  }

  // Embedded relations (spec 04, forward): task --assignedTo--> person, …
  for (const item of cardItems) {
    for (const relation of item.relations ?? []) {
      const other = endpointNode(relation.target)
      if (!other) continue
      edges.push({
        id: `${item.id}|${relation.predicate}|${other}`,
        sourceId: graphItemNodeId(item.id),
        targetId: other,
        predicate: relation.predicate,
      })
    }
  }

  // Relation records (spec 08): from --predicate--> to, as first-class edges.
  for (const record of records) {
    const from = endpointNode(record.from)
    const to = endpointNode(record.to)
    if (!from || !to) continue
    edges.push({ id: record.id, sourceId: from, targetId: to, predicate: record.predicate })
  }

  const nodeTypes: GraphTypeDescriptor[] = [...usedTypes].sort().map((typeId) => ({
    id: typeId,
    label: resolveLabel(typeId),
    ...(NODE_COLORS[typeId] ?? FALLBACK_COLOR),
  }))

  return { nodes: [...nodes.values()], edges, nodeTypes }
}
