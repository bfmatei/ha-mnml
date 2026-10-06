import hashlib
from pathlib import Path

from homeassistant.components.frontend import DATA_PANELS
from homeassistant.core import HomeAssistant

from .conftest import SetupMnml


async def test_the_panel_is_in_the_sidebar_for_admins_by_its_hash(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    panel = hass.data[DATA_PANELS]["mnml"]
    digest = hashlib.sha256((www / "mnml-cards-panel.js").read_bytes()).hexdigest()[:8]
    assert panel.require_admin is True
    assert panel.sidebar_title == "MNML"
    config = panel.config
    assert config is not None
    custom = config["_panel_custom"]
    assert custom["module_url"] == f"/mnml-files/mnml-cards-panel.js?v={digest}"
    assert custom["name"] == "mnml-panel"


async def test_unloading_takes_the_panel_away_and_a_reload_brings_it_back(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    entry = await setup_mnml()
    await hass.config_entries.async_unload(entry.entry_id)
    assert "mnml" not in hass.data[DATA_PANELS]
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert "mnml" in hass.data[DATA_PANELS]
