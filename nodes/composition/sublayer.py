import os

class AddUSDSublayer:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "add_sublayer"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "sublayer_path": ("STRING", {"default": "path/to/sublayer.usda", "path": True}),
                "position": (["prepend", "append"], {"default": "prepend"}),
            }
        }

    def add_sublayer(self, USD, sublayer_path, position="prepend"):
        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        root_layer = stage.GetRootLayer()
            
        abs_sub_path = os.path.abspath(sublayer_path)
            
        # Remove duplicate reference if it exists
        sub_paths = list(root_layer.subLayerPaths)
        if abs_sub_path in sub_paths:
            sub_paths.remove(abs_sub_path)
            
        if position == "prepend":
            sub_paths.insert(0, abs_sub_path)
        else:
            sub_paths.append(abs_sub_path)
                
        root_layer.subLayerPaths = sub_paths
            
        return ({"stage": stage},)
