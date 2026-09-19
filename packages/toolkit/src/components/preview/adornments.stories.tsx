import type { Meta, StoryObj } from "@storybook/react-vite"
import { ItemTypeBadge } from "./item-type-badge"
import { ItemGroupBadge } from "./item-group-badge"
import { ItemPrivateBadge } from "./item-private-badge"
import { ItemScopeBadge } from "./item-scope-badge"
import { ItemCommentCount } from "./item-comment-count"
import { ItemMetaRow } from "./item-meta-row"
import { ItemPreviewSkeleton } from "./item-preview-skeleton"
import { ItemPreview } from "./item-preview"
import { STORY_EVENT, STORY_ME, STORY_POST, STORY_TASK, StoryWorld } from "../../story-support/story-world"

/**
 * **Die Beigaben der Item-Vorschau.**
 *
 * `ItemPreview` selbst weiß nichts über Typen, Spaces oder Gespräche. Sie hat
 * drei Steckplätze, und was dort steht, entscheidet die Fläche: das Typ-Zeichen
 * neben dem Urheber, die Fakten unter dem Titel, und unten die Fußzeile mit
 * Zuweisungen, Reaktionen und dem Kommentar-Hinweis. Deshalb sieht dieselbe Karte im Feed, auf der Karte und im Kanban
 * verschieden aus, ohne dass es drei Karten gäbe.
 *
 * Alle Beigaben sind einzeln benutzbar, auch außerhalb einer Karte.
 */

const meta: Meta = {
  id: "rls-items-beigaben",
  title: "RLS/Items/Item-Vorschau/Beigaben",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj

function Reihe({ titel, erklaerung, children }: { titel: string; erklaerung: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-4 last:border-b-0">
      <p className="text-sm font-medium">{titel}</p>
      <p className="mb-3 text-xs text-muted-foreground">{erklaerung}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

/** Alle Beigaben nebeneinander, mit dem Satz, den jede beantwortet. */
export const Alle: Story = {
  name: "Alle Beigaben",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <Reihe titel="ItemTypeBadge" erklaerung={'Was für ein Ding ist das? Farbe und Zeichen kommen aus dem Typ-Register. Der Grundtyp „post“ hat keins, weil ein Beitrag keine Ansage braucht; ein unbekannter Typ bekommt nur mit fallback eines.'}>
        <ItemTypeBadge type="post" />
        <ItemTypeBadge type="event" />
        <ItemTypeBadge type="task" />
        <ItemTypeBadge type="place" />
        <ItemTypeBadge type="unbekannt" fallback />
      </Reihe>
      <Reihe titel="ItemMetaRow" erklaerung="Die Fakten des Typs in einer Zeile: Zeit und Ort, wenn es welche gibt.">
        <ItemMetaRow item={STORY_EVENT} />
      </Reihe>
      <Reihe titel="ItemGroupBadge" erklaerung="Aus welchem Space stammt es? Nur nötig, wo mehrere Spaces zusammenlaufen.">
        <ItemGroupBadge name="Gemeinschaftsgarten" color="#3f7a4e" />
        <ItemGroupBadge name="Offene Werkstatt" color="#b36b1c" />
      </Reihe>
      <Reihe titel="ItemPrivateBadge" erklaerung="Mit niemandem geteilt. Liegt im persönlichen Space.">
        <ItemPrivateBadge />
      </Reihe>
      <Reihe titel="ItemScopeBadge" erklaerung="Herkunft oder Privatheit, je nachdem was zutrifft. Die Kurzform der beiden darüber.">
        <ItemScopeBadge item={STORY_TASK} />
      </Reihe>
      <Reihe titel="ItemCommentCount" erklaerung="Gibt es ein Gespräch? Bei null Kommentaren rendert sie nichts.">
        <ItemCommentCount count={3} />
        <ItemCommentCount count={1} />
        <ItemCommentCount count={0} />
      </Reihe>
    </div>
  ),
}

/** Dieselbe Karte, verschieden bestückt: so entsteht der Unterschied zwischen den Modulen. */
export const InDerKarte: Story = {
  name: "In der Karte",
  render: () => (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Feed: Typ, Fakten, Gespräch</p>
        <ItemPreview
          item={STORY_EVENT}
          author={STORY_ME}
          headerAdornment={<ItemTypeBadge type={STORY_EVENT.type} />}
          metaAdornment={<ItemMetaRow item={STORY_EVENT} />}
          footerAdornment={<ItemCommentCount count={3} />}
        />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Übersicht über mehrere Spaces: zusätzlich die Herkunft</p>
        <ItemPreview
          item={STORY_POST}
          author={STORY_ME}
          headerAdornment={
            <>
              <ItemTypeBadge type={STORY_POST.type} />
              <ItemGroupBadge name="Gemeinschaftsgarten" color="#3f7a4e" />
            </>
          }
        />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Dicht, für Kanban und Listen: keine Beschreibung, kleineres Bild</p>
        <ItemPreview item={STORY_TASK} author={STORY_ME} density="compact" headerAdornment={<ItemTypeBadge type={STORY_TASK.type} />} />
      </div>
    </div>
  ),
}

/** Solange die Liste noch lädt. Dieselbe Höhe wie die Karte, damit nichts springt. */
export const Ladezustand: Story = {
  name: "Ladezustand",
  render: () => (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <ItemPreviewSkeleton />
      <ItemPreviewSkeleton />
    </div>
  ),
}
