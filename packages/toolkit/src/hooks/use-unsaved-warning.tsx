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
 * Die dritte Hälfte — das Abfangen der App-internen Navigation — hängt am
 * Router und liegt darum im Unterpfad `/router` (`UnsavedChangesGuard`), wie
 * der Fokus in der URL. Bis zum 21.09.2026 verdrahtete jede App sie selbst;
 * die Netzwerk-App hatte sie darum nicht (rls#429).
 */

/**
 * Warn the browser before a reload or tab close while something is unsaved.
 *
 * Warnt vor dem harten Verlassen: Neuladen, Tab schließen, externer Link. Ein
 * Router sieht davon nichts, deshalb die eingebaute Rückfrage des Browsers.
 * Nur aktiv, solange wirklich etwas ungespeichert ist.
 *
 * @answers `void`
 * @without —
 * @group write
 * @see story rls-foundations-hooks--write
 * @see spec docs/spec/02-data-interface.md
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
