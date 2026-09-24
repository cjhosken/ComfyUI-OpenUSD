import os
from ..utils import OpenUSDError, register_in_memory_stage


class SimpleUSDViewer:
    """Preview a USD stage directly inside ComfyUI."""

    CATEGORY = "3d/usd/view"
    FUNCTION = "simple_view"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
            }
        }

    def simple_view(self, stage):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        root_layer = stage.GetRootLayer()
        anchor_path = os.path.abspath(root_layer.realPath) if root_layer.realPath else ""

        # Relativize references for web viewer resolution
        if anchor_path:
            anchor_dir = os.path.dirname(anchor_path)
            for ref in root_layer.GetExternalReferences():
                if os.path.isabs(ref):
                    new_ref = ref.replace(anchor_dir, "./")
                    root_layer.UpdateExternalReference(ref, new_ref)

        usda_text = root_layer.ExportToString()
        usd_hash = register_in_memory_stage(usda_text)

        return {
            "ui": {
                "usd_info": [anchor_path],
                "usda_text": [usda_text],
                "usd_hash": [usd_hash],
            },
            "result": (stage,),
        }


NODE_CLASS_MAPPINGS = {
    "SimpleUSDViewer": SimpleUSDViewer,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SimpleUSDViewer": "USD Viewer",
}