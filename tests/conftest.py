from collections.abc import Awaitable, Callable, Iterator
from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.mnml.const import DOMAIN, TITLE

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

THEME = "MNML:\n  primary-color: '#123456'\n"
INCLUDE = "frontend:\n  themes: !include_dir_merge_named themes\n"

type SetupMnml = Callable[..., Awaitable[MockConfigEntry]]
type Themes = Callable[[], Awaitable[dict[str, Any]]]


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    return


@pytest.fixture(autouse=True)
def no_listening_server() -> Iterator[None]:
    with patch("homeassistant.components.http.HomeAssistantHTTP.start", AsyncMock()):
        yield


@pytest.fixture
def www(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    folder = tmp_path / "www"
    folder.mkdir()
    (folder / "mnml-cards-loader.js").write_text(
        "await import('./mnml-cards.js');\n", encoding="utf-8"
    )
    (folder / "mnml-cards.js").write_text("export {};\n", encoding="utf-8")
    (folder / "mnml-cards-panel.js").write_text(
        "customElements.define('mnml-panel', class {});\n", encoding="utf-8"
    )
    (folder / "mnml.yaml").write_text(THEME, encoding="utf-8")
    monkeypatch.setattr("custom_components.mnml.const.WWW", folder)
    return folder


@pytest.fixture
def config_dir(hass: HomeAssistant, tmp_path: Path) -> Iterator[Path]:
    folder = tmp_path / "config"
    (folder / "themes").mkdir(parents=True)
    (folder / "configuration.yaml").write_text(INCLUDE, encoding="utf-8")
    before = hass.config.config_dir
    hass.config.config_dir = str(folder)
    yield folder
    hass.config.config_dir = before


@pytest.fixture
def setup_mnml(hass: HomeAssistant, www: Path, config_dir: Path) -> SetupMnml:
    async def setup(options: dict[str, Any] | None = None) -> MockConfigEntry:
        entry = MockConfigEntry(domain=DOMAIN, title=TITLE, options=options or {})
        entry.add_to_hass(hass)
        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        return entry

    return setup


@pytest.fixture
def themes(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> Themes:
    async def read() -> dict[str, Any]:
        client = await hass_ws_client(hass)
        await client.send_json_auto_id({"type": "frontend/get_themes"})
        message = await client.receive_json()
        result: dict[str, Any] = message["result"]
        return result

    return read
