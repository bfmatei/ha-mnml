# How a template card draws

One `custom:mnml-template-card`, from its configuration to the card on the screen, in the order the code takes. [Templates](templates.md) is the language, [the catalog](catalog.md) the shipped templates, and [Architecture](architecture.md) each module. The words are in the [glossary](glossary.md).

## 1. The configuration

`setConfig()` in `src/cards/template.ts` checks the card's own keys against its structure, as every MNML card does (`requireCard()`, `src/cards/keys.ts`): `template`, and `device`, `area` and `slots` when given, beside the layout keys. A card discovers when it has an `area` or a `device`, or no `slots` at all, which looks in the whole home. A card that does not discover expands at once when the store has already answered and its families are loaded. Any other card waits, below.

## 2. The store

The first template card on a page subscribes to the integration's store, `sharedTemplates(connection)` in `src/store/store.ts`, and every template card waits for its answer, so a customised tile never shows the shipped version first. The answer is `ready`, with the home's own templates and the changes to shipped ones, or `failed`, which turns each card into an error card that says why. [Where templates live](templates.md#where-templates-live) has the store's rules. A save anywhere reaches every open page, and each card expands again.

## 3. The templates in force

`resolvedTemplates()` lays the three sources over each other, the first winning: the home's own templates, the shipped ones with the home's changes, and the shipped ones. It works the result out once for each store and set of loaded families.

## 4. The shipped families

The bundle carries the shared fragments of `common.yaml`, and the shapes of `shapes.yaml` for the home's own templates. Every other shipped family (`room`, `lights`, `car` and the rest) is a JSON file beside it, `mnml-cards-<family>.json`, with its shapes resolved, which `SHIPPED_TEMPLATES` in `src/store/shipped.ts` fetches on need.

- An expansion that reaches a shipped template not loaded yet notes it in `missing` and carries on. So the card fetches every family it misses at once, then expands again. A room takes about two rounds, served from the browser's cache after the first load, and a room without a vacuum never fetches the vacuum's family.
- A family that cannot be fetched, such as a file left out of a hand install, turns the cards that need it into error cards naming the file, and is reported on the browser's console.
- A missing file (404 or 410) is not fetched again until the page is reloaded. Any other failure, such as a dropped connection, is tried again 30 seconds later, on the next update, by every card that needs it, including one drawn in the meantime.

## 5. Discovery

A card that discovers needs `hass`. Its `area` and its `device` must exist, or it is an error card that names the one missing. `discover(template, area, registries, device)` in `src/templates/discover.ts` fills the slots that have a rule from the registries `registriesOf(hass)` gives (`src/ha/snapshot.ts`), and the card asks once per connection for Home Assistant's energy settings, then discovers again with them. [Discovery](templates.md#discovery) has the rules. The card discovers again whenever Home Assistant replaces its registries.

## 6. Expansion

`expand(templates, instance, discovered, later, marking, words)` in `src/templates/expand.ts` is the whole language as a pure function. It takes the templates in force and the card's `template` and `slots`, then four optional arguments: what discovery found, the names of the shipped templates not loaded yet, the parts to mark with their path for the panel (the card marks none), and the words to write, a words table's `templates` group, English when none is given. The card gives it the words of Home Assistant's language (`wordsFor()`, `src/words/words.ts`). It returns the card to draw, its pop-ups, and the templates it is `missing`. A mistake is a `TemplateError`, drawn as an error card that names the template. The card expands again when the store changes, a family arrives, the registries change, or Home Assistant's language changes to one with other words, and it draws again only when the expansion changed.

`expandDashboard(templates, config)` expands every instance of a dashboard at once, so a tool or a test sees what a dashboard of templates draws without a browser. It keeps an instance's layout keys on what it draws, the instance's `visibility` after the drawn card's own, and does not discover: it ignores an instance's `area`, and draws from its `slots` alone.

## 7. The pop-ups

`checkPopups()` checks each pop-up the expansion returned: a hash, cards, and the conditions Home Assistant requires of them. While the card is on the page, and not a preview, it announces its pop-ups (`announce()`, `src/cards/parts/popup-registry.ts`), and it withdraws them when it leaves. The popups card opens them by hash like its own ([The pop-up shell](cards.md#the-pop-up-shell)). A hash two cards give is a console error, reported once, and the first keeps it; a hash the popups card has itself stays its own.

## 8. The draw

`cardOf()` in `src/cards/parts/card-element.ts` makes the expanded card:

- `type: error` is a note with the error's words;
- an MNML card is made from its own class, and its `setConfig()` checks every key against the card's structure (`requireCard()`), so a key the card does not know is an error note naming the card;
- any other card comes from Home Assistant's `loadCardHelpers().createCardElement()`, or is a note until a dashboard has been opened in the tab.

The template card then hands the drawn card every `hass`, and evaluates the drawn card's `visibility` itself. Its size is the drawn card's own. Before that card exists, it is the size a card of its type takes: from the template's own card when nothing is expanded yet, and, while its family has not arrived, from the card type and size the bundle keeps for each family template (`SIZES`, `src/templates/families.ts`). It catches up, when it comes back to the page, on a change it missed while away.
