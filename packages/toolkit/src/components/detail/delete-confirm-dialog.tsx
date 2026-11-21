"use client"

import { useState } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog"
import { Button } from "../primitives/button"
import { useI18n } from "@/i18n"

export interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Title/name of the item, shown in the prompt. Omitted → generic copy. */
  title?: string
  /** Performs the deletion. The dialog shows a busy state until it resolves,
   *  then closes itself. */
  onConfirm: () => void | Promise<void>
}

/** Confirm-before-delete dialog for an item. UX affordance only — the actual
 *  permission to delete is gated upstream (see `ItemDetailActions`). */
export function DeleteConfirmDialog({ open, onOpenChange, title, onConfirm }: DeleteConfirmDialogProps) {
  const { t } = useI18n()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scheitert das Löschen, bleibt der Dialog offen und nennt den Fehler; man
  // kann es erneut versuchen. Die Ablehnung entweicht nicht aus dem Klick.
  const handleConfirm = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("delete.failed"))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("delete.title")}</DialogTitle>
          <DialogDescription>
            {title ? t("delete.named", { title }) : t("delete.unnamed")} {t("delete.irreversible")}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("delete.failedWith", { error })}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? t("delete.deleting") : t("detail.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
