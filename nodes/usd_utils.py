import os
import folder_paths

class SplitUSD:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "split_usd"

    RETURN_TYPES = ("STRING", "STRING",)
    RETURN_NAMES = ("usd_info", "usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def split_usd(self, USD):
        if not isinstance(USD, dict):
            raise TypeError("Expected input of type 'USD' (dict)")
        return (USD.get("usd_info", ""), USD.get("usda_text", ""))

class CombineUSD:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "combine_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_info": ("STRING", {"forceInput": True}),
                "usda_text": ("STRING", {"forceInput": True}),
            }
        }

    def combine_usd(self, usd_info, usda_text):
        return ({"usd_info": usd_info, "usda_text": usda_text},)

class LayerBreakUSD:
    CATEGORY = "3d/USD/Composition"
    FUNCTION = "break_layer"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def break_layer(self, USD):
        from pxr import Usd
        import uuid, os
        import folder_paths
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        
        if not usd_path or not os.path.exists(usd_path):
            usd_path = os.path.join(temp_dir, f"layer_break_base_{uuid.uuid4().hex}.usda")
            with open(usd_path, "w") as f:
                f.write(usda_text)
                
        # Create a new empty active stage
        out_path = os.path.join(temp_dir, f"layer_break_active_{uuid.uuid4().hex}.usda")
        stage = Usd.Stage.CreateNew(out_path)
        
        # Add the base USD as a sublayer
        stage.GetRootLayer().subLayerPaths.append(os.path.abspath(usd_path))
        
        stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_path)}"
        stage.GetRootLayer().Export(out_path)
        
        new_usda_text = stage.GetRootLayer().ExportToString()
        return ({"usd_info": out_path, "usda_text": new_usda_text, "layer_break_base": os.path.abspath(usd_path)},)