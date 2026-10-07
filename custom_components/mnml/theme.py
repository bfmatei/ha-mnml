import shutil
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING

import probatio as vol
from homeassistant.components.frontend import (
    DATA_DEFAULT_DARK_THEME,
    DATA_DEFAULT_THEME,
    DATA_THEMES,
)
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util.file import write_utf8_file
from homeassistant.util.yaml import load_yaml

from .const import THEME_FILE, THEME_FOLDER, THEME_NAME

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


def theme_target(hass: HomeAssistant) -> Path:
    return Path(hass.config.path("themes", THEME_FOLDER, THEME_FILE))


def write_theme(source: Path, target: Path) -> bool:
    text = source.read_text(encoding="utf-8")
    if target.is_file() and target.read_text(encoding="utf-8") == text:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    write_utf8_file(str(target), text)
    return True


async def async_reload_themes(hass: HomeAssistant) -> bool:
    try:
        await hass.services.async_call("frontend", "reload_themes", blocking=True)
    except HomeAssistantError, vol.Invalid:
        return False
    return True


async def async_install_theme(hass: HomeAssistant, www: Path) -> bool:
    target = theme_target(hass)
    written = await hass.async_add_executor_job(write_theme, www / THEME_FILE, target)
    reloaded = await async_reload_themes(hass) if written else True
    loaded = reloaded and THEME_NAME in hass.data.get(DATA_THEMES, {})
    if not loaded:
        await hass.async_add_executor_job(partial(shutil.rmtree, target.parent, ignore_errors=True))
    return loaded


def other_theme_files(themes: Path) -> list[Path]:
    if not themes.is_dir():
        return []
    found: list[Path] = []
    for path in sorted(themes.rglob("*.y*ml")):
        if path.relative_to(themes).parts[0] == THEME_FOLDER:
            continue
        try:
            content = load_yaml(path)
        except HomeAssistantError, OSError:
            continue
        if isinstance(content, dict) and THEME_NAME in content:
            found.append(path)
    return found


async def async_remove_theme(hass: HomeAssistant) -> None:
    folder = theme_target(hass).parent
    await hass.async_add_executor_job(partial(shutil.rmtree, folder, ignore_errors=True))
    await async_reload_themes(hass)


async def async_apply_default(hass: HomeAssistant, *, on: bool) -> None:
    for mode, key in (("light", DATA_DEFAULT_THEME), ("dark", DATA_DEFAULT_DARK_THEME)):
        if on:
            name = THEME_NAME
        elif hass.data.get(key) == THEME_NAME:
            name = "none"
        else:
            continue
        await hass.services.async_call(
            "frontend", "set_theme", {"name": name, "mode": mode}, blocking=True
        )
