"use client"

import * as React from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
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
 * The document as Markdown.
 *
 * Trailing blank lines are dropped: the serializer closes every block with
 * one, so without this a stored text would differ from its own round trip and
 * every item would be rewritten — and synced — the first time it is opened.
 */
function markdownOf(editor: Editor): string {
  return editor.getMarkdown().trimEnd()
}

/**
 * Whether rewriting `before` as `after` would change the document itself and
 * not just its spelling.
 *
 * The editor understands less Markdown than the preview renders: a table
 * survives the round trip through its schema only as its text. Rewriting a
 * stored text the user has not touched must never cost content, so both
 * readings are rendered by `marked` — which knows every construct the preview
 * knows — and compared. Raw HTML turned into Markdown reads the same and may
 * be written back; a flattened table does not, and is left alone.
 *
 * Deliberately not `manager.parse()`: that builds the document through the
 * editor's own registry, where a table collapses to nothing at all. Two texts
 * that both parse to an empty document would look equal, and normalising would
 * then replace the stored table with "".
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
          heading: { levels: [1, 2] },
          // Standard Markdown has no underline: Ctrl+U used to write a `<u>`
          // tag, and now writes `++text++`. The preview renders neither, so
          // both reach the reader as visible punctuation.
          underline: false,
        }),
        Markdown,
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
      <EditorContent
        editor={editor}
        className={cn("tiptap-editor", className)}
        data-placeholder={placeholder}
      />
    )
  },
)
