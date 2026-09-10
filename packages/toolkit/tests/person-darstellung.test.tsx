// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { mapLensMarkers } from "../src/components/lens/map-lens"
import { ItemPreview } from "../src/components/preview/item-preview"
import { getItemPreviewAdornments } from "../src/components/preview/item-type-meta"
import {
  resetTypePresentationForTests,
  resolveTypePresentation,
} from "../src/components/preview/type-presentation"

/**
 * Eine Person ist eine Karte wie jede andere (Spec 04 §Profile): Name als
 * Titel, Bio als Inhalt, Ort in der Meta-Zeile, Typ-Badge „Person".
 */
const person = (over: Partial<Item["data"]> = {}): Item => ({
  id: "did:key:anton",
  type: "person",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "did:key:anton",
  data: {
    did: "did:key:anton",
    displayName: "Anton",
    bio: "Baut am Web of Trust.",
    avatarUrl: "/personas/anton.png",
    position: { type: "Point", coordinates: [8.68, 50.11] },
    locationName: "Frankfurt am Main",
    ...over,
  },
})

afterEach(() => resetTypePresentationForTests())

describe("person im Typ-Register", () => {
  it("heißt „Person“ und trägt ein eigenes Badge", () => {
    const resolved = resolveTypePresentation("person")
    expect(resolved.label).toBe("Person")
    expect(resolved.badge).toBeTruthy()
    expect(resolved.generic).toBe(false)
  })

  it("zeigt Badge UND Typ-Zeile auf der Karte", () => {
    const adornments = getItemPreviewAdornments(person())
    const kopf = renderToStaticMarkup(<div>{adornments.headerAdornment}</div>)
    const meta = renderToStaticMarkup(<div>{adornments.metaAdornment}</div>)
    expect(kopf).toContain("Person")
    expect(meta).toContain("Frankfurt am Main")
  })
})

describe("person-Karte ohne Namen — die Live-Vorschau eines leeren Composers", () => {
  it("zerbricht nicht, sondern zeigt eine Karte ohne Kürzel", () => {
    const entwurf = { ...person(), data: { } } as Item
    const adornments = getItemPreviewAdornments(entwurf)
    const meta = renderToStaticMarkup(<div>{adornments.metaAdornment}</div>)
    expect(meta).toContain("?")
  })
})

describe("ItemPreview für person", () => {
  it("nimmt displayName als Titel und bio als Inhalt", () => {
    const html = renderToStaticMarkup(<ItemPreview item={person()} author={null} />)
    expect(html).toContain("Anton")
    expect(html).toContain("Baut am Web of Trust.")
  })

  it("lässt einen Platzhalter ohne did genauso aussehen", () => {
    const platzhalter: Item = {
      id: "item-1",
      type: "person",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user-1",
      data: { displayName: "Oma Erna", bio: "Backt den besten Kuchen." },
    }
    const html = renderToStaticMarkup(<ItemPreview item={platzhalter} author={null} />)
    expect(html).toContain("Oma Erna")
    expect(html).toContain("Backt den besten Kuchen.")
  })

  it("lässt den Titel eines gewöhnlichen Items unangetastet", () => {
    const post: Item = {
      id: "p1",
      type: "post",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
      data: { title: "Repair-Café", content: "Kommt vorbei." },
    }
    const html = renderToStaticMarkup(<ItemPreview item={post} author={null} />)
    expect(html).toContain("Repair-Café")
  })
})

describe("Detail für person", () => {
  it("stellt den Ort in die Meta-Box", () => {
    const detail = resolveTypePresentation("person").detail
    const html = renderToStaticMarkup(<>{detail({ item: person() })}</>)
    expect(html).toContain("Frankfurt am Main")
  })

  it("zeigt ohne Ort keine Meta-Zeile", () => {
    const ohneOrt = person({ position: undefined, locationName: undefined })
    const detail = resolveTypePresentation("person").detail
    const html = renderToStaticMarkup(<>{detail({ item: ohneOrt })}</>)
    expect(html).toBe("")
  })
})

describe("person auf der Karte", () => {
  it("bekommt einen Marker mit ihrem Namen, wenn sie eine Position gesetzt hat", () => {
    const marker = mapLensMarkers([person()])
    expect(marker).toHaveLength(1)
    expect(marker[0]!.position).toEqual([8.68, 50.11])
    expect(marker[0]!.label).toBe("Anton")
  })

  it("bleibt ohne Position von der Karte fern — der Ort ist opt-in", () => {
    expect(mapLensMarkers([person({ position: undefined })])).toEqual([])
  })
})
