import { beforeEach, describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, type Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { itemToComposerData } from "../src/components/composer/content-types"
import { resolveTypePresentation, setTypeManifest } from "../src/components/preview/type-presentation"

/**
 * Spec 06, Regel 7 (rls#417): An der Eingangsgrenze wird eine bekannte IRI
 * auf ihren Kurznamen normalisiert. Vorher fand `getItems({ type: "post" })`
 * ein mit voller IRI gespeichertes Item, gab es aber roh weiter — die
 * Darstellung war generisch und das Bearbeiten-Formular kam ohne den
 * vorhandenen Text. Der Test geht den ganzen Weg: Connector → Filter →
 * Darstellung → Composer.
 */
const POST_IRI = "https://real-life-stack.org/vocab/base/v1#Post"
const FREMD = "https://example.org/ns#Widget"

const seed = (items: Item[]) =>
  new MockConnector({ items, groups: [], users: [], groupMembers: {} }, { allowFixtureAuthors: true })

beforeEach(() => setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER])))

describe("Klassen an der Eingangsgrenze", () => {
  const roh: Item = {
    id: "p1", type: POST_IRI, createdAt: "2026-09-21T10:00:00.000Z", createdBy: "u1",
    data: { content: "Vorhandener Text" },
  }

  it("der Connector gibt ein mit IRI gespeichertes Item kanonisch weiter", async () => {
    const [gefunden] = await seed([roh]).getItems({ type: "post" })
    expect(gefunden?.type).toBe("post")
    expect(gefunden?.data.content).toBe("Vorhandener Text")
  })

  it("Darstellung und Composer-Vorbelegung folgen dem gefundenen Item", async () => {
    const [gefunden] = await seed([roh]).getItems({ type: "post" })
    expect(resolveTypePresentation(gefunden!.type).generic).toBe(false)
    expect(itemToComposerData(gefunden!).text).toBe("Vorhandener Text")
  })

  it("auch ein rohes IRI-Item findet Darstellung und Vorlage (zweite Verteidigungslinie)", () => {
    expect(resolveTypePresentation(POST_IRI).generic).toBe(false)
    expect(resolveTypePresentation(POST_IRI).id).toBe("post")
    expect(itemToComposerData(roh).text).toBe("Vorhandener Text")
  })

  it("eine fremde Klasse bleibt erhalten und generisch (Regel 7, 10)", async () => {
    const fremd: Item = { ...roh, id: "w1", type: FREMD }
    const [gefunden] = await seed([fremd]).getItems()
    expect(gefunden?.type).toBe(FREMD)
    expect(resolveTypePresentation(gefunden!.type).generic).toBe(true)
  })
})

describe("Klassenmengen: nichts geht am Connector verloren (Codex zu rls#417)", () => {
  const STATEMENT_IRI = "https://real-life-stack.org/vocab/statement/v1#Statement"
  const mehrklassig: Item = {
    id: "m1", type: ["post", STATEMENT_IRI, FREMD] as unknown as string,
    createdAt: "2026-09-21T10:00:00.000Z", createdBy: "u1", data: { content: "Beides" },
  }

  it("ein Item mit mehreren Klassen erscheint in der Resonanz UND behaelt die fremde Klasse", async () => {
    const c = seed([mehrklassig])
    const [inResonanz] = await c.getItems({ type: ["statement"] })
    expect(inResonanz?.id).toBe("m1")
    expect(inResonanz?.type).toEqual(["post", "statement", FREMD])
    const [alsPost] = await c.getItems({ type: "post" })
    expect(alsPost?.id).toBe("m1")
  })

  it("Darstellung und Composer nehmen die erste Klasse mit Vorlage (Regel 9)", () => {
    expect(resolveTypePresentation(mehrklassig.type).id).toBe("post")
    expect(itemToComposerData(mehrklassig).text).toBe("Beides")
  })
})
