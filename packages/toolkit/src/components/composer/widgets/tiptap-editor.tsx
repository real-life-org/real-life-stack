"use client"

import * as React from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "tiptap-markdown"
import { cn } from "@/lib/utils"

export interface TiptapEditorHandle {
  editor: ReturnType<typeof useEditor>
}

interface TiptapEditorProps {
  value: string
  onChange: (md: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

function getMarkdown(editor: Editor): string {
  return (editor.storage as Record<string, any>).markdown.getMarkdown() as string
}

/**
 * Whether rewriting `before` as `after` would change the document itself and
 * not just its spelling.
 *
 * The editor understands less Markdown than the preview renders: an image or
 * an `###` heading survives the round trip through its schema only as text.
 * Rewriting a stored text the user has not touched must never cost content,
 * so both readings are rendered through the editor's own parser and compared.
 * Raw HTML turned into Markdown reads identically and may be written back; a
 * dropped image does not and is left alone.
 */
function readsTheSame(editor: Editor, before: string, after: string): boolean {
  const { parser } = (editor.storage as Record<string, any>).markdown
  return parser.parse(before) === parser.parse(after)
}

export const TiptapEditor = React.forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor({ value, onChange, placeholder, autoFocus, className }, ref) {
    // `onChange` is a fresh closure on every render, but the editor callbacks
    // below are created once — so they read it through a ref.
    const onChangeRef = React.useRef(onChange)
    React.useEffect(() => {
      onChangeRef.current = onChange
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
      const md = getMarkdown(editor)

      if (md !== incoming && readsTheSame(editor, incoming, md)) {
        editorText.current = md
        onChangeRef.current(md)
        return
      }

      editorText.current = incoming
    }

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2] },
          // Markdown has no underline. Left on, Ctrl+U wrote a `<u>` tag that
          // the serializer can only keep as raw HTML — invisible in the
          // editor, literal tags in the detail view.
          underline: false,
        }),
        // Pasted plain text is Markdown, and is parsed as such: otherwise a
        // pasted document arrived escaped ("\## Titel") with its structure
        // gone.
        Markdown.configure({ transformPastedText: true }),
      ],
      autofocus: autoFocus ? "end" : false,
      content: value,
      onCreate({ editor }) {
        publish(editor, value)
      },
      onUpdate({ editor }) {
        const md = getMarkdown(editor)
        editorText.current = md
        onChangeRef.current(md)
      },
    })

    React.useImperativeHandle(ref, () => ({ editor }), [editor])

    // Sync external value changes into the editor.
    React.useEffect(() => {
      if (!editor || editor.isDestroyed) return

      // Our own text on its way back through the parent — pushing it in again
      // would only reset the cursor.
      if (value === editorText.current) return

      editor.commands.setContent(value, { emitUpdate: false })
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
