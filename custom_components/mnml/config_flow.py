from typing import Any

import probatio as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback

from .const import CONF_DEFAULT_THEME, DOMAIN, TITLE


class MnmlConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, _user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return self.async_create_entry(title=TITLE, data={})

    @staticmethod
    @callback
    def async_get_options_flow(_config_entry: ConfigEntry) -> OptionsFlow:
        return MnmlOptionsFlow()


class MnmlOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        current = bool(self.config_entry.options.get(CONF_DEFAULT_THEME, False))
        schema = vol.Schema({vol.Required(CONF_DEFAULT_THEME, default=current): bool})
        return self.async_show_form(step_id="init", data_schema=schema)
