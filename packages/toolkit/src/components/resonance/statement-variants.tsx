"use client"

import { useMemo } from "react"
import { GitBranch } from "lucide-react"
import type { Item } from "@real-life-stack/data-interface"
import { hasItemGroups, isWritable } from "@real-life-stack/data-interface"
import { cn } from "@/lib/utils"
import { useConnector } from "@/hooks/connector-context"
import { useItems } from "@/hooks/use-items"
import { useIsFrozen } from "@/hooks/use-item-frozen"
import { useOptionalItemFocus } from "@/hooks/use-item-focus"
import { useOptionalCurrentUser } from "@/hooks/use-auth"
import { statementFamily, variantOfValue, type StatementFamily } from "@/lib/resonance-variants"
import { useOptionalCreate } from "../host/create-host"
import { ItemMetaRow } from "../preview/item-meta-row"
import { Button } from "../primitives/button"
import { VoteBar } from "./vote-bar"

const STATEMENTS = { type: "statement" } as const

const titleOf = (item: Item) => (typeof item.data.title === "string" && item.data.title) || "Ohne Titel"

/** The statement's family within the current space (resonance.md → Varianten). */
function useStatementFamily(item: Item): StatementFamily {
  const { data: statements } = useItems(STATEMENTS)
  return useMemo(() => statementFamily(item, statements), [item, statements])
}

function FocusLink({ item, className }: { item: Item; className?: string }) {
  const focus = useOptionalItemFocus()
  const title = titleOf(item)
  if (!focus) return <span className={className}>„{title}“</span>
  return (
    <button
      type="button"
      className={cn("truncate underline-offset-2 hover:underline", className)}
      onClick={(event) => {
        event.stopPropagation()
        focus.focusItem(item.id)
      }}
    >
      „{title}“
    </button>
  )
}

/**
 * Card line (Varianten rule 5): of which statement this one is a variant,
 * and how many variants exist of it. Nothing when neither applies.
 */
export function StatementVariantLine({ item }: { item: Item }) {
  const { parent, variants } = useStatementFamily(item)
  if (parent === null && variants.length === 0) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <GitBranch className="size-3 shrink-0" aria-hidden />
      {parent === "missing" && <span>Variante einer nicht verfügbaren Aussage</span>}
      {parent !== null && parent !== "missing" && (
        <span className="flex min-w-0 items-center gap-1">
          Variante von <FocusLink item={parent} className="max-w-[16rem]" />
        </span>
      )}
      {parent !== null && variants.length > 0 && <span aria-hidden>·</span>}
      {variants.length > 0 && <span>{variants.length === 1 ? "1 Variante" : `${variants.length} Varianten`}</span>}
    </div>
  )
}

/**
 * Detail slot of a statement: the meta row, a hint for the author once the
 * wording is frozen, the family with each version's distribution side by
 * side, and „Variante anlegen" (resonance.md, Wortlaut rule 3, Varianten
 * rules 1 and 5).
 */
export function StatementDetail({ item }: { item: Item }) {
  const connector = useConnector()
  const create = useOptionalCreate()
  const frozen = useIsFrozen(item)
  const { data: currentUser } = useOptionalCurrentUser()
  const { members } = useStatementFamily(item)
  // A variant belongs to the space of its origin: `variantOf` is a
  // space-local reference (Varianten rule 2). Unknown space → not offered,
  // never a silent fallback to „Privat".
  const originGroup = hasItemGroups(connector) ? connector.getItemGroupId(item.id) : null
  const canCreateVariant = isWritable(connector) && create !== null && originGroup !== null
  const isAuthor = currentUser?.id === item.createdBy

  return (
    <div className="space-y-3">
      <ItemMetaRow item={item} />

      {frozen && isAuthor && (
        <p className="text-xs text-muted-foreground">
          Andere haben zu diesem Wortlaut abgestimmt, deshalb lässt er sich nicht mehr ändern. Für eine neue Formulierung leg eine Variante an.
        </p>
      )}

      {members.length > 1 && (
        <section aria-label="Fassungen dieser Aussage" className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Fassungen</h3>
          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className={cn(
                  "space-y-1.5 rounded-md border px-3 py-2",
                  member.id === item.id ? "border-primary/40 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex min-w-0 items-baseline gap-2 text-sm">
                  {member.id === item.id
                    ? <span className="truncate font-medium">„{titleOf(member)}“</span>
                    : <FocusLink item={member} className="text-left font-medium" />}
                  {member.id === item.id && <span className="shrink-0 text-xs text-muted-foreground">diese Fassung</span>}
                </div>
                <VoteBar statementId={member.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {canCreateVariant && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => create.startCreate("statement", {
            title: typeof item.data.title === "string" ? item.data.title : "",
            text: typeof item.data.description === "string" ? item.data.description : "",
            variantOf: variantOfValue(item),
          }, { fixedGroup: originGroup! })}
        >
          <GitBranch className="size-3.5" aria-hidden />
          Variante anlegen
        </Button>
      )}
    </div>
  )
}
