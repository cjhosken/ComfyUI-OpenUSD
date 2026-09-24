from pxr import UsdGeom, Gf
from ..utils import find_prims

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

    def transform_prim(self, stage, prim_path, translation, rotation, scale):

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        # Unpack VEC3 values safely
        t_x, t_y, t_z = 0.0, 0.0, 0.0
        if isinstance(translation, (list, tuple)) and len(translation) >= 3:
            t_x, t_y, t_z = float(translation[0]), float(translation[1]), float(translation[2])

        r_x, r_y, r_z = 0.0, 0.0, 0.0
        if isinstance(rotation, (list, tuple)) and len(rotation) >= 3:
            r_x, r_y, r_z = float(rotation[0]), float(rotation[1]), float(rotation[2])

        s_x, s_y, s_z = 1.0, 1.0, 1.0
        if isinstance(scale, (list, tuple)) and len(scale) >= 3:
            s_x, s_y, s_z = float(scale[0]), float(scale[1]), float(scale[2])


        # Resolve target prims with wildcard matching
        matched_prims = find_prims(stage, prim_path)

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
