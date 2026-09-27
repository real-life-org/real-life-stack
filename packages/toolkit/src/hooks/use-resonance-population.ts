import { createContext, useContext } from "react"
import { ALL_PEOPLE, type ResonancePopulation } from "../lib/resonance-sort"

/**
 * The person set the Resonance evaluation currently computes over
 * (resonance.md → Auswertung, Personenmenge). The module provides it around
 * its list, so every vote bar inside shows the numbers for exactly that set.
 * Filters stay local: nothing is written or shared. Default: everyone.
 */
const ResonancePopulationContext = createContext<ResonancePopulation>(ALL_PEOPLE)

export const ResonancePopulationProvider = ResonancePopulationContext.Provider

export function useResonancePopulation(): ResonancePopulation {
  return useContext(ResonancePopulationContext)
}
