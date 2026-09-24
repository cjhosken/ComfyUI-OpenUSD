from .utils import CONVERTERS


class CreateUSDVec2:
    """Create a USD 2D vector value (float2, double2, int2, etc.)."""

    CATEGORY = "3d/usd/type"
    FUNCTION = "create_vec2"
    RETURN_TYPES = ("VEC2",)
    RETURN_NAMES = ("vec2",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "y": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "vec2_type": (
                    [
                        "float2", "double2", "int2", "half2",
                        "texCoord2f", "texCoord2d", "texCoord2h",
                    ],
                    {"default": "float2"},
                ),
            }
        }

    def create_vec2(self, x: float, y: float, vec2_type: str):
        entry = CONVERTERS[vec2_type]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry
        value = ctor((x, y))

        return (
            {
                "data": value,
                "type": vec2_type,
            },
        )