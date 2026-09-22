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
 * **The adornments of the item preview.**
 *
 * `ItemPreview` itself knows nothing about types, spaces or conversations. It
 * has three slots, and what stands there is decided by the type register and
 * the surface: the type badge next to the author, the facts under the title
 * (date row, place, status), and the footer with assignees, reactions and the
 * comment hint. That is why the same card looks different in the feed, on the
 * map and in the kanban without there being three cards.
 *
 * Every adornment can be used on its own, outside a card too.
 */

const meta: Meta = {
  id: "rls-items-beigaben",
  title: "RLS/Items/Item preview/Adornments",
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

/** All adornments side by side, each with the sentence it answers. */
export const Alle: Story = {
  name: "All adornments",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <Reihe titel="ItemTypeBadge" erklaerung={'Was für ein Ding ist das? Farbe und Zeichen kommen aus dem Typ-Register. Der Grundtyp „post“ hat keins, weil ein Beitrag keine Ansage braucht; ein unbekannter Typ bekommt nur mit fallback eines.'}>
        <ItemTypeBadge type="post" />
        <ItemTypeBadge type="event" />
        <ItemTypeBadge type="task" />
        <ItemTypeBadge type="place" />
        <ItemTypeBadge type="unbekannt" fallback />
      </Reihe>
      <Reihe titel="ItemMetaRow" erklaerung={'Die Fakten des Typs in einer Zeile: Zeit und Ort, wenn es welche gibt. Hier sind die Werte Text; anklickbar werden sie erst, wo eine App sagt, wohin ein Feld führt — siehe „App Shell → Die Modulfläche“.'}>
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

/** The same card, equipped differently: this is where the difference between modules comes from. */
export const InDerKarte: Story = {
  name: "Inside the card",
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

/** While the list is still loading. Same height as the card, so nothing jumps. */
export const Ladezustand: Story = {
  name: "Loading state",
  render: () => (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <ItemPreviewSkeleton />
      <ItemPreviewSkeleton />
    </div>
  ),
}
