import fnmatch
from pxr import Sdf
import os

class AddUSDReferenceOrPayload:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "add_reference_or_payload"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "arc_type": (["reference", "payload"], {"default": "reference"}),
                "file_path": ("STRING", {"default": "", "path": True}),
                "target_prim_mode": (["Use default prim", "specify prim"], {"default": "Use default prim"}),
                "referenced_prim_path": ("STRING", {"default": ""}),
            }
        }

    def add_reference_or_payload(self, stage, prim_path, arc_type, file_path, target_prim_mode, referenced_prim_path=""):

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

        ref_prim_path_obj = Sdf.Path.emptyPath
        if target_prim_mode == "specify prim" and referenced_prim_path.strip():
            ref_prim_path_obj = Sdf.Path(referenced_prim_path.strip())
                
        ref_file = os.path.abspath(file_path) if file_path.strip() else ""

        for prim in matched_prims:
            if arc_type == "reference":
                prim.GetReferences().AddReference(assetPath=ref_file, primPath=ref_prim_path_obj)
            else:
                prim.GetPayloads().AddPayload(assetPath=ref_file, primPath=ref_prim_path_obj)

        return (stage,)