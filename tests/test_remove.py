from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant

    from .conftest import SetupMnml, Themes


async def test_removing_mnml_takes_its_theme_away(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    entry = await setup_mnml()
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert not (config_dir / "themes/mnml-integration").exists()
    assert "MNML" not in (await themes())["themes"]


async def test_removing_mnml_gives_the_default_theme_back(
    hass: HomeAssistant, setup_mnml: SetupMnml, themes: Themes
) -> None:
    entry = await setup_mnml(options={"default_theme": True})
    await hass.services.async_call(
        "frontend", "set_theme", {"name": "MNML", "mode": "light"}, blocking=True
    )
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert (await themes())["default_theme"] == "default"


async def test_removing_mnml_leaves_a_default_chosen_elsewhere_alone(
    hass: HomeAssistant, config_dir: Path, setup_mnml: SetupMnml, themes: Themes
) -> None:
    (config_dir / "themes/other.yaml").write_text(
        "Other:\n  primary-color: '#abcdef'\n", encoding="utf-8"
    )
    entry = await setup_mnml(options={"default_theme": True})
    await hass.services.async_call("frontend", "reload_themes", blocking=True)
    await hass.services.async_call(
        "frontend", "set_theme", {"name": "Other", "mode": "light"}, blocking=True
    )
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert (await themes())["default_theme"] == "Other"
