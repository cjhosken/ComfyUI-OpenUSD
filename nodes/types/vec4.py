from .utils import CONVERTERS

class CreateUSDVec4:
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
                "vec4_type": ([
                    "float4", "double4", "int4", "half4", 
                    "color4f", "color4d", "color4h",
                ], {"default": "float4"}),
            }
        }

    def create_vec4(self, x, y, z, w, vec4_type):
        if vec4_type not in CONVERTERS:
            raise TypeError(f"Unsupported vec4 type: {vec4_type}")

        ctor, _ = CONVERTERS[vec4_type]

        value = ctor((x, y, z, w))

        return (
            {
                "data": value,
                "type": vec4_type,
            },
        )