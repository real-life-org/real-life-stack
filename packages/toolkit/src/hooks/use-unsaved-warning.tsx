import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/primitives/dialog"
import { Button } from "../components/primitives/button"

/**
 * Die zwei Hälften des Schutzes vor verlorenen Eingaben, die jede App braucht.
 *
 * Die dritte Hälfte fehlt hier mit Absicht: Das Abfangen der App-internen
 * Navigation hängt am Router, und den kennt das Toolkit nicht (und soll es
 * nicht — sonst müsste jede Anwendung denselben Router nehmen). Die App
 * verdrahtet ihren Blocker und zeigt damit den Dialog von hier.
 */

/**
 * Warnt vor dem harten Verlassen: Neuladen, Tab schließen, externer Link. Ein
 * Router sieht davon nichts, deshalb die eingebaute Rückfrage des Browsers.
 * Nur aktiv, solange wirklich etwas ungespeichert ist.
 */
export function useBeforeUnloadWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])
}

export interface DiscardChangesDialogProps {
  open: boolean
  /** Zurück ins Formular. */
  onKeepEditing: () => void
  /** Weiter, die Eingaben gehen verloren. */
  onDiscard: () => void
}

/** Die Rückfrage, bevor ungespeicherte Eingaben verloren gehen. */
export function DiscardChangesDialog({ open, onKeepEditing, onDiscard }: DiscardChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onKeepEditing() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Änderungen verwerfen?</DialogTitle>
          <DialogDescription>
            Du hast ungespeicherte Änderungen. Wenn du fortfährst, gehen sie verloren.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeepEditing}>Weiter bearbeiten</Button>
          <Button variant="destructive" onClick={onDiscard}>Verwerfen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
