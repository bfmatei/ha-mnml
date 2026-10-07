from typing import TYPE_CHECKING, Any

from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.dashboards"
STORAGE_VERSION = 1

type Entry = dict[str, Any]


class DashboardStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._dashboards: dict[str, Entry] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        dashboards = (data or {}).get("dashboards", {})
        self._dashboards = dict(dashboards) if isinstance(dashboards, dict) else {}

    @property
    def dashboards(self) -> dict[str, Entry]:
        return dict(self._dashboards)

    async def async_save(
        self, url_path: str, plan: Entry, previous: Entry | None, user_id: str | None
    ) -> None:
        self._dashboards[url_path] = {
            "plan": plan,
            **({} if previous is None else {"previous": previous}),
            "updated": dt_util.utcnow().isoformat(),
            "by": user_id,
        }
        await self._store.async_save({"dashboards": self._dashboards})

    async def async_delete(self, url_path: str) -> bool:
        if self._dashboards.pop(url_path, None) is None:
            return False
        await self._store.async_save({"dashboards": self._dashboards})
        return True


DASHBOARD_STORE: HassKey[DashboardStore] = HassKey(f"{DOMAIN}_dashboards")
