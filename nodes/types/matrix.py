from pxr import Gf
from .utils import CONVERTERS


class CreateUSDMatrix:
    """Construct a 4x4, 3x3, or 2x2 USD matrix from TRS components."""

    CATEGORY = "3d/usd/type"
    FUNCTION = "create_matrix"
    RETURN_TYPES = ("USD_VALUE",)
    RETURN_NAMES = ("matrix",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "translation": ("VEC3",),
                "rotation": ("VEC3",),
                "scale": ("VEC3",),
                "matrix_precision": (
                    ["matrix4d", "matrix3d", "matrix2d", "frame4d"],
                    {"default": "matrix4d"},
                ),
            }
        }

    def create_matrix(self, translation, rotation, scale, matrix_precision: str):
        if matrix_precision not in CONVERTERS:
            raise TypeError(f"Unsupported matrix type: {matrix_precision}")

        t = translation.get("data", translation) if isinstance(translation, dict) else translation
        r = rotation.get("data", rotation) if isinstance(rotation, dict) else rotation
        s = scale.get("data", scale) if isinstance(scale, dict) else scale

        rot = (
            Gf.Rotation(Gf.Vec3d(1, 0, 0), r[0])
            * Gf.Rotation(Gf.Vec3d(0, 1, 0), r[1])
            * Gf.Rotation(Gf.Vec3d(0, 0, 1), r[2])
        )

        transform = Gf.Transform()
        transform.SetScale(Gf.Vec3d(*s))
        transform.SetRotation(rot)
        transform.SetTranslation(Gf.Vec3d(*t))

        mat = transform.GetMatrix()
        entry = CONVERTERS[matrix_precision]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry
        value = ctor(mat)

        return (
            {
                "data": value,
                "type": matrix_precision,
            },
        )