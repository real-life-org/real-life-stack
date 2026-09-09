"use client"

import { useTagLink } from "../navigation/tag-navigation"
import { TagChip } from "./tag-chip"

export interface TagFilterChipProps {
  tag: string
  icon?: string
  size?: "sm" | "md"
}

/**
 * Ein Tag auf einer Karte oder im Detail: klickbar, wo es einen Filter gibt,
 * sonst stiller Text.
 *
 * **Warum eine eigene kleine Komponente.** Der Hook gilt je Tag, und Tags
 * kommen als Liste — `useTagLink` in einer `map`-Schleife verboete die
 * Hook-Regel. Also traegt jeder Chip seinen eigenen Aufruf. Zugleich bleibt
 * `TagChip` frei von jeder Kenntnis des Filters: Er weiss, wie ein Tag
 * aussieht, nicht wohin er fuehrt.
 */
export function TagFilterChip({ tag, icon, size }: TagFilterChipProps) {
  const link = useTagLink(tag)
  if (!link) return <TagChip tag={tag} icon={icon} size={size} />
  return <TagChip tag={tag} icon={icon} size={size} onClick={link.onClick} selected={link.active} />
}
