from .utils import CONVERTERS


class CreateUSDQuat:
    """Create a USD quaternion from (w, x, y, z) rotation coordinates."""

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

    def create_quaternion(self, rotation, quat_precision: str, normalize: bool = True):
        if quat_precision not in CONVERTERS:
            raise TypeError(f"Unsupported quaternion type: {quat_precision}")

        entry = CONVERTERS[quat_precision]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry

        r = rotation.get("data", rotation) if isinstance(rotation, dict) else rotation
        w, x, y, z = r

        quat = ctor((w, x, y, z))
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