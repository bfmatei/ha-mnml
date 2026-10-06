from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import BUNDLE, URL_BASE


async def async_hand_loaded(hass: HomeAssistant) -> str | None:
    data: Any = hass.data.get("lovelace")
    resources: Any = getattr(data, "resources", None)
    if resources is None:
        return None
    try:
        await resources.async_get_info()
        items = resources.async_items() or []
    except (AttributeError, TypeError, HomeAssistantError):
        return None
    for item in items:
        url = str(item.get("url", ""))
        if BUNDLE in url and not url.startswith(f"{URL_BASE}/"):
            return url
    return None
