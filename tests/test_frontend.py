import hashlib
from typing import TYPE_CHECKING
from unittest.mock import patch

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.config_entries import ConfigEntryState

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

    from .conftest import SetupMnml


def expected_url(www: Path) -> str:
    content = (www / "mnml-cards-loader.js").read_bytes() + (www / "mnml-cards.js").read_bytes()
    digest = hashlib.sha256(content).hexdigest()[:8]
    return f"/mnml-files/mnml-cards-loader.js?v={digest}"


def mnml_urls(hass: HomeAssistant) -> list[str]:
    return [url for url in hass.data[DATA_EXTRA_MODULE_URL].urls if url.startswith("/mnml-files/")]


async def test_the_loader_is_on_every_page_by_the_hash_of_what_it_loads(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    await setup_mnml()
    assert mnml_urls(hass) == [expected_url(www)]


async def test_the_loader_and_the_bundle_are_served(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml, hass_client: ClientSessionGenerator
) -> None:
    await setup_mnml()
    client = await hass_client()
    loader = await client.get("/mnml-files/mnml-cards-loader.js")
    bundle = await client.get("/mnml-files/mnml-cards.js")
    assert loader.status == 200
    assert bundle.status == 200
    assert await bundle.text() == "export {};\n"


async def test_unloading_takes_the_loader_off(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    entry = await setup_mnml()
    await hass.config_entries.async_unload(entry.entry_id)
    assert mnml_urls(hass) == []


async def test_a_reload_after_a_rebuild_registers_only_the_new_loader(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    entry = await setup_mnml()
    before = expected_url(www)
    (www / "mnml-cards.js").write_text("export const rebuilt = 1;\n", encoding="utf-8")
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert mnml_urls(hass) == [expected_url(www)]
    assert before not in mnml_urls(hass)


async def test_an_install_without_the_built_frontend_fails_setup_and_says_what_is_missing(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    (www / "mnml-cards.js").unlink()
    (www / "mnml.yaml").unlink()
    (www / "mnml-flat.yaml").unlink()
    entry = await setup_mnml()
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert "mnml-cards.js, mnml.yaml, mnml-flat.yaml missing" in str(entry.reason)
    assert mnml_urls(hass) == []


async def test_a_setup_that_fails_after_the_loader_is_added_leaves_no_loader(
    hass: HomeAssistant, www: Path, setup_mnml: SetupMnml
) -> None:
    with patch("custom_components.mnml.other_theme_files", side_effect=RuntimeError("broken")):
        entry = await setup_mnml()
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert mnml_urls(hass) == []
