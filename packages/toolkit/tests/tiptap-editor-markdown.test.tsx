// @vitest-environment jsdom
import { act, createElement, createRef } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { TiptapEditor, type TiptapEditorHandle } from "../src/components/composer/widgets/tiptap-editor"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom has neither ClipboardEvent nor DataTransfer. prosemirror-view reads
// the two clipboard flavours off the event and decides from there, so a stub
// that answers `getData` is enough to drive the real paste path — including
// the plain-text branch, which `view.pasteText()` would skip.
class FakeClipboardEvent extends Event {
  clipboardData: unknown = null
}
;(globalThis as unknown as { ClipboardEvent: unknown }).ClipboardEvent = FakeClipboardEvent

function paste(editor: { view: { dom: HTMLElement } }, data: { text?: string; html?: string }) {
  const event = new FakeClipboardEvent("paste", { bubbles: true, cancelable: true })
  event.clipboardData = {
    types: Object.keys(data),
    getData: (type: string) => {
      if (type === "text/html") return data.html ?? ""
      if (type === "text/plain") return data.text ?? ""
      // Other flavours (e.g. the editor-private one the code block reads) are
      // simply not on this clipboard.
      return ""
    },
  }
  editor.view.dom.dispatchEvent(event as unknown as Event)
}

/** Mounts the editor and records both channels it reports through. */
async function mount(value: string) {
  const host = document.createElement("div")
  document.body.append(host)
  const changed: string[] = []
  const normalised: string[] = []
  const ref = createRef<TiptapEditorHandle>()
  await act(async () => {
    createRoot(host).render(
      createElement(TiptapEditor, {
        ref,
        value,
        onChange: (md) => changed.push(md),
        onNormalise: (md) => normalised.push(md),
      }),
    )
  })
  return { changed, normalised, editor: ref.current!.editor! }
}

describe("TiptapEditor markdown contract", () => {
  it("normalises raw HTML into Markdown when the item is opened", async () => {
    // What a detail view would otherwise show as literal tags.
    const { changed, normalised } = await mount("<p>Ein <strong>fetter</strong> Absatz.</p>")

    expect(normalised).toEqual(["Ein **fetter** Absatz."])
    // Nobody typed — a consumer that reads input as a gesture must not hear it.
    expect(changed).toEqual([])
  })

  // The editor understands less Markdown than the preview renders. Opening an
  // item must never be the moment its content shrinks — the normalisation
  // above stays out of the way where it cannot round-trip.
  it.each([
    ["an image", "![Karte vom Treffpunkt](https://example.org/karte.png)"],
    ["a heading below h2", "### Dritte Ebene\n\nText."],
    ["a table", "| a | b |\n|---|---|\n| 1 | 2 |"],
  ])("does not rewrite %s it cannot express", async (_what, value) => {
    const { changed, normalised } = await mount(value)

    expect([...changed, ...normalised]).toEqual([])
  })

  it("leaves text that is already Markdown alone", async () => {
    const { changed, normalised } = await mount("# Titel\n\nEin **fetter** Absatz.\n\n- eins\n- zwei")

    expect([...changed, ...normalised]).toEqual([])
  })

  it("never stores HTML tags for emphasis that Markdown cannot express", async () => {
    const { changed, editor } = await mount("")

    await act(async () => {
      paste(editor, { html: "<p>Text mit <u>unterstrichen</u> und <s>durchgestrichen</s>.</p>" })
    })

    expect(changed.at(-1)).toBe("Text mit unterstrichen und ~~durchgestrichen~~.")
  })

  it("keeps pasted Markdown source as Markdown", async () => {
    const { changed, editor } = await mount("")

    await act(async () => {
      paste(editor, { text: "## Titel\n\nEin **fetter** Absatz." })
    })

    expect(changed.at(-1)).toBe("## Titel\n\nEin **fetter** Absatz.")
  })

  // The preview renders standard Markdown and nothing else. A mark the
  // serializer can only write as a raw tag (`<u>`) or as a non-standard
  // extension (`++text++`) reaches the reader as visible punctuation, so the
  // set of marks is spelled out here: adding one has to be a decision.
  it("carries only marks the preview can render", async () => {
    const { editor } = await mount("")

    expect(Object.keys(editor.schema.marks).sort()).toEqual(["bold", "code", "italic", "link", "strike"])
  })

  it("writes no mark as raw HTML", async () => {
    const { editor } = await mount("")
    const markdown = editor.storage.markdown.manager

    for (const type of Object.values(editor.schema.marks)) {
      // A link without a target cannot be written in any syntax.
      const attrs = type.spec.attrs?.href ? { href: "https://example.org" } : undefined
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Wort", marks: [{ type: type.name, attrs }] }] },
        ],
      }

      expect(markdown.serialize(doc), `mark "${type.name}"`).not.toMatch(/<[a-z/]/i)
    }
  })
})
