## Contributing to the stack itself

- [AGENTS.md](https://github.com/real-life-org/real-life-stack/blob/master/AGENTS.md): rules for agents and humans contributing to this repository (as opposed to building apps on it).
- [Agent workspace context](https://github.com/real-life-org/real-life-stack/blob/master/docs/agent-workspace.md): detailed repository context, module host, hook documentation convention.
- Checks that run in CI and that an agent can run itself: `pnpm test`, `pnpm -r typecheck`, `pnpm check:hooks`, `pnpm check:agents`, `pnpm build:site && pnpm check:site && pnpm test:site`, `python3 scripts/check-normative-words.py`, `python3 scripts/check-shared-derivations.py`.

## Optional

- [Storybook](https://real-life-stack.de/storybook/): every module, the app composition (register, host, loading contract, focus, create) and all hooks live.
- [Reference app](https://github.com/real-life-org/real-life-stack/tree/master/apps/reference): full app wiring all modules together.
- [Network app](https://github.com/real-life-org/real-life-stack/tree/master/apps/network): an app with a module of its own (marketplace) on the frame.
- [Web of Trust](https://github.com/real-life-org/web-of-trust): the decentralized identity and sync layer behind the wot-connector.
- [Real Life Agent Protocol](https://github.com/real-life-org/real-life-agent-protocol): agent workflow specs used to develop this stack.
