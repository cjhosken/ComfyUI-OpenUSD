from .utils import CONVERTERS


class CreateUSDVec4:
    """Create a USD 4D vector value (float4, double4, int4, half4)."""

    CATEGORY = "3d/usd/type"
    FUNCTION = "create_vec4"
    RETURN_TYPES = ("VEC4",)
    RETURN_NAMES = ("vec4",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "y": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "z": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "w": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "vec4_type": (
                    ["float4", "double4", "int4", "half4"],
                    {"default": "float4"},
                ),
            }
        }

    def create_vec4(self, x: float, y: float, z: float, w: float, vec4_type: str):
        entry = CONVERTERS[vec4_type]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry
        value = ctor((x, y, z, w))

        return (
            {
                "data": value,
                "type": vec4_type,
            },
        )