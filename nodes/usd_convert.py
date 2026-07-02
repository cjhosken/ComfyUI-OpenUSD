import os
from pxr import Usd

class USDtoText:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "usd_to_text"

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def _resolve_paths(self, layer, relative=False):
        anchor_path = os.path.abspath(layer.realPath)

        for ref in layer.GetExternalReferences():
            if (os.path.isabs(ref)):
                if relative:
                    new_ref = ref.replace(os.path.dirname(anchor_path), "./")
                    layer.UpdateExternalReference(ref, new_ref)
            else:
                if not relative:
                    new_ref = os.path.normpath(os.path.join(os.path.dirname(anchor_path), ref))
                    layer.UpdateExternalReference(ref, new_ref)

    def usd_to_text(self, USD):
        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")
        
        root_layer = stage.GetRootLayer()
        for ref in root_layer.GetExternalReferences():
            if (not os.path.isabs(ref)):
                new_ref = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(root_layer.realPath)), ref))
                root_layer.UpdateExternalReference(ref, new_ref)

        return (root_layer.ExportToString())

class TextToUSD:
    CATEGORY = "3d/USD/Conversion"
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
        stage = None
        try:
            # CreateFromString returns a brand new Usd.Stage instance
            stage = Usd.Stage.CreateFromString(usda_text)
        except Exception as e:
            print(f"Error parsing USDA text: {e}")
            # Fallback to an empty anonymous stage so downstream nodes don't crash hard
            stage = Usd.Stage.CreateInMemory()
            
        # Return a proper single-element tuple matching your RETURN_TYPES
        return ({"stage":stage},)