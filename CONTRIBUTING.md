# Beitragen zum Real Life Stack

## Spezifikation

Die normativen Regeln dieses Repositories liegen in [`docs/spec/`](docs/spec/).
Bei Konflikt zwischen Spec und Implementierung gewinnt die Spec: Entweder der
Code wird angepasst oder die Spec wird geändert, mit einer Notiz im Pull
Request. Code führt keine Regeln stillschweigend ein.

**Wie eine Spezifikation geschrieben wird, steht nicht hier, sondern einmal für
die ganze Familie in [`real-life-org/meta` → `CONVENTIONS.md`](https://github.com/real-life-org/meta/blob/main/CONVENTIONS.md).**
Dort stehen die beiden Dokumentklassen, die deutschen RFC-2119-Wörter, das
Status-Vokabular, die Versionierung und die Normen, auf die wir uns stützen.
Lies das, bevor du einen normativen Satz schreibst.

Das Kurzmaß für dieses Repository:

- Normative Wörter groß: `MUSS`, `MÜSSEN`, `DARF NICHT`, `SOLLTE`, `DARF`.
- `SOLL` ist kein Schlüsselwort. Eine Empfehlung heißt `SOLLTE`, eine Pflicht
  `MUSS`.
- Umlaute werden geschrieben: `MÜSSEN`, nicht `MUESSEN`.
- Keine englischen Schlüsselwörter. Die englische Dokumentklasse liegt in
  `wot-spec/rltp/`, nicht hier.

Geprüft wird das maschinell, nicht durch Lesen:

```
python3 scripts/check-normative-words.py
```

Läuft in der CI mit.

## Code

Die Arbeitsanweisungen für dieses Repository — Architekturregeln, Prüfläufe,
Ablauf — stehen in [`AGENTS.md`](AGENTS.md) und
[`docs/agent-workspace.md`](docs/agent-workspace.md). Sie gelten für Menschen
und Agenten gleichermaßen.

Vor einem Pull Request:

```
pnpm test
pnpm -r typecheck
```

## Sprache

Repository-Sprache ist Deutsch für Spezifikation und Dokumentation, Englisch
für Bezeichner im Code. Kommentare im Code folgen der Sprache ihrer Umgebung.
