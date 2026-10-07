from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.exceptions import HomeAssistantError

from custom_components.mnml import websocket
from custom_components.mnml.dashboards import DashboardStore

if TYPE_CHECKING:
    import pytest
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.typing import (
        MockHAClientWebSocket,
        WebSocketGenerator,
    )

    from .conftest import SetupMnml

PLAN = {
    "title": "Home",
    "icon": "mdi:home-variant",
    "rooms": [{"area": "kitchen"}, {"area": "living", "slots": {"name": "Lounge"}}],
    "people": [{"entity": "person.jane"}],
    "cars": [{"key": "sedan", "slots": {"metadata": "sensor.sedan"}}],
    "system": [{"template": "home-assistant"}],
    "open": {"tablet": "unfold", "desktop": "unfold"},
}
CONFIG = {"title": "Home", "views": [{"title": "Home", "path": "home", "sections": []}]}


async def call(client: MockHAClientWebSocket, message: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(message)
    reply: dict[str, Any] = await client.receive_json()
    return reply


async def listed(client: MockHAClientWebSocket) -> dict[str, Any]:
    reply = await call(client, {"type": "mnml/dashboards/list"})
    dashboards: dict[str, Any] = reply["result"]["dashboards"]
    return dashboards


async def test_a_built_dashboard_is_kept_with_its_plan_when_and_by_whom(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_storage: dict[str, Any],
    setup_mnml: SetupMnml,
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    assert await listed(client) == {}
    saved = await call(
        client, {"type": "mnml/dashboards/save", "url_path": "dashboard-home", "plan": PLAN}
    )
    assert saved["success"]
    entry = (await listed(client))["dashboard-home"]
    assert entry["plan"] == PLAN
    assert "updated" in entry
    assert entry["by"] is not None
    assert "previous" not in entry
    assert hass_storage["mnml.dashboards"]["data"]["dashboards"]["dashboard-home"]["plan"] == PLAN


async def test_a_rebuild_keeps_the_version_it_replaced_and_an_undo_lets_it_go(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    await call(client, {"type": "mnml/dashboards/save", "url_path": "dashboard-home", "plan": PLAN})
    rebuilt = {**PLAN, "title": "Our flat"}
    previous = {"plan": PLAN, "config": CONFIG}
    reply = await call(
        client,
        {
            "type": "mnml/dashboards/save",
            "url_path": "dashboard-home",
            "plan": rebuilt,
            "previous": previous,
        },
    )
    assert reply["success"]
    entry = (await listed(client))["dashboard-home"]
    assert entry["plan"] == rebuilt
    assert entry["previous"] == previous
    await call(client, {"type": "mnml/dashboards/save", "url_path": "dashboard-home", "plan": PLAN})
    assert "previous" not in (await listed(client))["dashboard-home"]


async def test_forgetting_a_dashboard_drops_it_from_the_list(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    await call(client, {"type": "mnml/dashboards/save", "url_path": "dashboard-home", "plan": PLAN})
    forgot = await call(client, {"type": "mnml/dashboards/delete", "url_path": "dashboard-home"})
    assert forgot["success"]
    assert await listed(client) == {}
    again = await call(client, {"type": "mnml/dashboards/delete", "url_path": "dashboard-home"})
    assert again["error"]["code"] == "not_found"


async def test_only_an_admin_lists_saves_and_forgets_dashboards(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    setup_mnml: SetupMnml,
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass, hass_read_only_access_token)
    for message in (
        {"type": "mnml/dashboards/list"},
        {"type": "mnml/dashboards/save", "url_path": "dashboard-home", "plan": PLAN},
        {"type": "mnml/dashboards/delete", "url_path": "dashboard-home"},
    ):
        reply = await call(client, message)
        assert reply["error"]["code"] == "unauthorized", message["type"]


async def test_a_dashboard_of_the_wrong_shape_is_refused(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    for url_path, plan, extra in (
        ("home", PLAN, {}),
        ("Dashboard-Home", PLAN, {}),
        ("dashboard-home\n", PLAN, {}),
        ("my_home-x", PLAN, {}),
        ("dashboard-" + "x" * 60, PLAN, {}),
        ("dashboard-home", {**PLAN, "title": ""}, {}),
        ("dashboard-home", {**PLAN, "icon": "home"}, {}),
        ("dashboard-home", {**PLAN, "rooms": [{"slots": {}}]}, {}),
        ("dashboard-home", {**PLAN, "people": [{"entity": "sensor.jane"}]}, {}),
        ("dashboard-home", {**PLAN, "cars": [{"key": "sedan"}]}, {}),
        ("dashboard-home", {**PLAN, "system": [{"template": "Home Assistant"}]}, {}),
        ("dashboard-home", {**PLAN, "open": {"watch": "sheet"}}, {}),
        ("dashboard-home", {**PLAN, "open": {"phone": "drawer"}}, {}),
        ("dashboard-home", {key: value for key, value in PLAN.items() if key != "open"}, {}),
        ("dashboard-home", PLAN, {"previous": {"plan": PLAN}}),
        ("dashboard-home", PLAN, {"previous": {"config": CONFIG}}),
    ):
        reply = await call(
            client,
            {"type": "mnml/dashboards/save", "url_path": url_path, "plan": plan, **extra},
        )
        assert reply["error"]["code"] == "invalid_format", (url_path, plan, extra)
    huge = {"plan": PLAN, "config": {**CONFIG, "title": "x" * 600_000}}
    reply = await call(
        client,
        {
            "type": "mnml/dashboards/save",
            "url_path": "dashboard-home",
            "plan": PLAN,
            "previous": huge,
        },
    )
    assert reply["error"]["code"] == "too_large"


async def test_a_home_keeps_at_most_so_many_dashboards(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    setup_mnml: SetupMnml,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await setup_mnml()
    monkeypatch.setattr(websocket, "DASHBOARDS", 2)
    client = await hass_ws_client(hass)
    for url_path in ("dashboard-one", "dashboard-two"):
        message = {"type": "mnml/dashboards/save", "url_path": url_path, "plan": PLAN}
        assert (await call(client, message))["success"]
    refused = await call(
        client, {"type": "mnml/dashboards/save", "url_path": "dashboard-three", "plan": PLAN}
    )
    assert refused["error"]["code"] == "too_many"
    again = await call(
        client, {"type": "mnml/dashboards/save", "url_path": "dashboard-two", "plan": PLAN}
    )
    assert again["success"], "a dashboard already kept can still be rebuilt"


async def test_a_dashboard_store_that_cannot_be_read_leaves_mnml_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    setup_mnml: SetupMnml,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unreadable(_self: object) -> None:
        msg = "the file is not JSON"
        raise HomeAssistantError(msg)

    monkeypatch.setattr(DashboardStore, "async_load", unreadable)
    entry = await setup_mnml()
    assert entry.state is ConfigEntryState.LOADED
    client = await hass_ws_client(hass)
    reply = await call(client, {"type": "mnml/dashboards/list"})
    assert reply["error"]["code"] == "not_loaded"
    templates = await call(client, {"type": "mnml/templates/subscribe"})
    assert templates["success"], "the templates are kept apart"


async def test_the_dashboards_survive_a_restart(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_storage: dict[str, Any],
    setup_mnml: SetupMnml,
) -> None:
    hass_storage["mnml.dashboards"] = {
        "version": 1,
        "key": "mnml.dashboards",
        "data": {"dashboards": {"dashboard-home": {"plan": PLAN, "updated": "t", "by": None}}},
    }
    await setup_mnml()
    client = await hass_ws_client(hass)
    assert (await listed(client))["dashboard-home"]["plan"] == PLAN


async def test_a_plan_may_give_its_sections_their_look(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    sections = {
        "rooms": {"title": "Spaces", "icon": "mdi:home-floor-1", "template": "my-room"},
        "people": {"template": "person"},
        "garage": {"title": "Cars"},
        "system": {"title": "Servers", "icon": "mdi:server"},
    }
    saved = await call(
        client,
        {
            "type": "mnml/dashboards/save",
            "url_path": "dashboard-home",
            "plan": {**PLAN, "sections": sections},
        },
    )
    assert saved["success"]
    assert (await listed(client))["dashboard-home"]["plan"]["sections"] == sections
    for wrong in (
        {"system": {"template": "home-assistant"}},
        {"attic": {"title": "Attic"}},
        {"rooms": {"icon": "floor"}},
        {"rooms": {"template": "My Room"}},
        {"rooms": {"title": ""}},
    ):
        reply = await call(
            client,
            {
                "type": "mnml/dashboards/save",
                "url_path": "dashboard-home",
                "plan": {**PLAN, "sections": wrong},
            },
        )
        assert reply["error"]["code"] == "invalid_format", wrong
