import fnmatch
from pxr import Sdf

class AddUSDSpecializes:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "add_specialize"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "specializes_prim_path": ("STRING", {"default": "/_spec_Mesh"}),
            }
        }

    def add_specialize(self, USD, prim_path, specializes_prim_path):
        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path
        if not specializes_prim_path.startswith("/"):
            specializes_prim_path = "/" + specializes_prim_path

            
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
            prim.GetSpecializes().AddSpecialize(Sdf.Path(specializes_prim_path))


        return ({"stage": stage},)