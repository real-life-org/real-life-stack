// @vitest-environment jsdom
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life/data-interface"

import { ItemTypeBadge } from "../src/components/preview/item-type-badge"
import { getItemPreviewAdornments } from "../src/components/preview/item-type-meta"
import {
  registerTypePresentation,
  renderTypeFooter,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"
import {
  composeTypeManifest,
  TOOLKIT_TYPE_LAYER,
  type TypeManifestEntry,
} from "@real-life/data-interface"

/**
 * Ein App-eigener Typ mit einer Kante, wie ihn eine App mitbringen wuerde.
 * Bis zum 21.09.2026 stand hier `statement`; das ist seither ein Toolkit-Typ
 * (Spec 06) und kann von keiner App mehr definiert werden.
 */
const SIGHTING_TYPE_DEFINITION: TypeManifestEntry = {
  id: "sighting",
  vocabularies: [],
  relations: [{ predicate: "spottedBy", itemRole: "to", otherKind: "person" }],
}

/** Manifest wie in einer App komponiert: Toolkit + eigener Typ. */
const APP_MANIFEST = composeTypeManifest([
  TOOLKIT_TYPE_LAYER,
  { name: "app", definitions: [SIGHTING_TYPE_DEFINITION] },
])

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const item = (type: string, data: Record<string, unknown> = {}, relations: Item["relations"] = []): Item =>
  ({ id: `i-${type}`, type, createdAt: "2026-08-04T10:00:00.000Z", createdBy: "u1", data, relations }) as Item

afterEach(() => resetTypePresentationForTests())

describe("type presentation registry", () => {
  it("resolves core entries with the previous badge labels and styles", () => {
    const task = resolveTypePresentation("task")
    expect(task.label).toBe("Task")
    expect(task.badge?.className).toContain("amber")
    expect(task.generic).toBe(false)
  })

  it("falls back generically for unknown types — visible, never broken (rule 5)", () => {
    const resolved = resolveTypePresentation("recipe")
    expect(resolved.generic).toBe(true)
    expect(resolved.label).toBe("recipe")
    // The detail slot always exists, so every surface can render the item.
    expect(resolved.detail).toBeTruthy()
    // And the badge shows the raw type via the fallback path.
    const markup = renderToStaticMarkup(createElement(ItemTypeBadge, { type: "recipe", fallback: true }))
    expect(markup).toContain("recipe")
  })

  it("rejects a second entry for an already-presented id — no override in v0.1", () => {
    expect(() => registerTypePresentation("app", [{ id: "task", label: "Aufgabe" }]))
      .toThrow(/bereits in Layer "core"/)
  })

  it("lets the same layer re-register itself (Vite HMR re-executes modules)", () => {
    setTypeManifest(APP_MANIFEST)
    registerTypePresentation("app", [{ id: "sighting", label: "Aussage" }])
    registerTypePresentation("app", [{ id: "sighting", label: "These" }])
    expect(resolveTypePresentation("sighting").label).toBe("These")
  })

  it("still rejects an id owned by ANOTHER layer", () => {
    setTypeManifest(APP_MANIFEST)
    registerTypePresentation("app", [{ id: "sighting", label: "Aussage" }])
    expect(() => registerTypePresentation("space", [{ id: "sighting", label: "X" }]))
      .toThrow(/bereits in Layer "app"/)
  })

  it("extends a presented type additively — a later layer fills an empty footer slot", () => {
    // Extension machinery (spec: Erweiterungsfragment). NOTE: layers are
    // app-scoped for now; per-space isolation is tracked in rls#212.
    const Footer = () => createElement("span", null, "Zusatz-Fußzeile")
    registerTypePresentation("app", { extensions: [{ id: "place", footer: Footer }] })
    expect(resolveTypePresentation("place").footer).toBe(Footer)
    // The base entry stays intact.
    expect(resolveTypePresentation("place").label).toBe("Ort")
  })

  it("rejects a fragment setting a scalar the base already sets", () => {
    const Footer = () => null
    // statement ships a footer (votes, transition rule 17) — a fragment may not shadow it.
    expect(() => registerTypePresentation("app", { extensions: [{ id: "statement", footer: Footer }] }))
      .toThrow(/Basis bereits setzt/)
    // The failed registration leaves no partial layer behind.
    expect(resolveTypePresentation("statement").footer).not.toBe(Footer)
  })

  it("revalidates EXTENSION relationWidgets on manifest rebind (#228)", () => {
    // Valid under the app manifest (sighting declares spottedBy/to)…
    setTypeManifest(APP_MANIFEST)
    registerTypePresentation("app", {
      definitions: [{ id: "sighting", label: "Aussage" }],
      extensions: [{ id: "sighting", relationWidgets: { "spottedBy to": "people" } }],
    })
    // …but a rebind to a manifest without that edge must throw, not leave
    // the orphan widget behind.
    expect(() => setTypeManifest(composeTypeManifest([
      TOOLKIT_TYPE_LAYER,
      { name: "app", definitions: [{ id: "sighting", vocabularies: [] }] },
    ]))).toThrow(/keine Manifest-Kante/)
  })

  it("rejects relationWidgets keys the manifest does not declare", () => {
    // Re-Review Should-Fix: a widget for an edge without authoritative
    // identity is an orphan affordance and must not register.
    setTypeManifest(APP_MANIFEST)
    expect(() =>
      registerTypePresentation("app", [{
        id: "sighting",
        label: "Aussage",
        relationWidgets: { "endorses from": "people" },
      }]),
    ).toThrow(/keine Manifest-Kante/)
  })

  it("shows the type badge in lenses for registered types WITHOUT a preview slot", () => {
    // #220-Review Blocker 1: task/place/statement lost their badge in
    // list/grid because getItemPreviewAdornments returned {} for them.
    const adornments = getItemPreviewAdornments(item("task", { title: "T", status: "open" }))
    const markup = renderToStaticMarkup(createElement("div", null, adornments.headerAdornment))
    expect(markup).toContain("Task")
  })

  it("shows a neutral badge for unknown types even WITHOUT the fallback prop (rule 5)", () => {
    // #220-Review Blocker 2: detail/feed call ItemTypeBadge without
    // `fallback`; an unknown connector type rendered nothing there.
    const markup = renderToStaticMarkup(createElement(ItemTypeBadge, { type: "recipe" }))
    expect(markup).toContain("recipe")
    // A REGISTERED type without badge style (post) still renders nothing —
    // that is a deliberate design decision, not a gap.
    const post = renderToStaticMarkup(createElement("div", null, createElement(ItemTypeBadge, { type: "post" })))
    expect(post).toBe("<div></div>")
  })

  it("lets an app layer present a MANIFEST-known type that then resolves everywhere", () => {
    setTypeManifest(APP_MANIFEST)
    registerTypePresentation("app", [{ id: "sighting", label: "Aussage" }])
    expect(resolveTypePresentation("sighting").label).toBe("Aussage")
    expect(resolveTypePresentation("sighting").generic).toBe(false)
  })

  it("rejects orphan presentation — the register cannot introduce types (rules 1/6)", () => {
    // #220-Review Blocker 3: without manifest binding any id slipped through
    // and resolved with generic:false despite having no identity anywhere.
    expect(() => registerTypePresentation("app", [{ id: "recipe", label: "Rezept" }]))
      .toThrow(/führt keine Typen ein/)
  })

  it("resolves a manifest entry WITHOUT presentation as generic (rule 5)", () => {
    setTypeManifest(APP_MANIFEST)
    // sighting is in the manifest, but no presentation layer registered it.
    const resolved = resolveTypePresentation("sighting")
    expect(resolved.generic).toBe(true)
    expect(resolved.detail).toBeTruthy()
  })

  it("routes getItemPreviewAdornments through the registry (person keeps its profile meta)", () => {
    const adornments = getItemPreviewAdornments(item("person", { displayName: "Ada Lovelace" }))
    const markup = renderToStaticMarkup(createElement("div", null, adornments.metaAdornment))
    expect(markup).toContain("Ada Lovelace")
  })

  // Bis S1 zeigte eine Typ-Fußzeile die Zugewiesenen einer Aufgabe. Sie sind
  // jetzt eine Kante in der Meta-Box (feld-und-kantenregister.test.tsx).
  it("gives the task no footer — assignees live in the meta box since S1", () => {
    expect(renderTypeFooter(item("task", { title: "T" }, [{ predicate: "assignedTo", target: "global:u2" }]))).toBeNull()
  })

  it("returns no footer for types without one", () => {
    expect(renderTypeFooter(item("post"))).toBeNull()
  })
})
