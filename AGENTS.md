# AGENTS.md

Working rules for agents in this repository.

**What it is.** MNML for Home Assistant, in one repository and one release: a Home Assistant integration (`custom_components/mnml/`, Python) that serves the custom cards of a minimal dashboard, their editors and their templates on every page, and installs the light and dark theme they are designed for. The cards, their editors and the panel are Lit elements, as Home Assistant's frontend is. Node runs the TypeScript of the contract, the engine, the generator, the theme, the build and the tools directly; rolldown bundles the elements for the browser, and the build writes everything the browser needs, the theme included, into `custom_components/mnml/www/`.

## Ground rules

- **Don't commit or push** unless asked. The working tree as you find it is the maintainer's work in progress: read it first, build on it, never revert or stash it.
- **`main` takes changes only through pull requests:** a branch, a pull request, the checks green, a squash merge. Nothing pushes to `main` directly.
- **`pnpm check` is the gate** and must pass before you hand back. There are no git hooks.
- **The public interface** is `cards.ts`, the templates (a template's name and slots are kept like a card's keys), the theme's name (`MNML`) and its `mnml-*` variables, and the integration's domain (`mnml`) and options. A new optional key, card, variable or option is a minor release; a renamed or removed one, or a changed meaning, is a major one. Release notes live in GitHub releases, written when a version is tagged.
- **One version,** in `custom_components/mnml/manifest.json`; a release tag `vX.Y.Z` must match it.
- **Small, targeted changes** over new abstractions. For an open-ended request (ideas, a plan, a simplification), give options with their costs, not an implementation; the maintainer picks.
- **Removing a feature removes everything that only served it:** keys, types, helpers, styles, the `--mnml-*` variables a card reads, a theme variable's palette field and its contrast claims, an option and its translations. Report each removal. `knip`, `oxlint` and ruff find the leftovers.
- **No comments in code,** in TypeScript or Python, docstrings included. The reasoning lives in the docs. Code and docs are in English. Docs describe the current state, in the present tense, with no history, change log or personal references.
- **Nothing here knows a particular home.** Entity ids appear only in the tests, `examples/`, `recipes/` and the demo (`demo/`); a card never assumes an integration it cannot be configured away from.
- **ASCII punctuation** in docs, code and anything meant for pasting: `'` and `"`, never curly quotes; `-`, never a long dash; `...`, never an ellipsis character. The cards' UI glyphs (`—` for no value, `•` between parts) are design, not prose.

## Commands

```bash
pnpm install && uv sync   # once: the Node and the Python tools
pnpm check                # oxfmt, oxlint (lint + type check), markdownlint, knip, ruff, mypy, hassfest (Docker), the tests
pnpm fix                  # the part ids, oxfmt, oxlint --fix, markdownlint --fix, ruff --fix, ruff format
pnpm test                 # vitest, then pytest
pnpm build                # custom_components/mnml/www/: the cards, the loader, the editors, the panel, the template families and the two themes, mnml.yaml and mnml-flat.yaml
pnpm zip                  # mnml.zip, the release, after pnpm build
pnpm demo                 # the throwaway Home Assistant at http://localhost:8124, running the integration from this tree
pnpm look                 # every card, template, editor, pop-up and the panel on the throwaway, in both themes, phone and desktop
pnpm walk                 # the panel walked through on the throwaway: edit, save, reset, new, duplicate, delete
pnpm icons                # custom_components/mnml/brand/: the PNG icons from icon-light.svg and icon-dark.svg
```

`pnpm run test:python-floor` runs the Python tests on the oldest Home Assistant supported. `custom_components/mnml/www/`, `mnml.zip`, `out/`, `.ha/` and `.venv/` are ignored by git.

## Where things are

