from homeassistant.components import frontend, panel_custom
from homeassistant.core import HomeAssistant, callback

from .const import PANEL_ELEMENT, PANEL_PATH, TITLE


async def async_register_panel(hass: HomeAssistant, url: str) -> None:
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=TITLE,
        sidebar_icon="mdi:view-dashboard-edit",
        module_url=url,
        require_admin=True,
        config={},
    )


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    frontend.async_remove_panel(hass, PANEL_PATH)
