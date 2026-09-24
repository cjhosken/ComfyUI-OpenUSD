from pxr import Usd

class TextToUSD:
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

    def text_to_usd(self, usda_text):
        stage = Usd.Stage.CreateInMemory()
        stage.GetRootLayer().ImportFromString(usda_text)
        return (stage,)
    
class USDtoText:
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
        stage = stage.get("stage", None)
        return (stage.GetRootLayer().ExportToString(),)