// @vitest-environment jsdom
import { act, createElement, createRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GraphView } from "../src/components/graph/graph-view"
import type { GraphEdge, GraphNode, GraphViewHandle } from "../src/components/graph/types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Greift der Nutzer zur Kamera, endet jede automatische Fahrt — die laufende
 * Fit-Fahrt, das Folgen waehrend des Ordnens UND der Fit beim Einrasten.
 * Sonst schreibt das naechste Bild seine Eingabe wieder um (Codex zu #420,
 * rls#421). Echte GraphView in jsdom, Bilder von Hand getaktet, Canvas gemockt.
 */
const nodes: GraphNode[] = [
  { id: "a", label: "A", type: "project" }, { id: "b", label: "B", type: "project" }, { id: "c", label: "C", type: "person" },
]
const edges: GraphEdge[] = [{ id: "e", sourceId: "a", targetId: "b", predicate: "connectedWith" }]

let host: HTMLDivElement
let root: Root
let frames: FrameRequestCallback[] = []
let jetzt = 0

const kontext = new Proxy({}, {
  get: (_t, prop) => (prop === "measureText" ? () => ({ width: 10 }) : prop === "canvas" ? undefined : () => undefined),
  set: () => true,
}) as unknown as CanvasRenderingContext2D

function bild(n = 1) {
  for (let i = 0; i < n; i += 1) {
    const faellig = frames; frames = []
    jetzt += 16
    act(() => { for (const f of faellig) f(jetzt) })
  }
}

beforeEach(() => {
  frames = []; jetzt = 0
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal("cancelAnimationFrame", () => undefined)
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} })
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }))
  vi.spyOn(performance, "now").mockImplementation(() => jetzt)
  // jsdom kennt keine Zeigerereignisse: ein Mausereignis mit pointerId genuegt React.
  if (typeof globalThis.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0 }
    }
    vi.stubGlobal("PointerEvent", PointerEventPolyfill)
  }
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLCanvasElement.prototype.getContext = (() => kontext) as unknown as typeof HTMLCanvasElement.prototype.getContext
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true, value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  })
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function rendere() {
  const ref = createRef<GraphViewHandle>()
  act(() => { root.render(createElement(GraphView, { ref, nodes, edges, selectedNodeId: null, onSelectedNodeChange: () => undefined })) })
  bild(3)
  return ref
}

const canvas = () => host.querySelector("canvas")!

describe("Der Nutzer greift zur Kamera", () => {
  it("Rad-Zoom waehrend einer Fit-Fahrt bleibt bestehen", () => {
    const ref = rendere()
    act(() => ref.current!.fitView())
    bild(2)
    const vorher = ref.current!.getCamera().zoom
    act(() => { canvas().dispatchEvent(new WheelEvent("wheel", { deltaY: -100, clientX: 400, clientY: 300, bubbles: true, cancelable: true })) })
    const nachRad = ref.current!.getCamera().zoom
    expect(nachRad).toBeGreaterThan(vorher)
    bild(5)
    expect(ref.current!.getCamera().zoom).toBeCloseTo(nachRad, 6)
  })

  it("Ziehen waehrend des Ordnens bleibt bestehen — kein Fit beim Einrasten schreibt es um", () => {
    const ref = rendere()
    const c = canvas()
    act(() => {
      c.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, clientX: 400, clientY: 300, bubbles: true }))
      c.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 300, clientY: 300, bubbles: true }))
      c.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 300, clientY: 300, bubbles: true }))
    })
    const nachZug = ref.current!.getCamera()
    // Bis weit nach dem Einrasten (alpha unter 0.004 nach rund 600 Bildern).
    bild(800)
    expect(ref.current!.getCamera()).toEqual(nachZug)
  })
})
