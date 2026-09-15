"use client"

import * as React from "react"
import { Extension, useEditor, EditorContent, type Editor } from "@tiptap/react"
import { Node as ProseMirrorNode, Slice } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import { Placeholder } from "@tiptap/extensions"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Markdown } from "@tiptap/markdown"
import { cn } from "@/lib/utils"

export interface TiptapEditorHandle {
  editor: ReturnType<typeof useEditor>
}

interface TiptapEditorProps {
  value: string
  /** The user changed the text. */
  onChange: (md: string) => void
  /**
   * The same text in the spelling this editor writes — nobody typed anything.
   *
   * Separate from {@link TiptapEditorProps.onChange} because a consumer may
   * read input as a gesture: a trailing `#garten` adds a tag, an `@name` a
   * person. Opening an item must not re-enact what its text once triggered.
   */
  onNormalise: (md: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

/**
 * Pasted plain text is read as Markdown.
 *
 * `@tiptap/markdown` reads Markdown into the editor and writes it back out,
 * but it leaves the clipboard alone: pasted text arrives as literal
 * characters, so `![](…)` landed as the visible string `!\[\]…` with the URL
 * autolinked beside it. Text copied out of a Markdown document is Markdown,
 * and the editor already knows how to read it.
 *
 * A paste held down with Shift asks for the literal characters and is left
 * alone, and so is text the parser makes nothing of — ProseMirror's own
 * handling is the better answer there than an empty selection.
 */
const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const { editor } = this

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          clipboardTextParser: (text, _context, plainText) => {
            if (plainText) return null as unknown as Slice

            try {
              const json = editor.storage.markdown.manager.parse(text)
              if (!json.content?.length) return null as unknown as Slice

              return Slice.maxOpen(ProseMirrorNode.fromJSON(editor.schema, json).content)
            } catch {
              return null as unknown as Slice
            }
          },
        },
      }),
    ]
  },
})

/**
 * The document as Markdown.
 *
 * The serializer frames blocks with blank lines — one after a list, a heading
 * or a fence, one before a table. Left in, a stored text would differ from its
 * own round trip, and every item would be rewritten and synced the first time
 * it is opened.
 *
 * Only those blank lines go. `trimEnd()` would also eat the two spaces that
 * carry a hard break at the end of the document, turning a line the user broke
 * on purpose into ordinary text.
 */
function markdownOf(editor: Editor): string {
  return editor.getMarkdown().replace(/^\n+/, "").replace(/\n{2,}$/, "")
}

/**
 * Whether rewriting `before` as `after` would change the document itself and
 * not just its spelling.
 *
 * `marked` reads every construct the preview renders; the editor only holds
 * what it has an extension for, and drops the rest without a word. Rewriting a
 * stored text the user has not touched must never cost content, so both
 * readings are compared as `marked` sees them: raw HTML turned into Markdown
 * reads the same and may be written back, a construct the editor swallowed
 * does not, and that text is left alone.
 *
 * Deliberately not `manager.parse()`, which is how the editor itself reads
 * Markdown — exactly the step that loses the construct. Two texts that both
 * parse to an empty document would look equal, and normalising would replace
 * the stored text with "".
 */
function readsTheSame(editor: Editor, before: string, after: string): boolean {
  const { instance } = editor.storage.markdown.manager
  const render = (markdown: string) =>
    (instance.parse(markdown, { async: false }) as string).replace(/\s+/g, " ").trim()
  return render(before) === render(after)
}

export const TiptapEditor = React.forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor({ value, onChange, onNormalise, placeholder, autoFocus, className }, ref) {
    // Both callbacks are fresh closures on every render, but the editor
    // callbacks below are created once — so they read them through a ref.
    const callbacks = React.useRef({ onChange, onNormalise })
    React.useEffect(() => {
      callbacks.current = { onChange, onNormalise }
    })

    // The label follows the chosen content type, and the editor stays mounted
    // across that change — so the extension below reads it when it renders,
    // not when it was configured.
    const label = React.useRef(placeholder)
    React.useEffect(() => {
      label.current = placeholder
    })

    // The Markdown the editor currently holds. Lets the sync effect tell "the
    // parent echoed our own text back" from "the text changed elsewhere"
    // without re-serialising the document on every keystroke.
    const editorText = React.useRef<string | null>(null)

    /**
     * Serialise, remember, and hand the Markdown up if it differs from what
     * came in.
     *
     * Text the editor never wrote itself — pasted markup, an import, an older
     * client — is normalised here, on open, instead of only when the user
     * happens to type. Without it the stored text and the rendered detail view
     * could disagree for good: raw HTML looks correct inside the editor (the
     * Markdown parser renders it) but the preview shows it as literal tags,
     * and re-saving kept writing the same string back. Inserting a single
     * space used to be the only way out.
     *
     * Nothing is handed up that would cost the user content — see
     * {@link readsTheSame}. Such a text stays authoritative as it is, so that
     * merely opening an item can never reduce it.
     */
    const publish = (editor: Editor, incoming: string) => {
      const md = markdownOf(editor)

      if (md !== incoming && readsTheSame(editor, incoming, md)) {
        editorText.current = md
        callbacks.current.onNormalise(md)
        return
      }

      editorText.current = incoming
    }

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // The toolbar offers two levels, the schema holds all six. A heading
          // outside `levels` keeps its level in the document but renders as
          // `levels[0]` — so an imported `###` looked like an h1 while being
          // written back as h3.
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          // Standard Markdown has no underline: Ctrl+U used to write a `<u>`
          // tag, and now writes `++text++`. The preview renders neither, so
          // both reach the reader as visible punctuation.
          underline: false,
        }),
        // `![](…)` is Markdown the preview renders, so the editor has to hold
        // it: without an image node the picture was dropped on paste and on
        // the next keystroke in an item that had one. Inline, like the
        // Markdown it is written as; base64 because the media widget produces
        // resized data URIs.
        Image.configure({ inline: true, allowBase64: true }),
        // Tables and checklists are Markdown the preview renders, and both
        // read and write themselves. Without them a table between two
        // paragraphs was dropped from the document on open — whole, not just
        // its formatting — and a checklist lost its boxes.
        Table,
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem,
        Markdown,
        MarkdownPaste,
        // The stylesheet has always styled `p.is-editor-empty::before` with
        // the label — but that class and the attribute it reads come from
        // this extension, which was never registered. The visual editor sat
        // there without its label; only the source-mode textarea showed one,
        // through its own `placeholder` attribute.
        Placeholder.configure({ placeholder: () => label.current ?? "" }),
      ],
      autofocus: autoFocus ? "end" : false,
      content: value,
      contentType: "markdown",
      onCreate({ editor }) {
        publish(editor, value)
      },
      onUpdate({ editor }) {
        const md = markdownOf(editor)
        editorText.current = md
        callbacks.current.onChange(md)
      },
    })

    React.useImperativeHandle(ref, () => ({ editor }), [editor])

    // Sync external value changes into the editor.
    React.useEffect(() => {
      if (!editor || editor.isDestroyed) return

      // Our own text on its way back through the parent — pushing it in again
      // would only reset the cursor.
      if (value === editorText.current) return

      editor.commands.setContent(value, { emitUpdate: false, contentType: "markdown" })
      publish(editor, value)
    }, [value, editor])

    return (
      <EditorContent editor={editor} className={cn("tiptap-editor", className)} />
    )
  },
)
