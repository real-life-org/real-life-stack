import type { I18n } from "@/i18n"
import { registerText } from "@/lib/register-labels"
/** The 16 available reaction emojis. */
export const REACTION_EMOJIS = [
  "❤️", "👍", "👎", "😂", "😮", "😢", "😡", "🙏",
  "🔥", "🎉", "🤔", "💪", "🚀", "✨", "👀", "🤝",
] as const

export type ReactionEmoji = typeof REACTION_EMOJIS[number]

/**
 * Human-readable names for accessibility (aria-label), English — the fallback. The surface speaks them
 * in its language via {@link reactionName} (`reactions.name.<name>`).
 */
// i18n-exempt: Rückfall und Schlüsselquelle; angezeigt wird reactionName()
export const REACTION_NAMES: Record<string, string> = {
  "❤️": "Heart",
  "👍": "Thumbs up",
  "👎": "Thumbs down",
  "😂": "Laughing",
  "😮": "Surprised",
  "😢": "Sad",
  "😡": "Angry",
  "🙏": "Pray",
  "🔥": "Fire",
  "🎉": "Party",
  "🤔": "Thinking",
  "💪": "Strong",
  "🚀": "Rocket",
  "✨": "Sparkles",
  "👀": "Eyes",
  "🤝": "Handshake",
}

/** Der Name einer Reaktion in der Sprache der Oberfläche, für Screenreader. */
export function reactionName(i18n: I18n, emoji: string): string {
  const english = REACTION_NAMES[emoji]
  if (!english) return emoji
  return registerText(i18n, `reactions.name.${english.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase())}`, english)
}
