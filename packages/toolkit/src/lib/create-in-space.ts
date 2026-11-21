import { hasGroups, hasGroupScope, type CreateItemInput, type DataInterface, type Item, type ItemWriter } from "@real-life/data-interface"

/**
 * Die eine Anlegeprüfung für einen gewählten Space (shared-components →
 * Space des Formulars, Regeln 6–8; 02 → Anlegen in einem bestimmten Space),
 * geteilt von Formular und Import:
 *
 * - mit `hasGroupScope()`: `{ group }`, angelegt wird unmittelbar dort;
 * - ohne die Zusage legt der Connector im geöffneten Space an — ist das ein
 *   anderer als der gewählte, wirft die Prüfung VOR dem ersten Schreiben,
 *   statt anzulegen und zu verschieben oder das Item still woanders abzulegen.
 */
export function createOptionsForSpace(connector: DataInterface, group: string | undefined): { group: string } | undefined {
  if (group === undefined) return undefined
  if (hasGroupScope(connector)) return { group }
  const open = hasGroups(connector) ? (connector.getCurrentGroup()?.id ?? null) : null
  if (open !== group) throw new Error("Dieser Speicher kann nur im geöffneten Space anlegen")
  return undefined
}

/** Legt `input` nach {@link createOptionsForSpace} an. */
export function createInSpace(connector: DataInterface & ItemWriter, input: CreateItemInput, options: { group: string } | undefined): Promise<Item> {
  if (options && hasGroupScope(connector)) return connector.createItem(input, options)
  return connector.createItem(input)
}
