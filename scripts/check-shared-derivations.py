#!/usr/bin/env python3
"""Findet Eigenableitungen von Dingen, die der Modulflaeche gehoeren.

Spec 01, Regel 2a: Was sich Module teilen koennen, gehoert der Flaeche. Der
Pruefsatz lautet — laesst es sich aus den Items des Space oder aus dem
geteilten Filterzustand ableiten, dann ist es geteilt.

Das ist keine Stilfrage. `availableTags` stand siebenmal im Code und
`availableTypes` viermal; die Kopien liefen auseinander, ohne dass ein Test
brach: Kanban sortierte nicht, der Kalender gab weder Symbol noch Farbe mit,
und die Karte nannte einen Typ anders als das Typ-Register. Eine Absicht
allein verhindert das nicht — deshalb dieser Waechter.

Geprueft wird nur, was git kennt; Bibliotheken bleiben draussen.

**Was er nicht faengt.** Die Tags EINES Items zu lesen ist ueberall erlaubt und
sieht im Quelltext genauso aus wie der Anfang einer Sammlung — ein Muster
darauf meldete vier Stellen, die alle richtig waren. Ein Waechter, der lärmt,
wird abgeschaltet, und dann faengt er gar nichts mehr. Er prueft deshalb den
Namen (`availableTags`, `availableTypes`) und wer die geteilten Bausteine
rendert. Wer die Regel unter einem anderen Namen umgeht, faellt ihm nicht auf;
dafuer gibt es das Review.

Aufruf: python3 scripts/check-shared-derivations.py [pfad ...]
Exit 1 bei Befunden.
"""
import re
import subprocess
import sys
from pathlib import Path

# Wo das Geteilte hergestellt werden DARF: die Flaeche selbst und die eine
# Ableitung, die sie benutzt.
ERLAUBT = {
    "packages/toolkit/src/hooks/use-space-vocabulary.ts",
    "packages/toolkit/src/components/layout/module-frame.tsx",
    "packages/toolkit/src/components/filter/filter-pill.tsx",
    "packages/toolkit/src/components/filter/filter-bar.tsx",
    "packages/toolkit/src/components/filter/module-filter-chips.tsx",
    "packages/toolkit/src/components/filter/types.ts",
}

REGELN = [
    (re.compile(r"\bconst\s+available(?:Tags|Types)\s*="),
     "eigene Ableitung des Vokabulars — useSpaceVocabulary() benutzen (Spec 01, Regel 2a)"),
    (re.compile(r"<ModuleSearchBar\b"),
     "die Suche rendert die Flaeche, nicht das Modul (Spec 01, Regel 2b)"),
    (re.compile(r"<FilterPill\b"),
     "die Filterkarte rendert die Flaeche, nicht das Modul (Spec 01, Regel 2a)"),
    (re.compile(r"<ModuleFilterChips\b"),
     "die Chips der aktiven Filter rendert die Flaeche, nicht das Modul (Spec 01, Regel 2a)"),
]

BLOCK = re.compile(r"/\*.*?\*/", re.S)
ZEILE = re.compile(r"//[^\n]*")


def ohne_kommentare(text: str) -> str:
    """Kommentare ausmaskiert, Zeilennummern erhalten.

    Ersetzt wird mit Leerzeichen und Zeilenumbruechen statt zu loeschen, damit
    ein Befund weiter auf seine echte Zeile zeigt. Erfasst den JSX-Fall
    `{/* … */}` mit, denn auch der ist ein Blockkommentar — er stand nur in
    einer Zeile, die nicht mit `/*` beginnt (Codex-Review zu #407, rls#409).
    """
    def leeren(treffer: re.Match[str]) -> str:
        return "".join("\n" if z == "\n" else " " for z in treffer.group(0))

    return ZEILE.sub(leeren, BLOCK.sub(leeren, text))


def pruefe(pfad: Path) -> list[str]:
    befunde = []
    text = ohne_kommentare(pfad.read_text(encoding="utf-8"))
    for nr, zeile in enumerate(text.splitlines(), 1):
        for muster, grund in REGELN:
            treffer = muster.search(zeile)
            if treffer:
                befunde.append(f"{pfad}:{nr}: {treffer.group(0).strip()} — {grund}")
    return befunde


def quellen(wurzeln: list[Path]) -> list[Path]:
    try:
        roh = subprocess.run(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard",
             "--", *[str(w) for w in wurzeln]],
            capture_output=True, check=True, text=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("git ls-files nicht verfuegbar — es wird nichts geprueft", file=sys.stderr)
        return []
    return [Path(p) for p in roh.split("\0") if p.endswith((".ts", ".tsx"))]


def main() -> int:
    wurzeln = [Path(a) for a in sys.argv[1:]] or [Path("packages"), Path("apps")]
    befunde = []
    geprueft = 0
    for pfad in sorted(quellen(wurzeln)):
        posix = pfad.as_posix()
        if posix in ERLAUBT or ".stories." in posix or "/tests/" in posix or "/prototype/" in posix:
            continue
        geprueft += 1
        befunde += pruefe(pfad)
    for zeile in befunde:
        print(zeile)
    if befunde:
        print(f"\n{len(befunde)} Befund(e) in {geprueft} Dateien.")
        print("Regel: docs/spec/01-app-composition.md, Regel 2a.")
        return 1
    print(f"keine Eigenableitungen ({geprueft} Dateien)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
