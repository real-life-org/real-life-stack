#!/usr/bin/env python3
"""Prueft die normativen Woerter gegen meta/CONVENTIONS.md.

Drei Regeln, alle drei sind stumme Fehler, wenn sie niemand prueft:

1. SOLL und SOLLEN sind keine Schluesselwoerter. Eine Empfehlung heisst
   SOLLTE, eine Pflicht MUSS.
2. Umlaute werden geschrieben: MUESSEN, DUERFEN, KOENNEN sind falsch.
3. Die beiden Wortsaetze werden nicht gemischt. Ein deutsches Dokument
   benutzt keine englischen Schluesselwoerter.

**Ein Wort in Backticks wird ueber sich selbst gesprochen, nicht benutzt.**
`SOLL` in einem Satz wie "`SOLL` ist kein Schluesselwort" ist ein Zitat und
kein Verstoss. Ausgenommen sind deshalb genau die Codespannen, nicht die
Zeilen, in denen sie stehen: Der Rest des Satzes wird weiter geprueft.
Codebloecke (``` und eingerueckt) zaehlen ebenso als Zitat.

Geprueft werden die Markdown-Dateien, die git kennt oder die neu und nicht
ignoriert sind. Damit sind node_modules, Build-Ausgaben und alles Fremde
draussen, ohne eigene Ausschlussliste — und eine neue, noch nicht
hinzugefuegte Datei wird trotzdem geprueft.

Aufruf: python3 scripts/check-normative-words.py [pfad ...]
Exit 1 bei Befunden.
"""
import re
import subprocess
import sys
from pathlib import Path

REGELN = [
    (re.compile(r"\bSOLL(?:EN)?\b"),
     "SOLL/SOLLEN ist kein Schluesselwort — SOLLTE (Empfehlung) oder MUSS (Pflicht)"),
    (re.compile(r"\b(?:MUESSEN|DUERFEN|KOENNEN|MUESSTE|DUERFTE)\b"),
     "Umlaut fehlt — MÜSSEN, DÜRFEN, KÖNNEN"),
    (re.compile(r"\b(?:MUST NOT|MUST|SHOULD NOT|SHOULD|SHALL NOT|SHALL|MAY|REQUIRED|OPTIONAL|RECOMMENDED)\b"),
     "englisches Schluesselwort in einem deutschen Dokument"),
]

CODESPANNE = re.compile(r"`+[^`]*`+")
ZAUN = re.compile(r"^\s*(```|~~~)")


def sichtbarer_text(zeilen: list[str]):
    """Liefert (nummer, zeile) mit ausmaskierten Zitaten.

    Maskiert wird mit Leerzeichen, damit die Spalten stimmen und eine
    Codespanne keine zwei Woerter zusammenzieht.
    """
    im_block = False
    for nr, zeile in enumerate(zeilen, 1):
        if ZAUN.match(zeile):
            im_block = not im_block
            continue
        if im_block or zeile.startswith("    ") or zeile.startswith("\t"):
            continue
        yield nr, CODESPANNE.sub(lambda t: " " * len(t.group(0)), zeile)


def pruefe(pfad: Path) -> list[str]:
    befunde = []
    zeilen = pfad.read_text(encoding="utf-8").splitlines()
    for nr, zeile in sichtbarer_text(zeilen):
        for muster, grund in REGELN:
            for treffer in muster.finditer(zeile):
                befunde.append(f"{pfad}:{nr}:{treffer.start() + 1}: {treffer.group(0)} — {grund}")
    return befunde


def markdown_dateien(wurzeln: list[Path]) -> list[Path]:
    try:
        roh = subprocess.run(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard",
             "--", *[str(w) for w in wurzeln]],
            capture_output=True, check=True, text=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("git ls-files nicht verfuegbar — es wird nichts geprueft", file=sys.stderr)
        return []
    return [Path(p) for p in roh.split("\0") if p.endswith(".md")]


# Der Stack fuehrt nur die deutsche Dokumentklasse. Die englische liegt in
# real-life-org/rltp-spec.
AUSGENOMMEN: set[str] = set()
ENGLISCHE_DOKUMENTE: set[str] = set()


def main() -> int:
    wurzeln = [Path(a) for a in sys.argv[1:]] or [Path(".")]
    befunde = []
    geprueft = 0
    for pfad in sorted(markdown_dateien(wurzeln)):
        if "archive" in pfad.parts or pfad.parts[0] in AUSGENOMMEN:
            continue
        if pfad.as_posix() in ENGLISCHE_DOKUMENTE:
            continue
        geprueft += 1
        befunde += pruefe(pfad)
    for zeile in befunde:
        print(zeile)
    if befunde:
        print(f"\n{len(befunde)} Befund(e) in {geprueft} Dateien. Regeln: meta/CONVENTIONS.md")
        return 1
    print(f"normative Woerter in Ordnung ({geprueft} Dateien)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
