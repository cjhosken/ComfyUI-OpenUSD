from .utils import CONVERTERS


class CreateUSDColor:
    """Create a USD Color value (color3f, color3d, color4f, etc.)."""

    CATEGORY = "3d/usd/type"
    FUNCTION = "create_color"
    RETURN_TYPES = ("USD_VALUE",)
    RETURN_NAMES = ("color",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "color": ("COLOR", {"default": "#ccccccff"}),
                "color_type": (
                    [
                        "color3f", "color3d", "color3h",
                        "color4f", "color4d", "color4h",
                    ],
                    {"default": "color3f"},
                ),
            }
        }

    def create_color(self, color: str, color_type: str):
        if color_type not in CONVERTERS:
            raise TypeError(f"Unsupported color type: {color_type}")

        entry = CONVERTERS[color_type]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry
        value = ctor(color)

        return (
            {
                "data": value,
                "type": color_type,
            },
        )