// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import { TextWidget } from "../src/components/composer/widgets/text-widget"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * The composer reads a trailing `#tag` or `@name` in the text as a gesture and
 * fills the tag and people widgets from it. Restating stored text must not
 * look like that gesture — otherwise opening an item edits fields nobody
 * touched.
 */
async function mount(value: string) {
  const host = document.createElement("div")
  document.body.append(host)
  const onHashtag = vi.fn()
  const onMention = vi.fn()
  const onChange = vi.fn()
  let root!: Root
  const render = async (text: string) => {
    await act(async () => {
      root = root ?? createRoot(host)
      root.render(
        createElement(TextWidget, { value: text, onChange, label: "Text", onHashtag, onMention }),
      )
    })
  }
  await render(value)
  return { host, onHashtag, onMention, onChange, render }
}

function click(host: HTMLElement, title: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.title === title)
  button!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

function type(host: HTMLElement, text: string) {
  const textarea = host.querySelector("textarea")!
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!
  setValue.call(textarea, text)
  textarea.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("TextWidget: input vs. normalisation", () => {
  it("does not read stored text as a gesture when the item is opened", async () => {
    const { onHashtag, onMention } = await mount("<p>#garten</p><p>@anton</p><p>Weiter</p>")

    expect(onHashtag).not.toHaveBeenCalled()
    expect(onMention).not.toHaveBeenCalled()
  })

  it("does not read a value that changed elsewhere as a gesture", async () => {
    const { render, onHashtag, onMention } = await mount("Text.")

    await render("<p>#garten</p><p>@anton</p><p>Weiter</p>")

    expect(onHashtag).not.toHaveBeenCalled()
    expect(onMention).not.toHaveBeenCalled()
  })

  it("still reads a tag the user types", async () => {
    const { host, onHashtag } = await mount("")

    await act(async () => {
      click(host, "Quelltext")
    })
    await act(async () => {
      type(host, "Der Beitrag #garten ")
    })

    expect(onHashtag).toHaveBeenCalledWith("garten")
  })
})
