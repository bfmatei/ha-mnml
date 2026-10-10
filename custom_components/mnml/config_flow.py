from typing import Any

import probatio as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback

from .const import CONF_DEFAULT_THEME, CONF_GLASS, DOMAIN, TITLE


def options_schema(*, glass: bool, default_theme: bool) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_GLASS, default=glass): bool,
            vol.Required(CONF_DEFAULT_THEME, default=default_theme): bool,
        }
    )


class MnmlConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=TITLE, data={}, options=user_input)
        return self.async_show_form(
            step_id="user", data_schema=options_schema(glass=True, default_theme=False)
        )

    @staticmethod
    @callback
    def async_get_options_flow(_config_entry: ConfigEntry) -> OptionsFlow:
        return MnmlOptionsFlow()


class MnmlOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        options = self.config_entry.options
        schema = options_schema(
            glass=bool(options.get(CONF_GLASS, True)),
            default_theme=bool(options.get(CONF_DEFAULT_THEME, False)),
        )
        return self.async_show_form(step_id="init", data_schema=schema)
