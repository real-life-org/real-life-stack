import { createComposerMapping, withGroupOptions } from "@real-life-stack/toolkit"
import { ALL_CONTENT_TYPES } from "./content-types"

// The mapping itself lives in the toolkit (createComposerMapping); the app only
// binds it to its content types. Kept as a module so the views' imports stay.
const mapping = createComposerMapping(ALL_CONTENT_TYPES)
export const mapComposerSubmission = mapping.mapSubmission
export const itemToComposerData = mapping.editInitialData
export { withGroupOptions }
