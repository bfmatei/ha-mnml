from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.dashboards"
STORAGE_VERSION = 1

type Plan = dict[str, Any]


class Previous(TypedDict):
    plan: Plan
    config: dict[str, Any]


class Built(TypedDict):
    plan: Plan
    previous: NotRequired[Previous]
    updated: str
    by: str | None


class Stored(TypedDict):
    dashboards: dict[str, Built]


class DashboardStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[Stored] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._dashboards: dict[str, Built] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        dashboards = {} if data is None else data.get("dashboards", {})
        self._dashboards = dict(dashboards) if isinstance(dashboards, dict) else {}

    @property
    def dashboards(self) -> dict[str, Built]:
        return dict(self._dashboards)

    async def async_save(
        self, url_path: str, plan: Plan, previous: Previous | None, user_id: str | None
    ) -> None:
        built: Built = {"plan": plan, "updated": dt_util.utcnow().isoformat(), "by": user_id}
        self._dashboards[url_path] = built if previous is None else {**built, "previous": previous}
        await self._store.async_save({"dashboards": self._dashboards})

    async def async_delete(self, url_path: str) -> bool:
        if self._dashboards.pop(url_path, None) is None:
            return False
        await self._store.async_save({"dashboards": self._dashboards})
        return True


DASHBOARD_STORE: HassKey[DashboardStore] = HassKey(f"{DOMAIN}_dashboards")
