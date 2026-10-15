# Glossary

The words the docs and the code use, one meaning each, with where each is described.

- **Catalog.** The list of the shipped templates, their slots, rules and pop-ups, written from `templates/*.yaml` by `pnpm run fix:docs`: [catalog.md](catalog.md).
- **Change.** One edit the home keeps to a shipped template, `set`, `remove`, `insert` or `move`, addressed by a path of keys and part ids; a later release keeps applying it, or marks it changed or gone. [Changes to a shipped template](templates.md#where-templates-live).
- **Dashboard template.** What a dashboard MNML built is shared as: its title, icon, sections, pop-up openings and the templates they use (`DashboardTemplate`, `src/builder/dashboard-template.ts`). [Sharing a dashboard](editors.md#sharing-a-dashboard).
- **Discovery.** Filling a template's slots from the home, by the `discover:` rule of each slot, in an area, on a device or in the whole home (`discover()`). [Discovery](templates.md#discovery).
- **Edit it here.** The panel's button that copies a piece another template draws into the template being edited, its slots filled in, so it can change there alone (`editHere()`, `src/templates/edit-here.ts`). [Templates in the panel](editors.md#templates).
- **Family.** One file of `templates/`, such as `room.yaml`, loaded by the browser the first time a card needs one of its templates; `common.yaml` comes with the bundle. [The shipped families](template-card.md#4-the-shipped-families).
- **Hash.** A pop-up's address, `#living`, which navigating to opens and going back closes. [Navigation](cards.md#navigation).
- **Home.** The typed description of a home, `Home` in `src/home/types.ts`, that `build(home)` turns into a whole dashboard, for those who keep their dashboard in code. [The home dashboard](home.md).
- **Instance.** One use of a template: a `custom:mnml-template-card`, or a `template:` node inside another template, naming the template and giving its slots. [Placing a template](templates.md#placing-a-template).
- **Item.** The common row of a pop-up, `mnml-entity-card`: a name, an icon, a state line and controls, for an entity or a device. [Items](home.md#items-the-common-row).
- **Kind.** What a slot holds: `text`, `texts`, `number`, `icon`, `flag`, `entity`, `entities`, `object` or `objects`. [Writing a template](templates.md#writing-a-template).
- **Look.** A dashboard section's title, icon and template, which a plan may set and `lookOf()` reads, falling back to the section's own (`SECTION_LOOKS`, `src/contract/plan.ts`).
- **Part.** A node of a template's card with an `id:`, which the panel picks and a change addresses (`#lock`). `data-part` marks it on the drawn card. Not to be confused with a part as a role, or with `src/cards/parts/`, the pieces several cards share. [Changes to a shipped template](templates.md#where-templates-live).
- **Part id.** A part's `id:`, unique in its list. A released one stays, `src/templates/ids.json` lists them, and a home's own start with `my-`. [Where templates live](templates.md#where-templates-live).
- **Plan.** What the panel's builder keeps for a dashboard it made, so it can rebuild it when the home changes: its rooms, people, cars, system templates, devices and each section's look (`Plan`, `src/contract/plan.ts`). [Building a dashboard](editors.md#building-a-dashboard).
- **Pop-up.** A card with a `hash` and no `type`, opened by its hash in the popups card: a dialog on a desktop, a sheet on a phone. [The pop-up shell](cards.md#the-pop-up-shell).
- **Popups card.** `custom:mnml-popups-card`, the one card on a dashboard that holds its pop-ups and those the template cards announce. [The pop-up shell](cards.md#the-pop-up-shell).
- **Retired slot.** A slot a template no longer declares but still takes, so a configuration that gives it draws as before until the next major release. [Retired slots](templates.md#writing-a-template).
- **Role.** How a template is used, worked out and never declared: a tile, placed on a dashboard; a pop-up, brought by a tile or a part; or a part, used inside another template. [Roles](templates.md#roles).
- **Section.** One of a dashboard's groups, Rooms, Devices, People, Garage and System, each a Home Assistant section of cards. [Building a dashboard](editors.md#building-a-dashboard).
- **Shape.** A slot that several templates take, declared once in `templates/shapes.yaml` and named by `shape:`, with its fields and often its discovery rule. [Shapes](catalog.md#shapes).
- **Shipped template.** A template that comes with MNML, in `templates/*.yaml`, as opposed to the home's own, kept by the integration. [The catalog](catalog.md).
- **Slot.** A named input of a template, with a kind, and optionally a default, a discovery rule, a label and a help text; the template reads it as `[[name]]`. [Writing a template](templates.md#writing-a-template).
- **Stand for a device.** A template stands for a device when its rules anchor it to one, such as the vacuum's card; Home Assistant's card suggestions offer it for that device's entities. [Devices find themselves](templates.md#devices-find-themselves).
- **Store.** The integration's `.storage/mnml.templates`: the home's own templates and its changes to shipped ones, each with its last 10 versions, read by every user and saved by admins. [Where templates live](templates.md#where-templates-live).
- **Template index.** `TEMPLATE_INDEX`: each shipped template that stands for a device, with its anchor, the slots it discovers, its title and icon, carried in the bundle so a suggestion loads no family (`src/templates/stands.ts`, `src/templates/template-index.ts`).
- **Word.** `[[words.<name>]]` in a template: a word in the language the card is drawn in, from the words tables in `src/words/`. [Writing a template](templates.md#writing-a-template).
- **Written template.** A template as the YAML or the store holds it, its shapes named and not yet resolved (`WrittenTemplate`, `src/contract/templates.ts`); the engine reads it resolved.
