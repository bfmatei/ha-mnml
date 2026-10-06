from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from homeassistant.setup import async_setup_component

from custom_components.mnml.const import DOMAIN

from .conftest import SetupMnml


async def test_a_resource_stored_in_the_ui_raises_a_repair(
    hass: HomeAssistant, setup_mnml: SetupMnml
) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    data: Any = hass.data["lovelace"]
    resources: Any = data["resources"] if isinstance(data, dict) else data.resources
    await resources.async_get_info()
    await resources.async_create_item({"res_type": "module", "url": "/local/mnml-cards.js?v=1"})
    await setup_mnml()
    issue = ir.async_get(hass).async_get_issue(DOMAIN, "hand_loaded_bundle")
    assert issue is not None
    assert issue.translation_placeholders == {"url": "/local/mnml-cards.js?v=1"}


async def test_a_resource_in_yaml_mode_raises_a_repair(
    hass: HomeAssistant, setup_mnml: SetupMnml
) -> None:
    resources = [{"url": "/local/mnml-cards.js", "type": "module"}]
    assert await async_setup_component(
        hass, "lovelace", {"lovelace": {"mode": "yaml", "resources": resources}}
    )
    await setup_mnml()
    assert ir.async_get(hass).async_get_issue(DOMAIN, "hand_loaded_bundle") is not None


async def test_no_hand_loaded_resource_no_repair(
    hass: HomeAssistant, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    assert ir.async_get(hass).async_get_issue(DOMAIN, "hand_loaded_bundle") is None
