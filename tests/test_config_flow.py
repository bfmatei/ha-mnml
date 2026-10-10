from typing import TYPE_CHECKING

from homeassistant.config_entries import SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType

from custom_components.mnml.const import CONF_DEFAULT_THEME, CONF_GLASS, DOMAIN, TITLE

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant


async def test_adding_mnml_asks_for_the_design_and_the_default_theme(
    hass: HomeAssistant, www: Path, config_dir: Path
) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"
    created = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_GLASS: False, CONF_DEFAULT_THEME: True}
    )
    assert created["type"] is FlowResultType.CREATE_ENTRY
    assert created["title"] == TITLE
    assert created["options"] == {CONF_GLASS: False, CONF_DEFAULT_THEME: True}


async def test_the_form_offers_the_glass_design_and_no_default_theme(
    hass: HomeAssistant, www: Path, config_dir: Path
) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    created = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert created["options"] == {CONF_GLASS: True, CONF_DEFAULT_THEME: False}


async def test_mnml_is_added_once(hass: HomeAssistant, www: Path, config_dir: Path) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    await hass.config_entries.flow.async_configure(result["flow_id"], {})
    await hass.async_block_till_done()
    second = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert second["type"] is FlowResultType.ABORT
    assert second["reason"] == "single_instance_allowed"
