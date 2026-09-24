import fnmatch
from ..utils import OpenUSDError


class AddUSDVariant:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "add_variant"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "variant_set_name": ("STRING", {"default": "shadingVariant"}),
                "variant_name": ("STRING", {"default": "default"}),
                "set_selection": ("BOOLEAN", {"default": True}),
            }
        }

    def add_variant(self, stage, prim_path, variant_set_name, variant_name, set_selection=True):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        matched_prims = []
        if "*" in prim_path or "?" in prim_path:
            for p in stage_obj.Traverse():
                if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                    matched_prims.append(p)
        else:
            prim = stage_obj.GetPrimAtPath(prim_path)
            if prim.IsValid():
                matched_prims.append(prim)
            else:
                prim = stage_obj.DefinePrim(prim_path, "Xform")
                matched_prims.append(prim)

        for prim in matched_prims:
            vsets = prim.GetVariantSets()
            vset = vsets.AddVariantSet(variant_set_name)
            vset.AddVariant(variant_name)

            if set_selection:
                vset.SetVariantSelection(variant_name)

        return (stage,)