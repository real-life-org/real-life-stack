"use client"

import * as React from "react"
import { ImagePlus, Send } from "lucide-react"

import { Button } from "@/components/primitives/button"
import { Card, CardContent, CardFooter } from "@/components/primitives/card"
import { Textarea } from "@/components/primitives/textarea"
import { cn } from "@/lib/utils"

interface SimplePostWidgetProps {
  placeholder?: string
  onSubmit?: (content: string, attachments?: File[]) => void
  /** Click handler — when set, the widget acts as a trigger (e.g. to open ContentComposer) */
  onClick?: () => void
  className?: string
  disabled?: boolean
}

/**
 * @deprecated Gehört zu `PostCard` und hat wie diese keinen Aufrufer mehr. Entfernung mit der nächsten Minor.
 */
export function SimplePostWidget({
  placeholder = "Was gibt's Neues?",
  onSubmit,
  onClick,
  className,
  disabled = false,
}: SimplePostWidgetProps) {
  const [content, setContent] = React.useState("")
  const [attachments, setAttachments] = React.useState<File[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (!content.trim() && attachments.length === 0) return

    onSubmit?.(content, attachments)
    setContent("")
    setAttachments([])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [...prev, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const canSubmit = content.trim().length > 0 || attachments.length > 0

  // Trigger mode: clicking anywhere opens the composer
  if (onClick) {
    return (
      <Card
        className={cn("w-full cursor-pointer", className)}
        onClick={onClick}
      >
        <CardContent className="pt-4">
          <div className="min-h-[40px] text-muted-foreground">{placeholder}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="pt-4">
        <Textarea
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={disabled}
          className="min-h-[80px] resize-none border-0 p-0 focus-visible:ring-0"
        />
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
              >
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-3">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <ImagePlus className="h-4 w-4" />
            <span className="sr-only">Bild hinzufügen</span>
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || !canSubmit}
        >
          <Send className="mr-2 h-4 w-4" />
          Posten
        </Button>
      </CardFooter>
    </Card>
  )
}
