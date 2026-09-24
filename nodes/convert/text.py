from pxr import Usd
from ..utils import OpenUSDError


class TextToUSD:
    """Import USDA plaintext into an in-memory USD stage."""

    CATEGORY = "3d/usd/convert"
    FUNCTION = "text_to_usd"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usda_text": ("STRING", {"forceInput": True}),
            }
        }

    def text_to_usd(self, usda_text: str):
        stage = Usd.Stage.CreateInMemory()
        stage.GetRootLayer().ImportFromString(usda_text)
        return (stage,)


class USDtoText:
    """Export an active USD stage to USDA plaintext."""

    CATEGORY = "3d/usd/convert"
    FUNCTION = "usd_to_text"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
            }
        }

    def usd_to_text(self, stage):
        if isinstance(stage, dict):
            stage = stage.get("stage", stage)

        if stage is None or not hasattr(stage, "GetRootLayer"):
            raise OpenUSDError("Invalid USD stage passed to USDtoText")

        return (stage.GetRootLayer().ExportToString(),)


NODE_CLASS_MAPPINGS = {
    "TexttoUSD": TextToUSD,
    "USDToText": USDtoText,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TexttoUSD": "Text to USD",
    "USDToText": "USD to Text",
}