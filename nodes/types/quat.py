from .utils import CONVERTERS


class CreateUSDQuat:
    CATEGORY = "3d/usd/type"
    FUNCTION = "create_quaternion"
    RETURN_TYPES = ("USD_VALUE",)
    RETURN_NAMES = ("quat",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "rotation": ("VEC4",),
                "quat_precision": (["quatf", "quatd", "quath"], {"default": "quatf"}),
                "normalize": ("BOOLEAN", {"default": True}),
            }
        }

    def create_quaternion(self, rotation, quat_precision, normalize):
        if quat_precision not in CONVERTERS:
            raise TypeError(f"Unsupported quaternion type: {quat_precision}")

        ctor, _ = CONVERTERS[quat_precision]

        # extract VEC4 payload
        r = rotation.get("data", rotation) if isinstance(rotation, dict) else rotation
        w, x, y, z = r

        # construct USD quaternion via registry
        quat = ctor((w, x, y, z))

        # optional normalization stays domain-specific (USD API, not converter layer)
        if normalize and hasattr(quat, "GetNormalized"):
            quat = quat.GetNormalized()

        return (
            {
                "data": [
                    float(quat.GetReal()),
                    *map(float, quat.GetImaginary()),
                ],
                "type": quat_precision,
            },
        )