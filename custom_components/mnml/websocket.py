import json
from typing import Any

import probatio as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN
from .dashboards import DASHBOARD_STORE, DashboardStore
from .store import STORE, TemplateStore

REGISTERED: HassKey[bool] = HassKey(f"{DOMAIN}_websocket")
MOST = 262_144
TEMPLATES = 500
MOST_DASHBOARD = 524_288
DASHBOARDS = 100

NAME = vol.All(str, vol.Match(r"\A[a-z0-9][a-z0-9_-]{0,63}\Z"))
SEGMENT = vol.All(str, vol.Length(min=1), vol.NotIn(["__proto__", "constructor", "prototype"]))
AFTER = vol.Any(None, SEGMENT)


def not_the_card(path: list[str]) -> list[str]:
    if path == ["card"]:
        msg = "the card itself cannot be removed"
        raise vol.Invalid(msg)
    return path


def not_after_itself(change: dict[str, Any]) -> dict[str, Any]:
    if change["after"] == change["id"]:
        msg = "a part cannot move after itself"
        raise vol.Invalid(msg)
    return change


PART = vol.Schema({vol.Required("id"): SEGMENT}, extra=vol.ALLOW_EXTRA)
CHANGE = vol.Any(
    vol.Schema(
        {
            vol.Required("op"): "set",
            vol.Required("path"): [SEGMENT],
            vol.Required("key"): SEGMENT,
            vol.Required("value"): object,
            vol.Required("base"): str,
        }
    ),
    vol.Schema(
        {
            vol.Required("op"): "remove",
            vol.Required("path"): vol.All([SEGMENT], vol.Length(min=1), not_the_card),
            vol.Required("base"): str,
        }
    ),
    vol.Schema(
        {
            vol.Required("op"): "insert",
            vol.Required("path"): [SEGMENT],
            vol.Required("after"): AFTER,
            vol.Required("value"): PART,
            vol.Required("base"): str,
        }
    ),
    vol.All(
        vol.Schema(
            {
                vol.Required("op"): "move",
                vol.Required("path"): [SEGMENT],
                vol.Required("id"): SEGMENT,
                vol.Required("after"): AFTER,
                vol.Required("base"): str,
            }
        ),
        not_after_itself,
    ),
)
OWN = vol.Schema(
    {
        vol.Required("kind"): "own",
        vol.Required("template"): vol.Schema(
            {vol.Required("card"): dict, vol.Optional("popups"): [dict]}, extra=vol.ALLOW_EXTRA
        ),
    }
)
CHANGES = vol.Schema({vol.Required("kind"): "changes", vol.Required("changes"): [CHANGE]})

URL_PATH = vol.All(str, vol.Match(r"\A[a-z0-9_]+(?:-[a-z0-9_]+)+\Z"), vol.Length(max=64))
TEXT = vol.All(str, vol.Length(min=1))
OPENING = vol.In(["sheet", "dialog", "unfold"])
PLAN = vol.Schema(
    {
        vol.Required("title"): TEXT,
        vol.Required("icon"): vol.All(str, vol.Match(r"\Amdi:[a-z0-9-]+\Z")),
        vol.Required("rooms"): [
            vol.Schema({vol.Required("area"): TEXT, vol.Optional("slots"): dict})
        ],
        vol.Required("people"): [
            vol.Schema(
                {
                    vol.Required("entity"): vol.All(str, vol.Match(r"\Aperson\.[a-z0-9_]+\Z")),
                    vol.Optional("slots"): dict,
                }
            )
        ],
        vol.Required("cars"): [
            vol.Schema({vol.Required("key"): NAME, vol.Required("slots"): dict})
        ],
        vol.Required("system"): [
            vol.Schema({vol.Required("template"): NAME, vol.Optional("slots"): dict})
        ],
        vol.Required("open"): vol.Schema(
            {vol.Optional(device): OPENING for device in ("phone", "tablet", "desktop")}
        ),
    }
)
PREVIOUS = vol.Schema({vol.Required("plan"): PLAN, vol.Required("config"): dict})

