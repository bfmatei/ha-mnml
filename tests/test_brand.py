from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.setup import async_setup_component
from PIL import Image

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

BRAND = Path(__file__).parent.parent / "custom_components" / "mnml" / "brand"
ICONS = (
    ("icon.png", 256),
    ("icon@2x.png", 512),
    ("dark_icon.png", 256),
    ("dark_icon@2x.png", 512),
)


def test_each_icon_is_a_square_png_with_transparent_corners_in_both_sizes() -> None:
    for name, size in ICONS:
        with Image.open(BRAND / name) as image:
            assert image.format == "PNG"
            assert image.size == (size, size)
            assert image.mode == "RGBA"
            assert image.getchannel("A").getpixel((0, 0)) == 0, f"{name} has a transparent corner"


def test_the_light_and_the_dark_icon_differ() -> None:
    assert (BRAND / "icon.png").read_bytes() != (BRAND / "dark_icon.png").read_bytes()


async def test_home_assistant_serves_the_icon_of_each_theme_for_every_variant(
    hass: HomeAssistant, hass_client: ClientSessionGenerator
) -> None:
    assert await async_setup_component(hass, "brands", {})
    client = await hass_client()
    files = {name: (BRAND / name).read_bytes() for name, _size in ICONS}
    for name, expected in (
        ("icon.png", "icon.png"),
        ("icon@2x.png", "icon@2x.png"),
        ("dark_icon.png", "dark_icon.png"),
        ("dark_icon@2x.png", "dark_icon@2x.png"),
        ("logo.png", "icon.png"),
        ("dark_logo.png", "dark_icon.png"),
    ):
        response = await client.get(f"/api/brands/integration/mnml/{name}")
        assert response.status == 200, name
        assert await response.read() == files[expected], name
