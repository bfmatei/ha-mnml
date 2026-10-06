from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import DOMAIN, ISSUE_HAND_LOADED, ISSUE_SECOND_THEME, ISSUE_THEME_NOT_LOADED

ISSUES = (ISSUE_THEME_NOT_LOADED, ISSUE_SECOND_THEME, ISSUE_HAND_LOADED)


def async_set_issue(
    hass: HomeAssistant, issue_id: str, *, raised: bool, placeholders: dict[str, str]
) -> None:
    if raised:
        ir.async_create_issue(
            hass,
            DOMAIN,
            issue_id,
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=issue_id,
            translation_placeholders=placeholders,
        )
    else:
        ir.async_delete_issue(hass, DOMAIN, issue_id)
