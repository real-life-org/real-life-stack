"use client"

import { useSyncExternalStore } from "react"

import { getI18n, subscribeLanguage, type I18n } from "./runtime"

/**
 * In which language and regional locale does this surface speak — and how?
 *
 * Übersetzung und Formatierung für Komponenten — Abo inklusive (rls#290).
 *
 * `t` und die Formatierer gibt es in React NUR über diesen Hook: wer sie
 * benutzt, ist damit zwangsläufig abonniert, und die Komponente rendert nach
 * jeder Änderung neu — Sprachwechsel, aber auch `extendMessages()` und
 * `applyLanguageConfig()` bei gleicher Sprache. Einen separaten
 * „Subscription-Hook", den man vergessen könnte, gibt es absichtlich nicht.
 *
 * Der Snapshot IST das Bündel: es ist an einen unveränderlichen Stand
 * gebunden und wechselt seine Identität genau dann, wenn sich der Stand
 * ändert — es taugt damit als Dependency für `useMemo`/`useCallback` über
 * übersetzten Werten.
 *
 * @answers `I18n` — `{language, locale, t, tDynamic, formatDate, formatTime, formatFullDateTime, formatRelativeTime, setLanguage}`
 * @without — (works without a provider; the toolkit owns its language state)
 * @group environment
 * @see story rls-foundations-hooks--environment
 * @see spec docs/spec/11-runtime-config-und-branding.md
 */
export function useI18n(): I18n {
  return useSyncExternalStore(subscribeLanguage, getI18n, getI18n)
}
