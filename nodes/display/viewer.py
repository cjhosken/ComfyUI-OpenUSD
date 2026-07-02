import os
from ..utils import register_in_memory_stage

class PreviewUSD:
    CATEGORY = "3d/USD/View"
    FUNCTION = "preview_openusd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            },
            "optional": {
                "frame": ("INT", {"default": 0, "min": 0, "max": 100000, "step": 1}),
            }
        }

    def preview_openusd(self, USD, frame=0):
        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")
        
        root_layer = stage.GetRootLayer()
        
        anchor_path = os.path.abspath(root_layer.realPath)

        for ref in root_layer.GetExternalReferences():
            if (os.path.isabs(ref)):
                new_ref = ref.replace(os.path.dirname(anchor_path), "./")
                root_layer.UpdateExternalReference(ref, new_ref)

        usda_text = root_layer.ExportToString()

        usd_hash = ""
        if usda_text:
            usd_hash = register_in_memory_stage(usda_text)

        return {
            "ui": {"usd_info": [anchor_path], "usda_text": [usda_text], "usd_hash": [usd_hash], "frame": [frame]},
            "result": (USD,)
        }