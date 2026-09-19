#!/usr/bin/env node
// Legt die Doku, die ein App-Bauer braucht, mit ins npm-Paket des Toolkits:
// packages/toolkit/docs/stack/. Läuft als `prepack` des Toolkits, also bei
// `pnpm pack` im Publish-Workflow. Damit findet ein Agent in node_modules
// dieselben Regeln wie im Repo, und zwar in der Version, die er installiert hat.
//
//   node scripts/toolkit-docs-bundle.mjs [pfad-zum-toolkit-dist]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const wurzel = path.resolve(import.meta.dirname, "..");
const toolkit = path.join(wurzel, "packages", "toolkit");
const dist = path.resolve(process.argv[2] ?? path.join(toolkit, "dist"));
const ziel = path.join(toolkit, "docs", "stack");

// Zuerst den Index aus dem frisch gebauten Paket erzeugen (Repo-Kopie und Paket-Kopie).
execFileSync(process.execPath, [path.join(wurzel, "scripts", "toolkit-index.mjs"), dist, path.join(wurzel, "docs", "toolkit-index.md")], { stdio: "inherit" });

const dateien = [
  ["llms.txt", "llms.txt"],
  ["docs/anatomie-eines-moduls.md", "anatomie-eines-moduls.md"],
  ["docs/toolkit-index.md", "toolkit-index.md"],
  ["docs/templates/AGENTS.md", "templates/AGENTS.md"],
  ["docs/spec/README.md", "spec/README.md"],
  ["docs/spec/00-architecture.md", "spec/00-architecture.md"],
  ["docs/spec/01-app-composition.md", "spec/01-app-composition.md"],
  ["docs/spec/02-data-interface.md", "spec/02-data-interface.md"],
  ["docs/spec/03-capabilities.md", "spec/03-capabilities.md"],
  ["docs/spec/04-items-relations-groups-spaces.md", "spec/04-items-relations-groups-spaces.md"],
  ["docs/spec/06-schema-composition.md", "spec/06-schema-composition.md"],
  ["docs/spec/07-tags.md", "spec/07-tags.md"],
  ["docs/spec/08-relation-records.md", "spec/08-relation-records.md"],
  ["docs/spec/glossary.md", "spec/glossary.md"],
  ["docs/spec/modules/README.md", "spec/modules/README.md"],
  ["docs/spec/modules/template.md", "spec/modules/template.md"],
  ["docs/spec/modules/shared-components.md", "spec/modules/shared-components.md"],
  ["docs/spec/modules/kanban.md", "spec/modules/kanban.md"],
  ["docs/spec/modules/map.md", "spec/modules/map.md"],
  ["docs/spec/modules/calendar.md", "spec/modules/calendar.md"],
  ["docs/spec/modules/feed.md", "spec/modules/feed.md"],
];

fs.rmSync(ziel, { recursive: true, force: true });
let n = 0;
for (const [von, nach] of dateien) {
  const q = path.join(wurzel, von);
  if (!fs.existsSync(q)) {
    console.warn(`fehlt, übersprungen: ${von}`);
    continue;
  }
  const z = path.join(ziel, nach);
  fs.mkdirSync(path.dirname(z), { recursive: true });
  fs.copyFileSync(q, z);
  n++;
}
fs.writeFileSync(
  path.join(ziel, "README.md"),
  `# Doku des Real Life Stack, Stand dieser Paketversion\n\nKopie aus dem Repo zum Zeitpunkt des Pakets. Lesereihenfolge für App-Bauer: \`anatomie-eines-moduls.md\`, dann \`spec/01-app-composition.md\`, \`spec/modules/shared-components.md\`, \`toolkit-index.md\`, \`templates/AGENTS.md\`. Quelle und Verweise: https://github.com/real-life-org/real-life-stack\n`,
);
console.log(`${ziel}: ${n} Dateien`);
