from pxr import UsdGeom
from ...utils import OpenUSDError


class ConfigureUSDPrim:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "configure_prim"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "active": ("BOOLEAN", {"default": True, "label": "Active"}),
                "visibility": (["inherited", "visible", "invisible"], {"default": "inherited"}),
                "purpose": (["default", "render", "proxy", "guide"], {"default": "default"}),
                "kind": ("STRING", {"default": "", "placeholder": "e.g., component, group, assembly"}),
                "comment": ("STRING", {"default": "", "multiline": True, "placeholder": "Add a comment about this prim"}),
            }
        }

    def configure_prim(
        self,
        stage,
        prim_path: str,
        active: bool = True,
        visibility: str = "inherited",
        purpose: str = "default",
        kind: str = "",
        comment: str = "",
    ):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        # Ensure leading slash for prim path
        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        # Get or create prim
        prim = stage_obj.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            prim = stage_obj.DefinePrim(prim_path, "Xform")

        # 1. Set active state
        if hasattr(prim, "SetActive"):
            prim.SetActive(active)

        # 2. Set visibility
        if prim.IsA(UsdGeom.Imageable):
            imageable = UsdGeom.Imageable(prim)
            if imageable:
                imageable.CreateVisibilityAttr().Set(visibility)

        # 3. Set purpose
        if prim.IsA(UsdGeom.Gprim):
            geom = UsdGeom.Gprim(prim)
            if geom:
                geom.CreatePurposeAttr().Set(purpose)

        # 4. Set kind
        if kind and kind.strip():
            try:
                if hasattr(prim, "SetKind"):
                    prim.SetKind(kind.strip())
            except Exception as e:
                print(f"[ConfigureUSDPrim] Error setting kind: {e}")

        # 5. Set comment
        if comment and comment.strip():
            try:
                prim.SetMetadata("comment", comment.strip())
            except Exception as e:
                print(f"[ConfigureUSDPrim] Error setting comment: {e}")


        return (stage,)