type Message = dict[str, Any]


def store_of(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> TemplateStore | None:
    store = hass.data.get(STORE)
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "MNML is not loaded")
    return store


def dashboards_of(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> DashboardStore | None:
    store = hass.data.get(DASHBOARD_STORE)
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "MNML's dashboards are not loaded")
    return store


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/templates/subscribe"})
@callback
def ws_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = store_of(hass, connection, msg)
    if store is None:
        return

    @callback
    def forward() -> None:
        connection.send_message(
            websocket_api.event_message(msg["id"], {"templates": store.templates})
        )

    connection.subscriptions[msg["id"]] = store.async_listen(forward)
    connection.send_result(msg["id"])
    forward()


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/templates/save",
        vol.Required("name"): NAME,
        vol.Required("entry"): vol.Any(OWN, CHANGES),
    }
)
@websocket_api.async_response
async def ws_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = store_of(hass, connection, msg)
    if store is None:
        return
    if len(json.dumps(msg["entry"])) > MOST:
        connection.send_error(msg["id"], "too_large", f"a template is at most {MOST} bytes")
        return
    if msg["name"] not in store.templates and len(store.templates) >= TEMPLATES:
        connection.send_error(msg["id"], "too_many", f"MNML keeps at most {TEMPLATES} templates")
        return
    await store.async_save(msg["name"], msg["entry"], connection.user.id)
    connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/templates/delete", vol.Required("name"): NAME}
)
@websocket_api.async_response
async def ws_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = store_of(hass, connection, msg)
    if store is None:
        return
    if not await store.async_delete(msg["name"]):
        connection.send_error(msg["id"], "not_found", f"no template named {msg['name']}")
        return
    connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/templates/history", vol.Required("name"): NAME}
)
@callback
def ws_history(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = store_of(hass, connection, msg)
    if store is None:
        return
    connection.send_result(msg["id"], {"history": store.history(msg["name"])})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/dashboards/list"})
@callback
def ws_dashboards(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = dashboards_of(hass, connection, msg)
    if store is None:
        return
    connection.send_result(msg["id"], {"dashboards": store.dashboards})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/dashboards/save",
        vol.Required("url_path"): URL_PATH,
        vol.Required("plan"): PLAN,
        vol.Optional("previous"): PREVIOUS,
    }
)
@websocket_api.async_response
async def ws_dashboard_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = dashboards_of(hass, connection, msg)
    if store is None:
        return
    previous = msg.get("previous")
    if len(json.dumps({"plan": msg["plan"], "previous": previous})) > MOST_DASHBOARD:
        connection.send_error(
            msg["id"], "too_large", f"a dashboard is at most {MOST_DASHBOARD} bytes"
        )
        return
    if msg["url_path"] not in store.dashboards and len(store.dashboards) >= DASHBOARDS:
        connection.send_error(msg["id"], "too_many", f"MNML keeps at most {DASHBOARDS} dashboards")
        return
    await store.async_save(msg["url_path"], msg["plan"], previous, connection.user.id)
    connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/dashboards/delete", vol.Required("url_path"): URL_PATH}
)
@websocket_api.async_response
async def ws_dashboard_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: Message
) -> None:
    store = dashboards_of(hass, connection, msg)
    if store is None:
        return
    if not await store.async_delete(msg["url_path"]):
        connection.send_error(msg["id"], "not_found", f"no dashboard at {msg['url_path']}")
        return
    connection.send_result(msg["id"])


@callback
def async_register(hass: HomeAssistant) -> None:
    if hass.data.get(REGISTERED):
        return
    hass.data[REGISTERED] = True
    for command in (
        ws_subscribe,
        ws_save,
        ws_delete,
        ws_history,
        ws_dashboards,
        ws_dashboard_save,
        ws_dashboard_delete,
    ):
        websocket_api.async_register_command(hass, command)
