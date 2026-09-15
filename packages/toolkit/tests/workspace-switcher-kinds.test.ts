// Gliederung des Space-Wechsels nach Netzwerk und Art (Spec 01).
import { describe, it, expect } from "vitest"
import {
  groupWorkspacesByKind,
  workspacesInNetwork,
  type Workspace,
} from "../src/components/layout/workspace-switcher"

const KINDS = [
  { id: "stiftung", label: "Stiftung", labelPlural: "Stiftungen", color: "#1B5E40" },
  { id: "projekt", label: "Projekt", labelPlural: "Projekte" },
]

const WORKSPACES: Workspace[] = [
  { id: "td", name: "trustdonation", isNetwork: true, kinds: KINDS },
  { id: "mn", name: "macher.network", isNetwork: true, kinds: [] },
  { id: "__overview__", name: "Mein Netzwerk", scope: "overview" },
  { id: "p-1", name: "Werkstatt", network: "td", kind: "projekt" },
  { id: "s-1", name: "Bürgerstiftung", network: "td", kind: "stiftung" },
  { id: "g-1", name: "Tratsch", network: "td" },
  { id: "x-1", name: "Fremd", network: "td", kind: "verein" },
  { id: "m-1", name: "Holzwerkstatt", network: "mn" },
  { id: "o-1", name: "Ohne Netzwerk" },
  // Die Lichtung: Projekt in trustdonation UND selbst ein Netzwerk.
  { id: "li", name: "Lichtung", isNetwork: true, network: "td", kind: "projekt", kinds: [] },
]

describe("workspacesInNetwork", () => {
  it("ohne aktives Netzwerk: alle Spaces ausser Netzwerken und Uebersicht", () => {
    expect(workspacesInNetwork(WORKSPACES, null).map((w) => w.id)).toEqual(["p-1", "s-1", "g-1", "x-1", "m-1", "o-1"])
  })

  it("mit aktivem Netzwerk: nur seine Spaces", () => {
    expect(workspacesInNetwork(WORKSPACES, "td").map((w) => w.id)).toEqual(["p-1", "s-1", "g-1", "x-1", "li"])
    expect(workspacesInNetwork(WORKSPACES, "mn").map((w) => w.id)).toEqual(["m-1"])
  })
})

describe("groupWorkspacesByKind", () => {
  const inTd = workspacesInNetwork(WORKSPACES, "td")

  it("ohne Arten: genau ein Abschnitt „Gruppen“ mit allen Spaces, wie vorher", () => {
    const sections = groupWorkspacesByKind(inTd)
    expect(sections.map((s) => s.label)).toEqual(["Gruppen"])
    expect(sections[0].workspaces.map((w) => w.id)).toEqual(["p-1", "s-1", "g-1", "x-1", "li"])
  })

  it("mit Arten: Abschnitte in Reihenfolge des Netzwerks, Rest zuletzt unter „Gruppen“", () => {
    const sections = groupWorkspacesByKind(inTd, KINDS)
    expect(sections.map((s) => s.label)).toEqual(["Stiftungen", "Projekte", "Gruppen"])
    expect(sections[0].color).toBe("#1B5E40")
    expect(sections[0].workspaces.map((w) => w.id)).toEqual(["s-1"])
    expect(sections[1].workspaces.map((w) => w.id)).toEqual(["p-1", "li"])
  })

  it("eine unbekannte Art ist kein Fehler: der Space steht bei den Spaces ohne Art", () => {
    const rest = groupWorkspacesByKind(inTd, KINDS).find((s) => s.id === "")!
    expect(rest.workspaces.map((w) => w.id)).toEqual(["g-1", "x-1"])
  })

  it("ein Abschnitt ohne Spaces entfaellt, auch „Gruppen“", () => {
    const nurArten = inTd.filter((w) => w.kind === "projekt" || w.kind === "stiftung")
    expect(groupWorkspacesByKind(nurArten, KINDS).map((s) => s.label)).toEqual(["Stiftungen", "Projekte"])
  })

  it("die Uebersicht gehoert in keinen Abschnitt; ein Netzwerk im Netzwerk schon (Lichtung)", () => {
    const sections = groupWorkspacesByKind(inTd, KINDS)
    for (const section of sections) expect(section.workspaces.some((w) => w.scope === "overview")).toBe(false)
    expect(sections.find((s) => s.id === "projekt")!.workspaces.map((w) => w.id)).toContain("li")
  })

  it("ein Netzwerk steht nie in seiner eigenen Liste", () => {
    expect(workspacesInNetwork(WORKSPACES, "li").map((w) => w.id)).toEqual([])
  })

  it("ohne Spaces und ohne Arten bleibt der leere Abschnitt „Gruppen“ stehen", () => {
    expect(groupWorkspacesByKind([WORKSPACES[2]])).toEqual([{ id: "", label: "Gruppen", workspaces: [] }])
  })
})
