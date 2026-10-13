from typing import TYPE_CHECKING

from homeassistant.config_entries import SOURCE_USER, ConfigEntryState

from custom_components.mnml.const import CONF_DEFAULT_THEME, CONF_GLASS, DOMAIN
from custom_components.mnml.theme import async_apply_default

from .conftest import INCLUDE

if TYPE_CHECKING:
    from pathlib import Path

    import pytest
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


async def test_the_answer_of_the_setup_form_makes_mnml_the_default_in_both_modes(
    hass: HomeAssistant, www: Path, config_dir: Path, themes: Themes
) -> None:
    flow = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    await hass.config_entries.flow.async_configure(
        flow["flow_id"], {CONF_GLASS: True, CONF_DEFAULT_THEME: True}
    )
    await hass.async_block_till_done()
    result = await themes()
    assert result["default_theme"] == "MNML"
    assert result["default_dark_theme"] == "MNML"


async def test_a_restart_leaves_a_default_chosen_since_alone(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    (config_dir / "themes/other.yaml").write_text(
        "Other:\n  primary-color: '#abcdef'\n", encoding="utf-8"
    )
    entry = await setup_mnml({CONF_DEFAULT_THEME: True})
    assert (await themes())["default_theme"] == "MNML"
    await hass.services.async_call(
        "frontend", "set_theme", {"name": "Other", "mode": "light"}, blocking=True
    )
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    result = await themes()
    assert result["default_theme"] == "Other"
    assert result["default_dark_theme"] == "MNML"


async def test_turned_on_before_the_theme_loads_mnml_becomes_the_default_once_it_does(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    (config_dir / "configuration.yaml").write_text("", encoding="utf-8")
    entry = await setup_mnml()
    await save_options(hass, entry, on=True)
    assert entry.state is ConfigEntryState.LOADED
    assert (await themes())["default_theme"] == "default"
    (config_dir / "configuration.yaml").write_text(INCLUDE, encoding="utf-8")
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    result = await themes()
    assert result["default_theme"] == "MNML"
    assert result["default_dark_theme"] == "MNML"


async def test_a_default_home_assistant_refuses_is_logged_and_not_raised(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, caplog: pytest.LogCaptureFixture
) -> None:
    (config_dir / "configuration.yaml").write_text("", encoding="utf-8")
    await setup_mnml()
    assert not await async_apply_default(hass, on=True)
    assert "could not set its default theme to MNML" in caplog.text
