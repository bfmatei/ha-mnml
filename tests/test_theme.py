from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import issue_registry as ir

from custom_components.mnml.const import DOMAIN

from .conftest import THEME, SetupMnml, Themes

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant


async def test_the_theme_is_written_and_loaded(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    await setup_mnml()
    assert (config_dir / "themes/mnml-integration/mnml.yaml").read_text(encoding="utf-8") == THEME
    assert "MNML" in (await themes())["themes"]
    assert ir.async_get(hass).async_get_issue(DOMAIN, "theme_not_loaded") is None


async def test_an_unchanged_theme_is_not_written_again(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml
) -> None:
    entry = await setup_mnml()
    target = config_dir / "themes/mnml-integration/mnml.yaml"
    before = target.stat().st_mtime_ns
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert target.stat().st_mtime_ns == before


async def test_without_the_themes_include_a_repair_says_what_to_add(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml
) -> None:
    (config_dir / "configuration.yaml").write_text("", encoding="utf-8")
    await setup_mnml()
    issue = ir.async_get(hass).async_get_issue(DOMAIN, "theme_not_loaded")
    assert issue is not None
    assert issue.translation_placeholders == {
        "path": str(config_dir / "themes/mnml-integration/mnml.yaml")
    }


async def test_an_include_of_another_folder_raises_the_same_repair(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml
) -> None:
    (config_dir / "my_themes").mkdir()
    (config_dir / "configuration.yaml").write_text(
        "frontend:\n  themes: !include_dir_merge_named my_themes\n", encoding="utf-8"
    )
    await setup_mnml()
    assert ir.async_get(hass).async_get_issue(DOMAIN, "theme_not_loaded") is not None
    assert not (config_dir / "themes/mnml-integration").exists()


async def test_an_include_that_cannot_hold_the_theme_gets_it_taken_away_again(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml
) -> None:
    (config_dir / "configuration.yaml").write_text(
        "frontend:\n  themes: !include_dir_named themes\n", encoding="utf-8"
    )
    entry = await setup_mnml()
    assert entry.state is ConfigEntryState.LOADED
    assert ir.async_get(hass).async_get_issue(DOMAIN, "theme_not_loaded") is not None
    assert not (config_dir / "themes/mnml-integration").exists()


async def test_the_standalone_theme_where_hacs_puts_it_raises_a_repair(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml
) -> None:
    other = config_dir / "themes/mnml/mnml.yaml"
    other.parent.mkdir()
    other.write_text("MNML:\n  primary-color: '#654321'\n", encoding="utf-8")
    await setup_mnml()
    issue = ir.async_get(hass).async_get_issue(DOMAIN, "second_theme")
    assert issue is not None
    assert issue.translation_placeholders == {"file": str(other)}
