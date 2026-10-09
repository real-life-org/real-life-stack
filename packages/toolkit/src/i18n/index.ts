// Bewusst ohne freies `t`/`tDynamic`: in React `useI18n().t`, sonst
// `getI18n().t` / `getI18n().tDynamic` — Text hängt immer an einem Bündel.
// `resetI18nForTests` liegt im Einstieg `@real-life/toolkit/testing`.
export {
  getLanguage,
  setLanguage,
  getLocale,
  getI18n,
  isI18n,
  subscribeLanguage,
  applyLanguageConfig,
  extendMessages,
  formatDate,
  formatTime,
  formatFullDateTime,
  formatRelativeTime,
  SUPPORTED_LANGUAGES,
  type I18n,
  type Language,
  type Message,
  type MessageKey,
  type ToolkitMessageKey,
  type AppMessages,
  type AppMessageKey,
  type MessageParams,
} from "./runtime"
export { useI18n } from "./use-i18n"
