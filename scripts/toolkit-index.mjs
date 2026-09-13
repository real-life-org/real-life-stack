#!/usr/bin/env node
// Erzeugt docs/toolkit-index.md aus den Typdateien des gebauten Toolkits:
// je Bereich die exportierten Namen mit dem ersten Satz ihres JSDoc.
//
//   node scripts/toolkit-index.mjs [pfad-zum-toolkit-dist] [ausgabe.md]
//
// Standard: packages/toolkit/dist (nach `pnpm --filter @real-life-stack/toolkit build`)
// oder das installierte Paket einer App: node_modules/@real-life-stack/toolkit/dist.
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve(process.argv[2] ?? "packages/toolkit/dist");
const ziel = path.resolve(process.argv[3] ?? "docs/toolkit-index.md");
const version = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dist, "..", "package.json"), "utf8")).version;
  } catch {
    return "?";
  }
})();

// Die Zonen der Modulfläche, damit der Index nach Anatomie lesbar ist (docs/anatomie-eines-moduls.md).
const ZONE = {
  layout: "App-Shell und Modulfläche",
  navigation: "App-Shell (Navbar, Tabs)",
  auth: "App-Shell (Anmeldung)",
  contacts: "App-Shell (Kontakte, Verifikation, Relay-Status)",
  profile: "App-Shell (Profil)",
  activity: "App-Shell (Aktivität, Benachrichtigungen)",
  debug: "App-Shell (Debug)",
  "module-panel": "Modul-Einstellungen",
  filter: "Modul-Kopf und Filter-Pille",
  "create-fab": "Ecke unten rechts: Erstellen",
  preview: "Item-Karte (ItemPreview) und Adornments",
  detail: "Panel: Item-Detail lesen und bearbeiten",
  composer: "Panel: Composer und Widgets",
  comments: "Panel: Diskussion",
  reactions: "Panel: Reaktionen",
  tag: "Tags",
  lens: "Linsen (Liste, Raster, Sammlung)",
  feed: "Modul: Feed",
  kanban: "Modul: Kanban",
  calendar: "Modul: Kalender",
  map: "Modul: Karte",
  graph: "Modul: Graph",
  resonance: "Modul: Resonanz",
  dashboard: "Modul: Dashboard",
  primitives: "Primitive (Button, Dialog, Input, …)",
};

const exportRe = /export\s+(?:declare\s+)?(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
const reexportRe = /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

function ersterSatz(doc) {
  const text = doc
    .replace(/^\s*\/\*\*|\*\/\s*$/g, "")
    .split("\n")
    .map((z) => z.replace(/^\s*\*\s?/, ""))
    .filter((z) => !z.startsWith("@"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : text).slice(0, 160);
}

function beschreibungen(datei) {
  const src = fs.readFileSync(datei, "utf8");
  const map = new Map();
  // Ein Kommentar endet beim ersten `*/`, sonst wandert der Kommentar einer Eigenschaft zum Export.
  const re = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*\n\s*export\s+(?:declare\s+)?(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(src))) map.set(m[2], ersterSatz(m[1]));
  return { src, map };
}

function sammle(bereichDir) {
  const index = path.join(bereichDir, "index.d.ts");
  if (!fs.existsSync(index)) return [];
  const src = fs.readFileSync(index, "utf8");
  const eintraege = [];
  let m;
  while ((m = reexportRe.exec(src))) {
    const namen = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^type\s+/, "").split(/\s+as\s+/).pop());
    const quelle = path.join(bereichDir, m[2].replace(/\.js$/, "") + ".d.ts");
    const docs = fs.existsSync(quelle) ? beschreibungen(quelle).map : new Map();
    for (const n of namen) {
      const istTyp = /^[A-Z]/.test(n) && (docs.has(n) ? false : /(Props|Config|Options|Handle|State|Entry)$/.test(n));
      eintraege.push({ name: n, doc: docs.get(n) ?? "", typ: istTyp });
    }
  }
  return eintraege;
}

const bereiche = fs
  .readdirSync(path.join(dist, "components"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort((a, b) => (Object.keys(ZONE).indexOf(a) + 1 || 99) - (Object.keys(ZONE).indexOf(b) + 1 || 99));

let out = `# Toolkit-Index (${version})\n\n`;
out += `Erzeugt aus den Typdateien des gebauten Pakets mit \`scripts/toolkit-index.mjs\`. Nicht von Hand ändern. Je Bereich: exportierte Namen mit dem ersten Satz ihres JSDoc. Die Zone sagt, wo der Baustein in der [Anatomie eines Moduls](anatomie-eines-moduls.md) hingehört.\n\n`;
for (const b of bereiche) {
  const e = sammle(path.join(dist, "components", b));
  if (!e.length) continue;
  out += `## ${b} — ${ZONE[b] ?? ""}\n\n`;
  for (const x of e) out += `- \`${x.name}\`${x.doc ? ` — ${x.doc}` : ""}\n`;
  out += "\n";
}
const hooks = sammle(path.join(dist, "hooks"));
if (hooks.length) {
  out += `## hooks — Daten und Zustand\n\n`;
  for (const x of hooks) out += `- \`${x.name}\`${x.doc ? ` — ${x.doc}` : ""}\n`;
  out += "\n";
}
fs.writeFileSync(ziel, out);
console.log(`${ziel}: ${bereiche.length} Bereiche, ${hooks.length} Hooks, Version ${version}`);
