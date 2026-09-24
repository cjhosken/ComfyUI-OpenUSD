from pxr import Gf, UsdGeom
from ..utils import OpenUSDError, find_prims


def _unpack_vec3(val, default=(0.0, 0.0, 0.0)):
    """Unpack a 3-element vector from a list, tuple, or dictionary payload."""
    if isinstance(val, dict) and "data" in val:
        val = val["data"]
    if isinstance(val, (list, tuple)) and len(val) >= 3:
        try:
            return float(val[0]), float(val[1]), float(val[2])
        except (ValueError, TypeError):
            pass
    return default


class TransformUSDPrim:
    CATEGORY = "3d/usd/scene"
    FUNCTION = "transform_prim"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "translation": ("VEC3",),
                "rotation": ("VEC3",),
                "scale": ("VEC3",),
            }
        }

    def transform_prim(self, stage, prim_path: str, translation, rotation, scale):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        # Unpack VEC3 values safely (supports list, tuple, and {"data": [...]} dict)
        t_x, t_y, t_z = _unpack_vec3(translation, default=(0.0, 0.0, 0.0))
        r_x, r_y, r_z = _unpack_vec3(rotation, default=(0.0, 0.0, 0.0))
        s_x, s_y, s_z = _unpack_vec3(scale, default=(1.0, 1.0, 1.0))

        # Resolve target prims with wildcard matching
        matched_prims = find_prims(stage_obj, prim_path)

        for prim in matched_prims:
            xformable = UsdGeom.Xformable(prim)
            if not xformable:
                continue

            # Clear existing transform operations (such as xformOp:transform matrix)
            # to prevent conflict and ensure absolute translate/rotate/scale are applied in standard TRS order.
            xformable.ClearXformOpOrder()

            # Create and set Translation
            translate_op = xformable.AddTranslateOp()
            translate_op.Set(Gf.Vec3d(t_x, t_y, t_z))

            # Create and set Rotation
            rotate_op = xformable.AddRotateXYZOp()
            rotate_op.Set(Gf.Vec3f(r_x, r_y, r_z))

            # Create and set Scale
            scale_op = xformable.AddScaleOp()
            scale_op.Set(Gf.Vec3f(s_x, s_y, s_z))

        return (stage,)

