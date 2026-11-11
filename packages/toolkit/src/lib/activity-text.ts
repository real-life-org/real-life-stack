import type { I18n, MessageKey } from "@/i18n"

/**
 * Die Zusammenfassung eines Log-Eintrags in der Sprache der Oberfläche.
 *
 * `deriveActivitySummary` (data-interface) schreibt für eine Stimme einen deutschen Text ins Log —
 * „Zustimmung zu „Titel"" — und der bleibt dort gespeichert, auch in allen bestehenden Einträgen. Die
 * Anzeige erkennt genau dieses Muster und setzt es neu — nur bei Einträgen einer Stimme (ein
 * Relation-Record, `targetType: "relation"`). Alles andere, auch ein Beitrag, der zufällig
 * „Ablehnung“ heißt, ist Inhalt und bleibt, wie es ist.
 */
const STANCE: Record<string, MessageKey> = {
  Zustimmung: "resonance.vote.green",
  Bedenken: "resonance.vote.yellow",
  Ablehnung: "resonance.vote.red",
  Stimme: "resonance.vote.generic",
}
const VOTE_SUMMARY = /^(Zustimmung|Bedenken|Ablehnung|Stimme)(?: zu „([\s\S]*)")?$/

export function localizeActivitySummary(i18n: I18n, summary: string, targetType: string): string {
  if (targetType !== "relation") return summary
  const match = VOTE_SUMMARY.exec(summary)
  if (!match) return summary
  const stance = i18n.t(STANCE[match[1]!]!)
  return match[2] === undefined ? stance : i18n.t("activity.voteOn", { stance, title: match[2] })
}
