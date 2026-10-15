# Contributing

The working rules, for people and coding agents alike, are in [AGENTS.md](AGENTS.md): the public interface, the code rules, and what a change brings with it. [docs/architecture.md](docs/architecture.md) says where everything is and why.

## Setup

You need Node 26, pnpm (the version `packageManager` in `package.json` names), uv, which installs the Python of `.python-version`, and Docker, for hassfest and the throwaway Home Assistant. Without Docker, `pnpm check` skips hassfest and says so; CI runs it.

```bash
pnpm install && uv sync
pnpm check    # the gate: format, lint and type check, Markdown lint, dead code, ruff, mypy, hassfest, the tests
pnpm fix      # the part ids, format, and fix what the linters can
pnpm demo     # the throwaway Home Assistant at http://localhost:8124, running the integration from this tree
pnpm look     # every card, template, editor, pop-up and the panel on the throwaway, in both themes, phone and desktop
```

## Pull requests

- `main` takes changes only through pull requests: a branch, a pull request, the checks green, a squash merge.
- The checks are the jobs of `.github/workflows/check.yml`: `lint`, `typescript`, `python`, `pytest`, `hassfest`, `floor` and `hacs`. Together they run every step of `pnpm check`, and also the Python tests on the oldest Home Assistant supported (`pnpm run test:python-floor`) and HACS's validation.
- A visible change is looked at on the throwaway Home Assistant: `pnpm demo`, then `pnpm look`, and `pnpm walk` for the panel.
- A change to the public interface is deliberate: `pnpm run fix:interface` records it in `interface.json`, and the pull request says what it adds, renames or removes.
- The README and the docs describe the new state, in the present tense.
- The pull request template holds the checklist.
