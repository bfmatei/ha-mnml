from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.exceptions import HomeAssistantError

from custom_components.mnml import websocket
from custom_components.mnml.frontend import async_register_frontend
from custom_components.mnml.store import STORE, TemplateStore

if TYPE_CHECKING:
    from pathlib import Path

    import pytest
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.typing import (
        MockHAClientWebSocket,
        WebSocketGenerator,
    )

    from .conftest import SetupMnml

GARDEN = {"card": {"type": "custom:mnml-heading-card", "title": "Garden", "icon": "mdi:flower"}}
CHANGE = {"op": "remove", "path": ["card", "chips?", "#lock"], "base": "0123456789abcdef"}
CHIPS = ["card", "chips?"]
WRONG_CHANGES = (
    {"op": "set", "path": ["card"], "value": "x", "base": "b"},
    {"op": "set", "path": ["card"], "key": "name", "base": "b"},
    {"op": "insert", "path": CHIPS, "after": None, "value": "chip", "base": "b"},
    {"op": "insert", "path": CHIPS, "after": None, "value": {"type": "indicator"}, "base": "b"},
    {"op": "insert", "path": CHIPS, "value": {"id": "door"}, "base": "b"},
    {"op": "move", "path": CHIPS, "after": None, "base": "b"},
    {"op": "move", "path": CHIPS, "id": "ac", "after": 3, "base": "b"},
    {"op": "remove", "path": [], "base": "b"},
    {"op": "set", "path": ["__proto__"], "key": "polluted", "value": True, "base": "b"},
    {"op": "set", "path": ["card"], "key": "constructor", "value": True, "base": "b"},
    {"op": "remove", "path": ["card", ""], "base": "b"},
    {"op": "remove", "path": ["card"], "base": "b"},
    {"op": "move", "path": CHIPS, "id": "ac", "after": "ac", "base": "b"},
)


