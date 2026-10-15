from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

from homeassistant.components.frontend import remove_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError

from . import const
from .conflicts import async_hand_loaded
from .const import LOGGER
from .dashboards import DASHBOARD_STORE, DashboardStore
from .frontend import async_register_frontend, panel_url
from .issues import ISSUES, async_set_issue
from .panel import async_register_panel, async_remove_panel
from .store import STORE, TemplateStore
from .theme import (
    async_apply_default,
    async_install_theme,
    async_remove_theme,
    other_theme_files,
    theme_loaded,
    theme_target,
)
from .websocket import async_register

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.util.hass_dict import HassKey


@dataclass
class MnmlData:
    glass: bool


type MnmlConfigEntry = ConfigEntry[MnmlData]


async def async_setup_entry(hass: HomeAssistant, entry: MnmlConfigEntry) -> bool:
    if STORE not in hass.data:
        await async_load_into(
            hass,
            STORE,
            TemplateStore(hass),
            "The templates MNML keeps could not be read; the cards draw the shipped ones",
        )
    if DASHBOARD_STORE not in hass.data:
        await async_load_into(
            hass,
            DASHBOARD_STORE,
            DashboardStore(hass),
            "The dashboards MNML built could not be read; the builder starts with none",
        )
    async_register(hass)
    url = await async_register_frontend(hass, const.WWW)
    entry.async_on_unload(partial(remove_extra_js_url, hass, url))
    await async_register_panel(hass, await hass.async_add_executor_job(panel_url, const.WWW))
    entry.async_on_unload(partial(async_remove_panel, hass))
    glass = glass_of(entry)
    await async_check_home(hass, glass=glass)
    entry.runtime_data = MnmlData(glass=glass)
    await async_sync_default(hass, entry)
    entry.async_on_unload(entry.add_update_listener(async_options_updated))
    return True


class Loadable(Protocol):
    async def async_load(self) -> None: ...


async def async_load_into[S: Loadable](
    hass: HomeAssistant, key: HassKey[S], store: S, failure: str
) -> None:
    try:
        await store.async_load()
    except HomeAssistantError, OSError, ValueError, KeyError, TypeError, AttributeError:
        LOGGER.exception(failure)
        return
    hass.data[key] = store


async def async_check_home(hass: HomeAssistant, *, glass: bool) -> None:
    kept = await async_install_theme(hass, const.WWW, glass=glass)
    others = await hass.async_add_executor_job(other_theme_files, Path(hass.config.path("themes")))
    hand = await async_hand_loaded(hass)
    async_set_issue(
        hass,
        const.ISSUE_THEME_NOT_LOADED,
        raised=not kept,
        placeholders={"path": str(theme_target(hass))},
    )
    async_set_issue(
        hass,
        const.ISSUE_SECOND_THEME,
        raised=bool(others),
        placeholders={"file": str(others[0]) if others else ""},
    )
    async_set_issue(
        hass, const.ISSUE_HAND_LOADED, raised=hand is not None, placeholders={"url": hand or ""}
    )


def glass_of(entry: MnmlConfigEntry) -> bool:
    return bool(entry.options.get(const.CONF_GLASS, const.DEFAULT_GLASS))


async def async_options_updated(hass: HomeAssistant, entry: MnmlConfigEntry) -> None:
    glass = glass_of(entry)
    if glass != entry.runtime_data.glass:
        await async_check_home(hass, glass=glass)
        entry.runtime_data.glass = glass
    await async_sync_default(hass, entry)


async def async_sync_default(hass: HomeAssistant, entry: MnmlConfigEntry) -> None:
    on = bool(entry.options.get(const.CONF_DEFAULT_THEME, const.DEFAULT_DEFAULT_THEME))
    if on == bool(entry.data.get(const.APPLIED_DEFAULT_THEME, False)):
        return
    if on and not theme_loaded(hass):
        return
    if await async_apply_default(hass, on=on):
        hass.config_entries.async_update_entry(
            entry, data={**entry.data, const.APPLIED_DEFAULT_THEME: on}
        )


async def async_unload_entry(hass: HomeAssistant, _entry: MnmlConfigEntry) -> bool:
    for issue_id in ISSUES:
        async_set_issue(hass, issue_id, raised=False, placeholders={})
    return True


async def async_remove_entry(hass: HomeAssistant, _entry: MnmlConfigEntry) -> None:
    await async_remove_theme(hass)
