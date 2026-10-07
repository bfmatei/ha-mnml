from typing import TYPE_CHECKING

from homeassistant.config_entries import SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType

from custom_components.mnml.const import DOMAIN, TITLE

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant


async def test_adding_mnml_asks_nothing(hass: HomeAssistant, www: Path, config_dir: Path) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == TITLE


async def test_mnml_is_added_once(hass: HomeAssistant, www: Path, config_dir: Path) -> None:
    await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    await hass.async_block_till_done()
    second = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert second["type"] is FlowResultType.ABORT
    assert second["reason"] == "single_instance_allowed"
