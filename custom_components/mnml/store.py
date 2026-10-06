from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

STORAGE_KEY = f"{DOMAIN}.templates"
STORAGE_VERSION = 1
HISTORY = 10

type Entry = dict[str, Any]


def without_history(entry: Entry) -> Entry:
    return {key: value for key, value in entry.items() if key != "history"}


def history_of(entry: Entry | None) -> list[Entry]:
    if entry is None:
        return []
    kept = entry.get("history", [])
    return ([without_history(entry), *kept] if "kind" in entry else list(kept))[:HISTORY]


class TemplateStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._templates: dict[str, Entry] = {}
        self._listeners: list[Callable[[], None]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load()
        templates = (data or {}).get("templates", {})
        self._templates = dict(templates) if isinstance(templates, dict) else {}

    @property
    def templates(self) -> dict[str, Entry]:
        return {
            name: without_history(entry)
            for name, entry in self._templates.items()
            if "kind" in entry
        }

    def history(self, name: str) -> list[Entry]:
        return list(self._templates.get(name, {}).get("history", []))

    async def async_save(self, name: str, entry: Entry, user_id: str | None) -> None:
        self._templates[name] = {
            **entry,
            "updated": dt_util.utcnow().isoformat(),
            "by": user_id,
            "history": history_of(self._templates.get(name)),
        }
        await self._async_write()

    async def async_delete(self, name: str) -> bool:
        previous = self._templates.get(name)
        if previous is None or "kind" not in previous:
            return False
        self._templates[name] = {"history": history_of(previous)}
        await self._async_write()
        return True

    @callback
    def async_listen(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(listener)

        def remove() -> None:
            self._listeners.remove(listener)

        return remove

    async def _async_write(self) -> None:
        await self._store.async_save({"templates": self._templates})
        for listener in list(self._listeners):
            listener()


STORE: HassKey[TemplateStore] = HassKey(f"{DOMAIN}_store")