| Path                           | What                                                                                                                                                                                                      | Read first                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `custom_components/mnml/`      | The integration: `__init__.py` (setup, options, unload, removal), `frontend.py`, `theme.py`, `conflicts.py`, `issues.py`, `config_flow.py`, `translations/en.json`, `manifest.json`, `brand/` (the icons) | [docs/architecture.md](docs/architecture.md#custom_componentsmnml-the-integration) |
| `src/contract/`                | The contract: `cards.ts` (every card's configuration), the id types, the defaults, the YAML writer                                                                                                        | [docs/architecture.md](docs/architecture.md)                                       |
| `src/cards/`                   | The cards (`base.ts` is `MnmlCard`), the known-key schemas, the registration, the loader; `parts/` holds what several cards share                                                                         | [docs/cards.md](docs/cards.md), [docs/design.md](docs/design.md)                   |
| `src/ha/`, `src/store/`        | Home Assistant in the browser (types, formatting, names, rules, template parts); the integration's template store and the families on demand                                                              | [docs/architecture.md](docs/architecture.md)                                       |
| `src/editors/`, `src/panel/`   | The card editors and their description vocabulary; the MNML panel                                                                                                                                         | [docs/editors.md](docs/editors.md), [docs/templates.md](docs/templates.md)         |
| `src/templates/`, `templates/` | The template engine and discovery; the shipped templates, one YAML file per family                                                                                                                        | [docs/templates.md](docs/templates.md)                                             |
| `src/home/`, `demo/`           | The home generator (`Home`, `build`, `drawn`, `problems`); the demo home, Joe's and Jane's, and its entities                                                                                              | [docs/home.md](docs/home.md)                                                       |
| `src/theme/`                   | The theme: `model.ts` (`GLASS` and `FLAT`, the only file a change to the themes edits), `theme.ts` (onto Home Assistant's and the cards' variables), `contrast.ts` (every contrast claim), `build.ts`     | [docs/theme.md](docs/theme.md)                                                     |
| `src/build/`                   | The bundle: one rolldown build of the cards, the loader, the editors and the panel                                                                                                                        | [docs/architecture.md](docs/architecture.md)                                       |
| `src/test/`, `tests/`          | The jsdom helpers and the fake Home Assistant; the Python tests, on `pytest-homeassistant-custom-component`. The TypeScript tests sit beside their code                                                   | [docs/architecture.md](docs/architecture.md#tests)                                 |
| `examples/`, `tools/`          | One of every card, and the throwaway Home Assistant that shows them and the demo, with its look and walk passes                                                                                           | [docs/architecture.md](docs/architecture.md#the-throwaway-home-assistant)          |
| `recipes/`                     | Home Assistant packages that feed the cards that read data                                                                                                                                                | [docs/data.md](docs/data.md)                                                       |

## Code rules

- **Types.**
  - Entity ids use the per-domain id types (`LightId`, `SensorId` and the rest), never `string`. `MdiIcon` and `PopupHash` work the same way.
  - `ServiceName` is a closed union; a new service is added to it.
  - Build an id, icon or hash with one template literal with a typed result. `+`, or an unannotated template, widens to `string`.
- **The contract.**
  - Keys are snake_case, as in Lovelace.
  - Never cast, and never read a key the type lacks.
  - Every card declares its keys as a schema (`src/cards/keys.ts`); a new key goes into the interface, the card and its schema together.
  - An optional key has a documented default inside its card; leaving it out is how a configuration asks for the default.
  - No template, CSS or JavaScript travels in the YAML.
  - A flag that only switches something on is typed `?: true`.
- **Order properties by meaning, never alphabetically:** `type`, then the subject, then what it does, then the look, then conditions, then children. A `Room` runs identity, sensors, subsystems; a `Palette` runs surfaces, greys, accents.
- **A threshold that is a share says so in its name:** `low_share` and `tyre_warn_share` are ratios of a target, while a list row's `low` is a value in the entity's unit.
- **Union variants list the same properties** in the same order, with `never` for the ones they exclude. So the set reads as a grid, and no object can satisfy two variants.
- **Colour is a theme variable,** and it colours an icon or text, and tints the pill behind its icon, never another surface. [docs/design.md](docs/design.md#colour) lists the exceptions. Every `--mnml-*` variable a card reads has a fallback, so the cards work under any theme.
- **The theme.** Every colour is a `Hex`, because Home Assistant derives the `--rgb-*` variants from hex values only. A palette change comes with its claims: when a colour moves, fix the claim or the colour; the build won't let them disagree.
- **Lit, as Home Assistant writes it.**
  - A card extends `MnmlCard<C>`; an editor or panel part extends `LitElement`. `register.ts`, `editors/main.ts` and `panel/main.ts` define the elements, guarded by `customElements.get()`; no `@customElement`.
  - `@property({ attribute: false })` for what the host sets, `@state()` for what the element keeps, `@query()` for an element it measures or focuses.
  - `render()` returns an `html` template, `nothing` for an absent part, `classMap` and `styleMap` for classes and colours. No `innerHTML`, no `document.createElement` for what a template can draw; Home Assistant's `createCardElement` children stay elements.
  - Styles are `css` values: the shared ones in `cards/styles.ts`, an element's own in its file. A value several styles share is a custom property on `BASE_STYLE`'s `:host` (`--m-pill`, `--m-hover`), never `unsafeCSS`, which keeps a file from being minified.
  - A file holds one element and what only it uses; a piece several cards share is in `cards/parts/`.
- **Tests** run on vitest: the contract, the engine, the generator, the theme, the build and the tools in Node, the elements in jsdom. `test` comes from vitest, assertions from `node:assert/strict`. An element is mounted with `src/test/render.ts` and queried through its shadow root, with real DOM events.
- **File names are kebab-case** in TypeScript, snake_case in Python. Don't export what only the same file uses.
- **Node strips types at runtime** (`erasableSyntaxOnly`): no enums, namespaces or parameter properties. Decorators need a compiler, so the modules Node runs (the contract, the engine, the generator, the theme, the build, the tools) never import a Lit element.
- **Python** is typed (`mypy --strict`), linted and formatted by ruff with every rule but those `pyproject.toml` turns off, and uses Home Assistant's helpers (config entries, the issue registry, storage) before anything of its own. A setting Home Assistant shows goes into `translations/en.json`.
- **Package scripts.** A script that does several things only chains `pnpm run` steps, each step its own script, as `build` does: `"build": "pnpm run build:frontend && pnpm run build:theme"`.
- **Lint rules.** Every lint rule is an error, and warnings fail too. A rule that fights a convention is turned off in the config, with the reason noted in [docs/architecture.md](docs/architecture.md#tooling), never in an inline directive.
- **Markdown tables are aligned by `pnpm fix`,** not by hand.

## Before you hand back

1. `pnpm check` passes, and `pnpm build` too when the cards or the theme changed.
2. A visible change was looked at in a browser: `examples/` and the demo on the throwaway Home Assistant (`pnpm demo`, then `pnpm look`, and `pnpm walk` for the panel), the default theme and MNML, phone and desktop.
3. The README and the docs describe the new state. Keys, defaults, options and names in them match the code.
4. Removals are reported. Nothing is committed.
