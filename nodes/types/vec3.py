from .utils import CONVERTERS

class CreateUSDVec3:
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
                "vec3_type": ([
                    "float3", "double3", "int3", "half3", 
                    "point3f", "point3d", "point3h",
                    "vector3f", "vector3d", "vector3h",
                    "normal3f", "normal3d", "normal3h", 
                    "texCoord3d", "texCoord3f", "texCoord3h"
                ], {"default": "float3"}),
            }
        }

    def create_vec3(self, x, y, z, vec3_type):
        if vec3_type not in CONVERTERS:
            raise TypeError(f"Unsupported vec3 type: {vec3_type}")

        ctor, _ = CONVERTERS[vec3_type]

        value = ctor((x, y, z))

        return (
            {
                "data": value,
                "type": vec3_type,
            },
        )