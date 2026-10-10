import logging
from pathlib import Path
from typing import Final

DOMAIN: Final = "mnml"
TITLE: Final = "MNML"
URL_BASE: Final = "/mnml-files"
BUNDLE: Final = "mnml-cards.js"
LOADER: Final = "mnml-cards-loader.js"
PANEL: Final = "mnml-cards-panel.js"
PANEL_PATH: Final = "mnml"
PANEL_ELEMENT: Final = "mnml-panel"
THEME_FILE: Final = "mnml.yaml"
THEME_FLAT_FILE: Final = "mnml-flat.yaml"
THEME_NAME: Final = "MNML"
THEME_FOLDER: Final = "mnml-integration"
CONF_DEFAULT_THEME: Final = "default_theme"
CONF_GLASS: Final = "glass"
ISSUE_THEME_NOT_LOADED: Final = "theme_not_loaded"
ISSUE_HAND_LOADED: Final = "hand_loaded_bundle"
ISSUE_SECOND_THEME: Final = "second_theme"
WWW = Path(__file__).parent / "www"
LOGGER: Final = logging.getLogger(__package__)
