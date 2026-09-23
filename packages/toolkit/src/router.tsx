/**
 * Subpath entry for everything that needs a router.
 *
 * Import via:
 *   import { UrlFocusProvider } from "@real-life-stack/toolkit/router"
 *
 * Separate from the main entry so `react-router-dom` stays an optional peer
 * dependency: a Storybook, a test or an embedding without an address keeps the
 * focus in memory (`MemoryFocusProvider` in the main entry) and never pulls the
 * router in. An app WITH a router takes this — the URL is the default home of
 * the focus (Spec 01, „Der Modul-Host").
 */

export { UrlFocusProvider, parsePath, buildUrl } from "./components/router/url-focus"
export { resolveDefaultModule } from "./lib/notification-target"
export {
  canonicalPath,
  scopeToSlug,
  STORAGE_KEY_GROUP,
  STORAGE_KEY_MODULE,
  type WorkspaceRouting,
  type WorkspaceRoutingOptions,
} from "./components/router/workspace-routing"
export { notificationRoute } from "./components/router/notification-route"
export { UnsavedChangesGuard } from "./components/router/unsaved-changes-guard"
export { RoutedAppFrame, type RoutedAppFrameProps } from "./components/router/routed-app-frame"
