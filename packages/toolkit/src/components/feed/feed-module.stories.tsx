import type { Meta, StoryObj } from "@storybook/react-vite"
import { isAggregateVisibleItemType } from "@real-life-stack/data-interface"
import { ContentComposer } from "../composer/content-composer"
import { FeedComposerTrigger } from "./feed-composer-trigger"
import { ItemPreview } from "../preview/item-preview"
import { ItemCommentCount } from "../preview/item-comment-count"
import { ItemMetaRow } from "../preview/item-meta-row"
import { ItemTypeBadge } from "../preview/item-type-badge"
import { ReactionBar } from "../reactions/reaction-bar"
import { useItems } from "../../hooks/use-items"
import { useCommentCount } from "../../hooks/use-comment-count"
import { useMembers } from "../../hooks/use-groups"
import { useItemAuthor } from "../../hooks/use-item-author"
import { useCreateItem } from "../../hooks/use-mutations"
import { STORY_ME, StoryWorld } from "../../story-support/story-world"
import type { Item } from "@real-life-stack/data-interface"

/**
 * Der Feed ist keine eigene Komponente, sondern eine Zusammenstellung: eine
 * Liste von `ItemPreview`, jede mit den Beigaben ihres Typs, darüber der
 * Auslöser für den Composer. Diese Story setzt sie genauso zusammen wie die
 * Referenz-App, an einer echten Datenquelle — anlegen, reagieren und
 * kommentieren wirken wirklich.
 *
 * Systemtypen (Kommentar, Reaktion, Relation) gehören nicht in eine
 * aggregierende Ansicht; welche das sind, sagt `isAggregateVisibleItemType`,
 * nicht eine Liste je Modul.
 */

function FeedItem({ item }: { item: Item }) {
  const { data: members } = useMembers(null)
  const author = useItemAuthor(item, members)
  const comments = useCommentCount(item.id)
  return (
    <ItemPreview
      item={item}
      author={author}
      headerAdornment={<ItemTypeBadge type={item.type} />}
      metaAdornment={<ItemMetaRow item={item} />}
      footerAdornment={
        <>
          <ReactionBar itemId={item.id} />
          {comments > 0 && (
            <div className="ml-auto">
              <ItemCommentCount count={comments} />
            </div>
          )}
        </>
      }
    />
  )
}

function FeedModuleOverview() {
  const { data: items } = useItems()
  const { mutate: createItem } = useCreateItem()
  const feed = items
    .filter((item) => isAggregateVisibleItemType(item.type))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <FeedComposerTrigger
        userName={STORY_ME.displayName}
        userAvatar={STORY_ME.avatarUrl}
        placeholder="Was gibt es Neues im Gemeinschaftsgarten?"
      >
        {({ onClose, initialText }) => (
          <div className="p-4 sm:p-6">
            <ContentComposer
              contentTypes={[{ id: "post", label: "Beitrag", defaultWidgets: ["text", "tags"], submitLabel: "Posten" }]}
              initialData={{ text: initialText ?? "" }}
              showPreview={false}
              showVisibility={false}
              tagQuickSuggestions={["garten", "planung", "infrastruktur", "workshop"]}
              onSubmit={async ({ data }) => {
                const text = typeof data.text === "string" ? data.text.trim() : ""
                if (text) {
                  await createItem({
                    type: "post",
                    createdBy: STORY_ME.id,
                    data: { content: text },
                    ...(Array.isArray(data.tags) && data.tags.length ? { tags: data.tags as string[] } : {}),
                  })
                }
                onClose()
              }}
              onCancel={onClose}
            />
          </div>
        )}
      </FeedComposerTrigger>

      {feed.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
    </div>
  )
}

const meta: Meta<typeof FeedModuleOverview> = {
  id: "rls-space-modules-feed-overview",
  title: "RLS/Module/Feed/Übersicht",
  component: FeedModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj<typeof FeedModuleOverview>

export const Default: Story = {}
