// Space-Arten eines Netzwerks (Spec 04, "Netzwerk und Space-Art").
//
// Ein Netzwerk-Space traegt in `Group.data.spaceKinds`, als was seine
// Gemeinschaften ihre Spaces fuehren: Projekte und Stiftungen, Werkstaetten
// und Gaerten, Kreise und Orte. Die Liste kommt von den Menschen im Netzwerk
// und wird ueber den Connector synchronisiert — nie aus Code, nie aus einer
// Datei auf dem Server. Hier steht nur, wie sie geprueft und wie ein Schluessel
// aus einem Namen gebildet wird.

export interface SpaceKind {
  /** Schluessel, wie er in `Group.data.kind` steht: `[a-z0-9-]{1,32}`. Bleibt beim Umbenennen. */
  id: string
  /** Anzeigename, Einzahl. */
  label: string
  /** Anzeigename, Mehrzahl — Ueberschrift in aufzaehlenden Flaechen. */
  labelPlural: string
  /** Hex-Farbe `#rrggbb` als Akzent der Art. */
  color?: string
}

const KIND_ID = /^[a-z0-9-]{1,32}$/
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Prueft eine Arten-Liste (Spec 04, "Netzwerk und Space-Art", Regel 4).
 *
 * Eintragsweise: Ein fehlerhafter Eintrag wird verworfen und gemeldet, die
 * uebrigen gelten weiter. Eine Liste, die kein Array ist, faellt als Ganzes.
 * Ein Tippfehler in einer Art darf dem Netzwerk nicht alle Arten nehmen.
 */
export function parseSpaceKinds(raw: unknown, quelle = "Group.data.spaceKinds"): SpaceKind[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    console.warn(`[rls] ${quelle} ist keine Liste — ignoriert.`)
    return []
  }
  const out: SpaceKind[] = []
  const seen = new Set<string>()
  raw.forEach((entry, index) => {
    const wo = `${quelle}[${index}]`
    if (!isPlainObject(entry)) {
      console.warn(`[rls] ${wo} ist kein Objekt — uebersprungen.`)
      return
    }
    const { id, label, labelPlural, color } = entry
    if (typeof id !== "string" || !KIND_ID.test(id)) {
      console.warn(`[rls] ${wo}: id "${String(id)}" ist kein Bezeichner [a-z0-9-]{1,32} — uebersprungen.`)
      return
    }
    if (seen.has(id)) {
      console.warn(`[rls] ${wo}: id "${id}" kommt doppelt vor — uebersprungen.`)
      return
    }
    if (typeof label !== "string" || !label.trim() || typeof labelPlural !== "string" || !labelPlural.trim()) {
      console.warn(`[rls] ${wo}: "${id}" braucht label und labelPlural — uebersprungen.`)
      return
    }
    const kind: SpaceKind = { id, label: label.trim(), labelPlural: labelPlural.trim() }
    if (color !== undefined && color !== null && color !== "") {
      if (typeof color === "string" && HEX_COLOR.test(color)) kind.color = color
      else console.warn(`[rls] ${wo}: color "${String(color)}" ist kein #rrggbb — Farbe ignoriert.`)
    }
    seen.add(id)
    out.push(Object.freeze(kind))
  })
  return out
}

/**
 * Schluessel aus dem Anzeigenamen: klein, Umlaute aufgeloest, alles andere zu
 * "-". Bei Kollision haengt eine Zahl an. Der Schluessel wird EINMAL beim
 * Anlegen gebildet und bleibt danach — sonst verloeren Spaces beim
 * Umbenennen einer Art ihre Zuordnung.
 */
export function kindIdFromLabel(label: string, taken: Iterable<string> = []): string {
  const base =
    label
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)
      .replace(/-+$/, "") || "art"
  const set = new Set(taken)
  if (!set.has(base)) return base
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`
    if (!set.has(candidate)) return candidate
  }
}
