# Real Life Stack

> Real Life Stack (RLS) is a modular, backend-agnostic app and UI toolkit for local communities, commons and decentralized collaboration. An app is a connector to its data, a register of modules and the frame from the toolkit; map, calendar, kanban, feed, list, graph and resonance come ready-made.

Architecture in one line: `app frame / modules -> hooks -> DataInterface -> connector -> data source`. Surfaces never talk to a backend; they ask hooks, hooks read the `DataInterface`, and the connector decides whether data lives in memory, in Supabase or in an end-to-end encrypted Web of Trust network. Swapping the connector swaps the backend without touching the UI.

The spec is written in German. The type definitions in `@real-life-stack/data-interface` are the precise, English source of truth for all data shapes. This file is generated (`pnpm docs:agents`) from the packages, the spec index and the hooks' documentation comments; CI fails when it is stale.

## Building an app on Real Life Stack

**Not yet on npm (22.09.2026):** the frame (`RoutedAppFrame`, subpath `@real-life-stack/toolkit/router`) and the seven toolkit modules are in the repository but not in the published toolkit 0.1.10. Until the next release (release PR #402), run from the repository: `git clone https://github.com/real-life-org/real-life-stack && pnpm install && pnpm dev:first-app`. Check the published state with `npm view @real-life-stack/toolkit exports` — once it lists `./router`, the npm path below works.

- [First app (handbook, German)](https://real-life-stack.de/handbuch/erste-app/): ~40 lines — connector, router, `RoutedAppFrame`. Every line explained.
- [examples/first-app](https://github.com/real-life-org/real-life-stack/tree/master/examples/first-app): the same app as running code, built and tested in CI.
- [AGENTS.md template for RLS apps](https://github.com/real-life-org/real-life-stack/blob/master/docs/templates/AGENTS.md): drop-in guide for a coding agent that builds an app on the published packages. Its bootstrap code is the first app, verbatim.
- [Working with an agent (handbook, German)](https://real-life-stack.de/handbuch/agenten/): entry points, task shape, rules, the checks.
- Rule of thumb (spec 01, "what stays with the app"): an app provides connector, router, register, map engine and the frame — nothing else. A module runs without a line in the app.
