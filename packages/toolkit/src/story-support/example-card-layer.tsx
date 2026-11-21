import { useEffect, type ReactNode } from "react"
import { Layers } from "lucide-react"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, type TypeManifestLayer } from "@real-life/data-interface"

import type { EdgeEntry } from "../components/preview/field-register"
import { registerTypePresentation, setTypeManifest } from "../components/preview/type-presentation"

/**
 * Beispiel einer App-Schicht mit gegliederter Rückwärts-Liste (Spec 06,
 * Regel 22): Karten gehören zu einem Projekt (`partOf`), die Liste „Karten"
 * steht am Projekt, gegliedert nach einem Feld der Karte und mit einem Zusatz
 * rechts in der Zeile. So etwa sieht die Liste am Karabirrdt-Ziel aus (nicht
 * in diesem Repo). Für Stories; nicht Teil des Kerns.
 */
const MANIFEST_LAYER: TypeManifestLayer = {
  name: "beispiel-karten",
  definitions: [{ id: "card", vocabularies: [], relations: [{ predicate: "partOf", itemRole: "from", otherKind: "project" }] }],
  extensions: [{ id: "project", relations: [{ predicate: "partOf", itemRole: "to", otherKind: "card" }] }],
}

const TOOLKIT_ONLY = composeTypeManifest([TOOLKIT_TYPE_LAYER])
const WITH_CARDS = composeTypeManifest([TOOLKIT_TYPE_LAYER, MANIFEST_LAYER])

function registerCards(list: NonNullable<EdgeEntry["list"]>) {
  setTypeManifest(WITH_CARDS)
  registerTypePresentation("beispiel-karten", {
    definitions: [
      {
        id: "card",
        label: "Karte",
        badge: { icon: Layers, className: "bg-orange-50 text-orange-700 border-orange-200" },
        fields: [
          { key: "title", widget: "title", pos: "head" },
          // Die Stufe eines Bretts: Position im Modul, nie im Formular (Regel 4).
          { key: "stage", widget: "number", pos: "module", label: "Stufe", edit: false },
          {
            key: "state",
            widget: "status",
            pos: "meta",
            label: "Zustand",
            options: [
              { id: "open", label: "Offen", role: "open" },
              { id: "doing", label: "Dran", role: "active" },
              { id: "done", label: "Fertig", role: "done" },
            ],
          },
        ],
      },
    ],
    extensions: [
      {
        id: "project",
        fields: [{ key: "title", widget: "title", pos: "head" }],
        edges: [{ predicate: "partOf", itemRole: "to", storage: "embedded", widget: "item-relation", pos: "list", label: "Karten", list }],
      },
    ],
  })
}

/**
 * Registriert die Beispiel-Schicht nur, solange die Story zu sehen ist, und
 * räumt beim Verlassen erst die eigene Schicht, dann das Manifest wieder ab
 * (Register und Manifest sind modul-global).
 */
export function WithExampleCardLayer({ list, children }: { list: NonNullable<EdgeEntry["list"]>; children: ReactNode }) {
  // Wie `WithExampleLayer`: bei jedem Render registrieren (dieselbe Schicht
  // ersetzt sich selbst), beim Verlassen abräumen.
  registerCards(list)
  useEffect(
    () => () => {
      registerTypePresentation("beispiel-karten", {})
      setTypeManifest(TOOLKIT_ONLY)
    },
    [],
  )
  return <>{children}</>
}
