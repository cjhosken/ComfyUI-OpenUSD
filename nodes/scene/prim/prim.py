from pxr import Usd, Sdf

class GetUSDPrimUSDA:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "get_usda"
    RETURN_TYPES = ("USD", "STRING",)
    RETURN_NAMES = ("stage", "usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
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

        src_layer = stage.GetRootLayer()
        dst_layer = Sdf.Layer.CreateAnonymous()
        Sdf.CopySpec(src_layer, Sdf.Path(prim_path), dst_layer, Sdf.Path(prim_path))
        return ({"stage": stage}, dst_layer.ExportToString(),)
    
class SetUSDPrimUSDA:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "set_usda"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "usda_text": ("STRING", {"multiline": True}),
                "mode": (["merge", "overwrite"], {"default": "merge"}),
            }
        }

    def set_usda(self, stage, usda_text, mode="merge"):
        if stage is None:
            raise RuntimeError("Invalid USD stage")

        layer = Sdf.Layer.CreateAnonymous()
        success = layer.ImportFromString(usda_text)

        if not success:
            raise RuntimeError("Failed to parse USDA text")

        if mode == "overwrite":
            stage.GetRootLayer().Clear()
            stage.GetRootLayer().TransferContent(layer)
        elif mode == "merge":
            stage.GetRootLayer().TransferContent(layer)
        else:
            raise ValueError(f"Unknown mode: {mode}")

        return (stage,)
