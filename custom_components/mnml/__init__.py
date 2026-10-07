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
    theme_target,
)
from .websocket import async_register

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.util.hass_dict import HassKey


@dataclass
class MnmlData:
    url: str
    default_theme: bool


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
    try:
        await async_register_panel(hass, await hass.async_add_executor_job(panel_url, const.WWW))
    except Exception:
        remove_extra_js_url(hass, url)
        raise
    try:
        await async_check_home(hass)
    except Exception:
        remove_extra_js_url(hass, url)
        async_remove_panel(hass)
        raise
    entry.async_on_unload(partial(remove_extra_js_url, hass, url))
    entry.async_on_unload(partial(async_remove_panel, hass))
    entry.runtime_data = MnmlData(
        url=url, default_theme=bool(entry.options.get(const.CONF_DEFAULT_THEME, False))
    )
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


async def async_check_home(hass: HomeAssistant) -> None:
    loaded = await async_install_theme(hass, const.WWW)
    others = await hass.async_add_executor_job(other_theme_files, Path(hass.config.path("themes")))
    hand = await async_hand_loaded(hass)
    async_set_issue(
        hass,
        const.ISSUE_THEME_NOT_LOADED,
        raised=not loaded,
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


async def async_options_updated(hass: HomeAssistant, entry: MnmlConfigEntry) -> None:
    on = bool(entry.options.get(const.CONF_DEFAULT_THEME, False))
    if on != entry.runtime_data.default_theme:
        await async_apply_default(hass, on=on)
        entry.runtime_data.default_theme = on


async def async_unload_entry(hass: HomeAssistant, _entry: MnmlConfigEntry) -> bool:
    for issue_id in ISSUES:
        async_set_issue(hass, issue_id, raised=False, placeholders={})
    return True


async def async_remove_entry(hass: HomeAssistant, _entry: MnmlConfigEntry) -> None:
    await async_remove_theme(hass)
