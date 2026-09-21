// Brücke: Die Inhaltstypen kommen seit 21.09.2026 aus dem Register im
// Toolkit (Spec 06, Spec 01 „Der Modul-Host"). Die früheren APP_EXTRAS sind
// Darstellungseinträge der Typen. Die Teilmengen je Modul bleiben hier, bis
// der Host das Erstellen mit ALLEN Typen registriert (B0, Schritt 5).
import { contentTypesFromRegister, pickContentTypes, resolveContentType } from "@real-life-stack/toolkit"

export { pickContentTypes, resolveContentType }
export const ALL_CONTENT_TYPES = contentTypesFromRegister()
export const FEED_CREATE_TYPES = pickContentTypes("post", "event")
export const CALENDAR_CREATE_TYPES = pickContentTypes("event")
export const MAP_CREATE_TYPES = pickContentTypes("place", "event")
export const KANBAN_CREATE_TYPES = pickContentTypes("task")
export const RESONANCE_CREATE_TYPES = pickContentTypes("statement")
