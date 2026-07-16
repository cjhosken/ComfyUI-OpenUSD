from .utils import CONVERTERS


class CreateUSDColor:
    CATEGORY = "3d/usd/type"
    FUNCTION = "create_color"
    RETURN_TYPES = ("USD_VALUE",)
    RETURN_NAMES = ("color",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "color": ("COLOR", {"default": "#ccccccff"}),
                "color_type": ([
                    "color3f", "color3d", "color3h",
                    "color4f", "color4d", "color4h",
                ], {"default": "color3f"}),
            }
        }

    def create_color(self, color, color_type):
        if color_type not in CONVERTERS:
            raise TypeError(f"Unsupported color type: {color_type}")

        ctor, _ = CONVERTERS[color_type]

        value = ctor(color)

        return (
            {
                "data": value,
                "type": color_type,
            },
        )