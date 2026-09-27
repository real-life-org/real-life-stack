import type { TypePresentationFragment } from "../components/preview/type-presentation"

/**
 * Beispiel einer Register-Schicht, die ihr Vokabular mitbringt (Spec 06,
 * Regel 20): Werte `can`/`learns` für `assignedTo.role` an der Aufgabe, mit
 * Anzeige („kann", „lernt") und eigenen Pills („Kann ich · Will lernen"). So
 * etwa bringt die Karabirrdt-App (nicht in diesem Repo) ihre Bedeutung und
 * Bedienung mit. Für Stories und Tests; nicht Teil des Kerns.
 */
export const EXAMPLE_LEARNING_LAYER: TypePresentationFragment = {
  id: "task",
  qualifierValues: [
    {
      predicate: "assignedTo",
      itemRole: "from",
      values: [
        { id: "can", label: "kann", action: "Kann ich" },
        { id: "learns", label: "lernt", action: "Will lernen" },
      ],
    },
  ],
  selfActions: [
    {
      predicate: "assignedTo",
      itemRole: "from",
      selfAction: {
        label: "Kann ich",
        mine: "Dabei",
        qualifiers: ["can", "learns"],
        followUps: { field: "status", complete: { label: "Erledigt" }, release: "Nicht mehr dabei" },
      },
    },
  ],
}
