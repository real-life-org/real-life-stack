import { beforeEach, describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, setTypeManifest } from "@real-life-stack/data-interface"

import { editTemplateFor } from "../src/components/detail/item-detail-view"

/**
 * Die Detailansicht sperrt den Editor auf die Vorlage des Items. Sie verglich
 * den Typ-String mit der Liste — ein Item mit Klassenmenge `["post",
 * "statement"]` hatte darum keinen Bearbeiten-Knopf (Codex zu rls#417).
 */
const TYPES = [{ id: "post" }, { id: "event" }, { id: "statement" }]
const POST_IRI = "https://real-life-stack.org/vocab/base/v1#Post"

beforeEach(() => setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER])))

describe("editTemplateFor", () => {
  it("findet bei einer Klassenmenge die erste mit Vorlage", () => {
    expect(editTemplateFor({ type: ["post", "statement"] as unknown as string }, TYPES)).toBe("post")
    expect(editTemplateFor({ type: ["https://example.org/ns#X", "statement"] as unknown as string }, TYPES)).toBe("statement")
  })
  it("findet eine bekannte IRI ueber ihren Kurznamen", () => {
    expect(editTemplateFor({ type: POST_IRI }, TYPES)).toBe("post")
  })
  it("bietet ohne Vorlage kein Bearbeiten an", () => {
    expect(editTemplateFor({ type: "https://example.org/ns#X" }, TYPES)).toBeUndefined()
  })
})