async def call(client: MockHAClientWebSocket, message: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(message)
    reply: dict[str, Any] = await client.receive_json()
    return reply


async def test_a_subscriber_gets_the_templates_then_each_save(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    reader = await hass_ws_client(hass)
    writer = await hass_ws_client(hass)
    assert (await call(reader, {"type": "mnml/templates/subscribe"}))["success"]
    first = await reader.receive_json()
    assert first["event"] == {"templates": {}}
    saved = await call(
        writer,
        {
            "type": "mnml/templates/save",
            "name": "garden",
            "entry": {"kind": "own", "template": GARDEN},
        },
    )
    assert saved["success"]
    update = await reader.receive_json()
    entry = update["event"]["templates"]["garden"]
    assert entry["kind"] == "own"
    assert entry["template"] == GARDEN
    assert "updated" in entry
    assert "history" not in entry


async def test_changes_to_a_shipped_template_are_kept_and_can_be_deleted(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    entry = {"kind": "changes", "changes": [CHANGE]}
    assert (await call(client, {"type": "mnml/templates/save", "name": "room", "entry": entry}))[
        "success"
    ]
    assert (await call(client, {"type": "mnml/templates/delete", "name": "room"}))["success"]
    gone = await call(client, {"type": "mnml/templates/delete", "name": "room"})
    assert gone["error"]["code"] == "not_found"


async def test_eleven_saves_keep_ten_earlier_versions(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    for title in range(11):
        template = {"card": {**GARDEN["card"], "title": f"Garden {title}"}}
        await call(
            client,
            {
                "type": "mnml/templates/save",
                "name": "garden",
                "entry": {"kind": "own", "template": template},
            },
        )
    history = (await call(client, {"type": "mnml/templates/history", "name": "garden"}))["result"]
    titles = [version["template"]["card"]["title"] for version in history["history"]]
    assert titles == [f"Garden {title}" for title in range(9, -1, -1)]


async def test_only_an_admin_saves_deletes_and_reads_history(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    setup_mnml: SetupMnml,
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass, hass_read_only_access_token)
    for message in (
        {
            "type": "mnml/templates/save",
            "name": "garden",
            "entry": {"kind": "own", "template": GARDEN},
        },
        {"type": "mnml/templates/delete", "name": "garden"},
        {"type": "mnml/templates/history", "name": "garden"},
    ):
        reply = await call(client, message)
        assert reply["error"]["code"] == "unauthorized", message["type"]
    assert (await call(client, {"type": "mnml/templates/subscribe"}))["success"]


async def test_a_save_of_the_wrong_shape_is_refused(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    client = await hass_ws_client(hass)
    for name, entry in (
        ("Garden!", {"kind": "own", "template": GARDEN}),
        ("garden", {"kind": "own", "template": {"title": "no card"}}),
        ("garden", {"kind": "changes", "changes": [{"op": "rename", "path": [], "base": "x"}]}),
        ("garden", {"kind": "mine", "template": GARDEN}),
        ("garden\n", {"kind": "own", "template": GARDEN}),
        ("garden", {"kind": "own", "template": {"card": None}}),
        ("garden", {"kind": "own", "template": {**GARDEN, "popups": "#garden"}}),
        *(("room", {"kind": "changes", "changes": [change]}) for change in WRONG_CHANGES),
    ):
        reply = await call(client, {"type": "mnml/templates/save", "name": name, "entry": entry})
        assert reply["error"]["code"] == "invalid_format", (name, entry)
    huge = {"card": {**GARDEN["card"], "title": "x" * 300_000}}
    reply = await call(
        client,
        {
            "type": "mnml/templates/save",
            "name": "garden",
            "entry": {"kind": "own", "template": huge},
        },
    )
    assert reply["error"]["code"] == "too_large"


async def test_a_delete_reaches_subscribers_and_keeps_the_history(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    reader = await hass_ws_client(hass)
    writer = await hass_ws_client(hass)
    entry = {"kind": "own", "template": GARDEN}
    await call(writer, {"type": "mnml/templates/save", "name": "garden", "entry": entry})
    assert (await call(reader, {"type": "mnml/templates/subscribe"}))["success"]
    assert "garden" in (await reader.receive_json())["event"]["templates"]
    assert (await call(writer, {"type": "mnml/templates/delete", "name": "garden"}))["success"]
    assert (await reader.receive_json())["event"] == {"templates": {}}
    history = (await call(writer, {"type": "mnml/templates/history", "name": "garden"}))["result"]
    assert [version["template"] for version in history["history"]] == [GARDEN]
    gone = await call(writer, {"type": "mnml/templates/delete", "name": "garden"})
    assert gone["error"]["code"] == "not_found"
    await call(writer, {"type": "mnml/templates/save", "name": "garden", "entry": entry})
    again = (await call(writer, {"type": "mnml/templates/history", "name": "garden"}))["result"]
    assert [version["template"] for version in again["history"]] == [GARDEN]


async def test_an_unsubscribe_stops_the_updates(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    reader = await hass_ws_client(hass)
    subscribed = await call(reader, {"type": "mnml/templates/subscribe"})
    await reader.receive_json()
    store = hass.data[STORE]
    assert len(store._listeners) == 1
    stopped = await call(reader, {"type": "unsubscribe_events", "subscription": subscribed["id"]})
    assert stopped["success"]
    assert store._listeners == []


async def test_a_home_keeps_at_most_so_many_templates(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    setup_mnml: SetupMnml,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await setup_mnml()
    monkeypatch.setattr(websocket, "TEMPLATES", 2)
    client = await hass_ws_client(hass)
    entry = {"kind": "own", "template": GARDEN}
    for name in ("one", "two"):
        assert (await call(client, {"type": "mnml/templates/save", "name": name, "entry": entry}))[
            "success"
        ]
    refused = await call(client, {"type": "mnml/templates/save", "name": "three", "entry": entry})
    assert refused["error"]["code"] == "too_many"
    again = await call(client, {"type": "mnml/templates/save", "name": "two", "entry": entry})
    assert again["success"], "a template already kept can still be saved"


async def test_a_store_that_cannot_be_read_leaves_the_cards_served(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    setup_mnml: SetupMnml,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unreadable(_self: object) -> None:
        msg = "the file is not JSON"
        raise HomeAssistantError(msg)

    monkeypatch.setattr(TemplateStore, "async_load", unreadable)
    entry = await setup_mnml()
    assert entry.state is ConfigEntryState.LOADED
    client = await hass_ws_client(hass)
    reply = await call(client, {"type": "mnml/templates/subscribe"})
    assert reply["error"]["code"] == "not_loaded"


async def test_a_store_broken_by_hand_leaves_the_cards_served(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    setup_mnml: SetupMnml,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def broken(_self: object) -> None:
        key = "own"
        raise KeyError(key)

    monkeypatch.setattr(TemplateStore, "async_load", broken)
    entry = await setup_mnml()
    assert entry.state is ConfigEntryState.LOADED
    client = await hass_ws_client(hass)
    reply = await call(client, {"type": "mnml/templates/subscribe"})
    assert reply["error"]["code"] == "not_loaded"


async def test_the_templates_are_read_before_the_cards_are_served(
    hass: HomeAssistant,
    setup_mnml: SetupMnml,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[bool] = []

    async def watched(hass: HomeAssistant, www: Path) -> str:
        seen.append(STORE in hass.data)
        return await async_register_frontend(hass, www)

    monkeypatch.setattr("custom_components.mnml.async_register_frontend", watched)
    await setup_mnml()
    assert seen == [True], "a page that loads the cards finds the store ready"
