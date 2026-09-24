from pxr import Gf, Usd, UsdGeom
from ...utils import OpenUSDError, find_prims, hex_to_rgba


class SetUSDPrimDisplayColor:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "set_display_color"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "display_color": ("COLOR", {"default": "#ffffffff"}),
            },
            "optional": {
                "apply_to_children": ("BOOLEAN", {"default": False}),
            },
        }

    def set_display_color(self, stage, prim_path: str, display_color: str, apply_to_children: bool = False):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        prims_to_process = find_prims(stage_obj, prim_path)

        r, g, b, a = hex_to_rgba(display_color)
        color = Gf.Vec3f(r, g, b)

        # Collect all prims to modify based on the flag
        target_prims = []
        if apply_to_children:
            # Iterative depth-first traversal to find all descendants
            for root_prim in prims_to_process:
                for prim in Usd.PrimRange(root_prim):
                    target_prims.append(prim)
        else:
            target_prims = prims_to_process

        # Apply the color and opacity to valid meshes
        for prim in target_prims:
            if prim.IsA(UsdGeom.Mesh):
                mesh = UsdGeom.Mesh(prim)
                mesh.GetDisplayColorAttr().Set([color])
                mesh.GetDisplayOpacityAttr().Set([a])

        return (stage,)

