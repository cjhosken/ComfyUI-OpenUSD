from pxr import Sdf
from ...utils import OpenUSDError


class GetUSDPrimUSDA:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "get_usda"
    RETURN_TYPES = ("USD", "STRING")
    RETURN_NAMES = ("stage", "usda_text")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root"}),
            }
        }

    def get_usda(self, stage=None, prim_path: str = "/Root", USD=None):
        raw_stage = stage if stage is not None else USD
        if raw_stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = raw_stage.get("stage") if isinstance(raw_stage, dict) else raw_stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        prim = stage_obj.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            raise OpenUSDError(f"Prim not found: {prim_path}")

        src_layer = stage_obj.GetRootLayer()
        dst_layer = Sdf.Layer.CreateAnonymous()
        Sdf.CopySpec(src_layer, Sdf.Path(prim_path), dst_layer, Sdf.Path(prim_path))
        return (raw_stage, dst_layer.ExportToString())


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

    def set_usda(self, stage, usda_text: str, mode: str = "merge"):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        layer = Sdf.Layer.CreateAnonymous()
        success = layer.ImportFromString(usda_text)

        if not success:
            raise OpenUSDError("Failed to parse USDA text")

        if mode == "overwrite":
            stage_obj.GetRootLayer().Clear()
            stage_obj.GetRootLayer().TransferContent(layer)
        elif mode == "merge":
            stage_obj.GetRootLayer().TransferContent(layer)
        else:
            raise OpenUSDError(f"Unknown mode: {mode}")

        return (stage,)

