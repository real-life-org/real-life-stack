// Utilities
export { cn, getTagColor, getTagAccentColor, getSpacePrimaryColor, getReadableTextColor, getItemColor, resolveAssetUrl } from "./lib/utils"
export {
  focusActiveItemOnce,
  focusVirtualItemOnce,
  selectionFocusScrollMarginBlockEnd,
  type SelectionFocusVisibleArea,
  type SelectionFocusVirtualizer,
} from "./lib/selection-focus"
export { filterByAssignee, assigneeIds, type AssigneeFilter } from "./lib/item-filter"
export {
  observeColorScheme,
  resolveColorScheme,
  type ColorScheme,
  type ColorSchemePreference,
} from "./lib/color-scheme"
export {
  loadRuntimeConfig,
  instanceTheme,
  TOOLKIT_ACCENT,
  getRuntimeConfig,
  applyBranding,
  DEFAULT_RUNTIME_CONFIG,
  type RuntimeConfig,
  type RuntimeEndpoints,
  type Branding,
  type BrandingTheme,
} from "./lib/runtime-config"
export {
  deriveColorScale,
  grayFor,
  scalesForColor,
  namedScale,
  ACCENT_SCALE_NAMES,
  GRAY_SCALE_OPTIONS,
  type ColorScale,
  type ColorScheme as ThemeColorScheme,
} from "./lib/color-scales"
export {
  themeTokens,
  applyThemeTokens,
  clearThemeTokens,
  SEMANTIC_TOKENS,
  type ThemeTokens,
} from "./lib/theme-tokens"
export {
  CORE_MODULES,
  CORE_MODULE_LAYER,
  composeModules,
  setModuleRegistry,
  isKnownModule,
  resolveSpaceModules,
  resolveActiveModule,
  getModules,
  getModule,
  moduleIds,
  defaultModuleIds,
  displayableModules,
  findModulePresenting,
  type ModuleEntry,
  type ModuleFragment,
  type ModuleLayer,
  type ModuleRegistry,
  type ModuleViewProps,
  type ModuleFill,
} from "./lib/module-register"
export {
  resolveIcon,
  registerIcon,
  getIcon,
  iconToDataUrl,
  iconRegistryVersion,
  iconNames,
  DEFAULT_ICON,
  MARKER_ICON_SET,
  type IconData,
} from "./lib/icons"
export {
  createNominatimGeocoder,
  nominatimGeocode,
  createNominatimReverseGeocoder,
  nominatimReverseGeocode,
  type Geocoder,
  type GeocodeResult,
  type ReverseGeocoder,
} from "./lib/geocode"

// Components
export { itemTitle, itemText } from "./lib/item-text"
export * from "./components"

// Hooks
export * from "./hooks"
export * from "./components/navigation"
export { readRadius, readSurfaces, readGray, layoutTokens, RADIUS_ORDER, RADIUS_STEPS, SURFACES } from "./lib/space-theme"
export type { GrayChoice, RadiusStep, Surfaces } from "./lib/space-theme"
