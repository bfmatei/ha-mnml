from typing import TYPE_CHECKING

from custom_components.mnml.const import CONF_DEFAULT_THEME

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from .conftest import SetupMnml, Themes


async def save_options(hass: HomeAssistant, entry: MockConfigEntry, *, on: bool) -> None:
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(flow["flow_id"], {CONF_DEFAULT_THEME: on})
    await hass.async_block_till_done()


async def test_turning_the_option_on_makes_mnml_the_default_in_both_modes(
    hass: HomeAssistant, setup_mnml: SetupMnml, themes: Themes
) -> None:
    entry = await setup_mnml()
    await save_options(hass, entry, on=True)
    result = await themes()
    assert result["default_theme"] == "MNML"
    assert result["default_dark_theme"] == "MNML"


async def test_turning_it_off_gives_the_default_back(
    hass: HomeAssistant, setup_mnml: SetupMnml, themes: Themes
) -> None:
    entry = await setup_mnml()
    await save_options(hass, entry, on=True)
    await save_options(hass, entry, on=False)
    result = await themes()
    assert result["default_theme"] == "default"
    assert result["default_dark_theme"] is None


async def test_saving_the_options_unchanged_leaves_another_default_alone(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    (config_dir / "themes/other.yaml").write_text(
        "Other:\n  primary-color: '#abcdef'\n", encoding="utf-8"
    )
    entry = await setup_mnml()
    await hass.services.async_call("frontend", "reload_themes", blocking=True)
    await hass.services.async_call("frontend", "set_theme", {"name": "Other"}, blocking=True)
    await save_options(hass, entry, on=False)
    assert (await themes())["default_theme"] == "Other"


async def test_turning_it_off_leaves_a_default_chosen_since_alone(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    (config_dir / "themes/other.yaml").write_text(
        "Other:\n  primary-color: '#abcdef'\n", encoding="utf-8"
    )
    entry = await setup_mnml()
    await hass.services.async_call("frontend", "reload_themes", blocking=True)
    await save_options(hass, entry, on=True)
    await hass.services.async_call(
        "frontend", "set_theme", {"name": "Other", "mode": "light"}, blocking=True
    )
    await save_options(hass, entry, on=False)
    result = await themes()
    assert result["default_theme"] == "Other"
    assert result["default_dark_theme"] is None
