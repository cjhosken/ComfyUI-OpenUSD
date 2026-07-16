import os
from ..utils import register_in_memory_stage

class SimpleUSDViewer:
    CATEGORY = "3d/usd/view"
    FUNCTION = "simple_view"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def simple_view(self, USD):
        stage = USD.get("stage", None)
        if stage is None:
            raise RuntimeError("Invalid USD stage")
        
        # We need the same UI info as PreviewUSD for the viewer to work
        root_layer = stage.GetRootLayer()
        anchor_path = os.path.abspath(root_layer.realPath)
        
        # Simple resolution logic
        for ref in root_layer.GetExternalReferences():
            if os.path.isabs(ref):
                new_ref = ref.replace(os.path.dirname(anchor_path), "./")
                root_layer.UpdateExternalReference(ref, new_ref)
                
        usda_text = root_layer.ExportToString()
        usd_hash = register_in_memory_stage(usda_text)

        return {
            "ui": {"usd_info": [anchor_path], "usda_text": [usda_text], "usd_hash": [usd_hash]},
            "result": (USD,)
        }

NODE_CLASS_MAPPINGS = {
    "SimpleUSDViewer": SimpleUSDViewer,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SimpleUSDViewer": "USD Viewer",
}