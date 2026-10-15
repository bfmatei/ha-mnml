from typing import TYPE_CHECKING, Any, Literal, NotRequired, TypedDict, final

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

if TYPE_CHECKING:
    from collections.abc import Callable

STORAGE_KEY = f"{DOMAIN}.templates"
STORAGE_VERSION = 1
HISTORY = 10


class Saved(TypedDict):
    kind: Literal["own", "changes"]
    template: NotRequired[dict[str, Any]]
    changes: NotRequired[list[dict[str, Any]]]


class Kept(Saved):
    updated: str
    by: str | None
    history: NotRequired[list[Kept]]


@final
class Deleted(TypedDict):
    history: list[Kept]


class Stored(TypedDict):
    templates: dict[str, Kept | Deleted]


def without_history(entry: Kept) -> Kept:
    kept = entry.copy()
    kept.pop("history", None)
    return kept


def history_of(entry: Kept | Deleted | None) -> list[Kept]:
    if entry is None:
        return []
    kept = entry.get("history", [])
    return ([without_history(entry), *kept] if "kind" in entry else list(kept))[:HISTORY]


class TemplateStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[Stored] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._templates: dict[str, Kept | Deleted] = {}
        self._listeners: list[Callable[[], None]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load()
        templates = {} if data is None else data.get("templates", {})
        self._templates = dict(templates) if isinstance(templates, dict) else {}

    @property
    def templates(self) -> dict[str, Kept]:
        return {
            name: without_history(entry)
            for name, entry in self._templates.items()
            if "kind" in entry
        }

    def history(self, name: str) -> list[Kept]:
        entry = self._templates.get(name)
        return [] if entry is None else list(entry.get("history", []))

    async def async_save(self, name: str, entry: Saved, user_id: str | None) -> None:
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
