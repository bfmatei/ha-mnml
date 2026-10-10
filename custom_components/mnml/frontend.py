import hashlib
from typing import TYPE_CHECKING

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.exceptions import ConfigEntryError
from homeassistant.util.hass_dict import HassKey

from .const import BUNDLE, DOMAIN, LOADER, PANEL, THEME_FILE, THEME_FLAT_FILE, URL_BASE

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant

SERVED: HassKey[set[str]] = HassKey(f"{DOMAIN}_served")
BUILT = (LOADER, BUNDLE, PANEL, THEME_FILE, THEME_FLAT_FILE)


def loader_url(www: Path) -> str:
    missing = [name for name in BUILT if not (www / name).is_file()]
    if missing:
        names = ", ".join(missing)
        message = f"{names} missing from {www}: MNML was installed without its built frontend"
        raise ConfigEntryError(message)
    content = (www / LOADER).read_bytes() + (www / BUNDLE).read_bytes()
    digest = hashlib.sha256(content).hexdigest()[:8]
    return f"{URL_BASE}/{LOADER}?v={digest}"


def panel_url(www: Path) -> str:
    digest = hashlib.sha256((www / PANEL).read_bytes()).hexdigest()[:8]
    return f"{URL_BASE}/{PANEL}?v={digest}"


async def async_register_frontend(hass: HomeAssistant, www: Path) -> str:
    url = await hass.async_add_executor_job(loader_url, www)
    served = hass.data.setdefault(SERVED, set())
    if URL_BASE not in served:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL_BASE, str(www), cache_headers=True)]
        )
        served.add(URL_BASE)
    add_extra_js_url(hass, url)
    return url
