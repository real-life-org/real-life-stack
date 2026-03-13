"use client"

import * as React from "react"
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  MapPin,
  Calendar,
  Image,
  Users,
  Hash,
  BarChart3,
  FolderOpen,
} from "lucide-react"
import { Button } from "@/components/primitives/button"
import { Textarea } from "@/components/primitives/textarea"
import { cn } from "@/lib/utils"

type WidgetType =
  | "title"
  | "text"
  | "media"
  | "date"
  | "location"
  | "people"
  | "tags"
  | "status"
  | "group"

const WIDGET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  media: Image,
  date: Calendar,
  location: MapPin,
  people: Users,
  tags: Hash,
  status: BarChart3,
  group: FolderOpen,
}

const WIDGET_LABELS: Record<string, string> = {
  media: "Medien",
  date: "Datum",
  location: "Ort",
  people: "Personen",
  tags: "Tags",
  status: "Status",
  group: "Gruppe",
}

interface TextWidgetProps {
  value: string
  onChange: (value: string) => void
  label: string
  availableWidgets?: WidgetType[]
  onToggleWidget?: (widget: WidgetType) => void
  onMention?: (name: string) => void
  onHashtag?: (tag: string) => void
}

type FormatAction =
  | "bold"
  | "italic"
  | "h1"
  | "h2"
  | "ul"
  | "ol"
  | "quote"
  | "code"

export function TextWidget({
  value,
  onChange,
  label,
  availableWidgets = [],
  onToggleWidget,
  onMention,
  onHashtag,
}: TextWidgetProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const applyFormat = (format: FormatAction) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, selectionEnd, value: text } = textarea
    const selected = text.substring(selectionStart, selectionEnd)
    let before = ""
    let after = ""
    let linePrefix = ""

    switch (format) {
      case "bold":
        before = "**"
        after = "**"
        break
      case "italic":
        before = "*"
        after = "*"
        break
      case "h1":
        linePrefix = "# "
        break
      case "h2":
        linePrefix = "## "
        break
      case "ul":
        linePrefix = "- "
        break
      case "ol":
        linePrefix = "1. "
        break
      case "quote":
        linePrefix = "> "
        break
      case "code":
        if (selected.includes("\n")) {
          before = "```\n"
          after = "\n```"
        } else {
          before = "`"
          after = "`"
        }
        break
    }

    let newValue: string
    let newCursorStart: number
    let newCursorEnd: number

    if (linePrefix) {
      // Line-prefix formats: apply at the start of the line
      const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1
      newValue =
        text.substring(0, lineStart) +
        linePrefix +
        text.substring(lineStart)
      newCursorStart = selectionStart + linePrefix.length
      newCursorEnd = selectionEnd + linePrefix.length
    } else {
      newValue =
        text.substring(0, selectionStart) +
        before +
        selected +
        after +
        text.substring(selectionEnd)
      newCursorStart = selectionStart + before.length
      newCursorEnd = selectionEnd + before.length
    }

    onChange(newValue)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newCursorStart, newCursorEnd)
      textarea.focus()
    })
  }

  const handleTextChange = (newValue: string) => {
    onChange(newValue)

    // Detect @mentions
    if (onMention) {
      const mentionMatch = newValue.match(/@(\w+)\s$/m)
      if (mentionMatch) {
        onMention(mentionMatch[1])
      }
    }

    // Detect #tags
    if (onHashtag) {
      const tagMatch = newValue.match(/#(\w+)\s$/m)
      if (tagMatch) {
        onHashtag(tagMatch[1])
      }
    }
  }

  const formatButtons: { format: FormatAction; icon: React.ComponentType<{ className?: string }>; title: string }[] = [
    { format: "bold", icon: Bold, title: "Fett" },
    { format: "italic", icon: Italic, title: "Kursiv" },
    { format: "h1", icon: Heading1, title: "Ueberschrift 1" },
    { format: "h2", icon: Heading2, title: "Ueberschrift 2" },
    { format: "ul", icon: List, title: "Liste" },
    { format: "ol", icon: ListOrdered, title: "Nummerierte Liste" },
    { format: "quote", icon: Quote, title: "Zitat" },
    { format: "code", icon: Code, title: "Code" },
  ]

  return (
    <div>
      {/* Formatting toolbar (top) */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted/30 px-1 py-0.5">
        {formatButtons.map(({ format, icon: Icon, title }) => (
          <Button
            key={format}
            type="button"
            variant="ghost"
            size="icon-sm"
            title={title}
            onClick={() => applyFormat(format)}
            className="h-7 w-7"
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
      {/* Textarea (middle) */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={label}
        className={cn(
          "min-h-[120px] resize-y rounded-t-none border-t-0",
          availableWidgets.length > 0 && onToggleWidget && "rounded-b-none border-b-0 shadow-none",
        )}
      />
      {/* Widget toggle icons (bottom bar) */}
      {availableWidgets.length > 0 && onToggleWidget && (
        <div className="flex flex-wrap items-center gap-0.5 rounded-b-md border border-t-0 border-input px-1 py-0.5">
          {availableWidgets.map((widgetId) => {
            const Icon = WIDGET_ICONS[widgetId]
            if (!Icon) return null
            return (
              <Button
                key={widgetId}
                type="button"
                variant="ghost"
                size="icon-sm"
                title={WIDGET_LABELS[widgetId]}
                onClick={() => onToggleWidget(widgetId)}
                className="h-7 w-7 text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
