import fnmatch
from pxr import Sdf

class AddUSDVariant:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "add_variant"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "variant_set_name": ("STRING", {"default": "shadingVariant"}),
                "variant_name": ("STRING", {"default": "default"}),
                "set_selection": ("BOOLEAN", {"default": True}),
            }
        }

    def add_variant(self, USD, prim_path, variant_set_name, variant_name, set_selection=True):
        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")


        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

            
        matched_prims = []
        if "*" in prim_path or "?" in prim_path:
            for p in stage.Traverse():
                if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                        matched_prims.append(p)
        else:
            prim = stage.GetPrimAtPath(prim_path)
            if prim.IsValid():
                matched_prims.append(prim)
            else:
                prim = stage.DefinePrim(prim_path, "Xform")
                matched_prims.append(prim)

        for prim in matched_prims:
            vsets = prim.GetVariantSets()
            vset = vsets.AddVariantSet(variant_set_name)
            vset.AddVariant(variant_name)
                
            if set_selection:
                vset.SetVariantSelection(variant_name)


        return ({"stage":stage},)