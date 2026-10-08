"use client"

import { useMemo } from "react"
import { GitBranch } from "lucide-react"
import type { ListQuery } from "../preview/list-queries"
import type { Item } from "@real-life/data-interface"
import { hasItemGroups, isWritable } from "@real-life/data-interface"
import { useConnector } from "@/hooks/connector-context"
import { useItems } from "@/hooks/use-items"
import { useIsFrozen } from "@/hooks/use-item-frozen"
import { useOptionalCurrentUser } from "@/hooks/use-auth"
import { statementFamily, variantOfValue, type StatementFamily } from "@/lib/resonance-variants"
import { useOptionalCreate } from "../host/create-host"
import { VoteMiniBar } from "./vote-bar"

const STATEMENTS = { type: "statement" } as const

/** The statement's family within the current space (resonance.md → Varianten). */
function useStatementFamily(item: Item): StatementFamily {
  const { data: statements } = useItems(STATEMENTS)
  return useMemo(() => statementFamily(item, statements), [item, statements])
}

/**
 * Card line (Varianten rule 5): how many variants exist of this statement.
 * Of which statement it is a variant stands on the card as the chip of the
 * `variantOf` field (B15, Spec 06 Regel 11; renderTypeCardFooter). Nothing
 * when there are no variants.
 */
export function StatementVariantLine({ item }: { item: Item }) {
  const { variants } = useStatementFamily(item)
  if (variants.length === 0) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <GitBranch className="size-3 shrink-0" aria-hidden />
      <span>{variants.length === 1 ? "1 Variante" : `${variants.length} Varianten`}</span>
    </div>
  )
}

/**
 * The named query `family` (resonance.md → Varianten, rules 1 and 5; Spec 06,
 * Feld- und Kantenregister, Regel 12): the statement's family within the
 * current space — origin first, then every variant once. Each row carries
 * „Ausgang" or „Variante", „diese" for the shown version and a small vote bar.
 * The list action `create-variant` opens the composer prefilled with the
 * wording, `variantOf` fixed and the origin's space fixed (Varianten rule 2).
 * Unknown space → not offered, never a silent fallback to „Privat".
 * Once the wording is frozen, the author reads why at the list (Modi,
 * Regel 4; resonance.md, Wortlaut rule 3).
 */
export const familyListQuery: ListQuery = function useFamilyList(item) {
  const connector = useConnector()
  const create = useOptionalCreate()
  const frozen = useIsFrozen(item)
  const { data: currentUser } = useOptionalCurrentUser()
  const { members } = useStatementFamily(item)
  const originGroup = hasItemGroups(connector) ? connector.getItemGroupId(item.id) : null
  const canCreateVariant = isWritable(connector) && create !== null && originGroup !== null
  const isAuthor = currentUser?.id === item.createdBy
  const rootId = members[0]?.id
  return {
    entries: members,
    decorate: (member) => ({
      badge: member.id === rootId ? "Ausgang" : "Variante",
      ...(member.id === item.id ? { mark: "diese" } : {}),
      trailing: <VoteMiniBar statementId={member.id} />,
    }),
    ...(canCreateVariant
      ? {
          action: () =>
            create!.startCreate("statement", {
              title: typeof item.data.title === "string" ? item.data.title : "",
              text: typeof item.data.description === "string" ? item.data.description : "",
              variantOf: variantOfValue(item),
            }, { fixedGroup: originGroup!, fixedGroupReason: "Varianten bleiben im Space ihrer Aussage" }),
        }
      : {}),
    ...(frozen && isAuthor
      ? {
          note: "Wortlaut eingefroren",
          noteDetail: "Andere haben zu diesem Wortlaut abgestimmt, deshalb lässt er sich nicht mehr ändern. Für eine neue Formulierung leg eine Variante an.",
        }
      : {}),
  }
}
