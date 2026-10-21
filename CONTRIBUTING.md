# Contributing to Real Life Stack

## Specification

The normative rules of this repository live in [`docs/spec/`](docs/spec/).
When spec and implementation conflict, the spec wins: either the code is
changed, or the spec is changed with a note in the pull request. Code does not
introduce rules silently.

**How a specification is written is not defined here. It is defined once for
the whole family in [`real-life-org/meta` → `CONVENTIONS.md`](https://github.com/real-life-org/meta/blob/main/CONVENTIONS.md).**
It describes the two document classes, the German RFC 2119 words, the status
vocabulary, versioning, and the standards we build on. Read it before you
write a normative sentence.

The short version for this repository:

- Normative words in capitals: `MUSS`, `MÜSSEN`, `DARF NICHT`, `SOLLTE`, `DARF`.
- `SOLL` is not a keyword. A recommendation is `SOLLTE`, an obligation is
  `MUSS`.
- Umlauts are written out: `MÜSSEN`, not `MUESSEN`.
- No English keywords. The English document class lives in
  [`real-life-org/trust-protocol`](https://github.com/real-life-org/trust-protocol), not here.

This is checked by a script, not by reading:

```
python3 scripts/check-normative-words.py
```

It runs in CI.

## Concept proposals

An architecture idea comes as a concept first, not as code. The concept is a
Markdown file under `docs/concepts/<topic>.md` and comes as a pull request.
At the top is the status line `**Status:** Vorschlag (Datum)`, as in
[`docs/concepts/item-edit-delete-2026-06.md`](docs/concepts/item-edit-delete-2026-06.md).
Open questions stay open in the proposal and are not decided there.

A proposal contains:

- the problem,
- the affected specs with their path under `docs/spec/`,
- the proposed mechanism,
- the consequences for local-first and end-to-end encryption,
- the open questions.

The maintainer decides the mechanism before anything is built. A proposal is
not an approval. After the decision the concept becomes a spec under
`docs/spec/`, and only then comes code.

Small changes such as typos, documentation gaps or bugs go directly as a pull
request, see [`AGENTS.md`](AGENTS.md). Checks and repository rules are in
[`AGENTS.md`](AGENTS.md) and
[`docs/agent-workspace.md`](docs/agent-workspace.md).

## Code

The working instructions for this repository (architecture rules, checks,
workflow) are in [`AGENTS.md`](AGENTS.md) and
[`docs/agent-workspace.md`](docs/agent-workspace.md). They apply to people and
agents alike.

Before a pull request:

```
pnpm test
pnpm -r typecheck
```

## Language

Repository entry files (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`) are
written in English. The specification and the documents under `docs/` are
written in German. Identifiers in code are English. Code comments follow the
language of their surroundings.
