from pxr import Usd, Sdf

class GetUSDPrimUSDA:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "get_usda"
    RETURN_TYPES = ("USD", "STRING",)
    RETURN_NAMES = ("USD", "usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root"}),
            }
        }

    def get_usda(self, USD, prim_path):
        stage = USD.get("stage", None)
        if stage is None:
            raise RuntimeError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        prim = stage.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            raise ValueError(f"Prim not found: {prim_path}")

        layer = Sdf.Layer.CreateAnonymous()
        temp_stage = Usd.Stage.Open(layer)

        # IMPORTANT: define ONLY the prim path you want
        temp_root = temp_stage.DefinePrim(prim_path, prim.GetTypeName())

        return ({"stage": stage}, layer.ExportToString(),)
    
class SetUSDPrimUSDA:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "set_usda"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "usda_text": ("STRING", {"multiline": True}),
                "mode": (["merge", "overwrite"], {"default": "merge"}),
            }
        }

    def set_usda(self, USD, usda_text, mode="merge"):
        stage = USD.get("stage", None)
        if stage is None:
            raise RuntimeError("Invalid USD stage")

        # ---------------------------------------------------------
        # Parse USDA into a temporary layer
        # ---------------------------------------------------------
        layer = Sdf.Layer.CreateAnonymous()
        success = layer.ImportFromString(usda_text)

        if not success:
            raise RuntimeError("Failed to parse USDA text")

        # ---------------------------------------------------------
        # APPLY STRATEGY
        # ---------------------------------------------------------
        if mode == "overwrite":
            # Replace entire root layer content
            stage.GetRootLayer().Clear()
            stage.GetRootLayer().TransferContent(layer)

        elif mode == "merge":
            # Standard USD composition-style merge
            stage.GetRootLayer().TransferContent(layer)

        else:
            raise ValueError(f"Unknown mode: {mode}")

        return ({"stage": stage},)