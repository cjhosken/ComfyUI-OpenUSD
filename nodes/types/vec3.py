from .utils import CONVERTERS


class CreateUSDVec3:
    """Create a USD 3D vector value (float3, double3, point3f, normal3f, etc.)."""

    CATEGORY = "3d/usd/type"
    FUNCTION = "create_vec3"
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "y": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "z": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "vec3_type": (
                    [
                        "float3", "double3", "int3", "half3",
                        "point3f", "vector3f", "normal3f", "texCoord3f",
                        "point3d", "vector3d", "normal3d", "texCoord3d",
                        "point3h", "vector3h", "normal3h",
                    ],
                    {"default": "float3"},
                ),
            }
        }

    def create_vec3(self, x: float, y: float, z: float, vec3_type: str):
        entry = CONVERTERS[vec3_type]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry
        value = ctor((x, y, z))

        return (
            {
                "data": value,
                "type": vec3_type,
            },
        )