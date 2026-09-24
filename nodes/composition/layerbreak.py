import os
import uuid
import folder_paths
from pxr import Usd

class LayerBreakUSD:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "break_layer"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
            }
        }
    
    @classmethod
    def IS_CHANGED(cls, stage):
        return float("NaN")

    def break_layer(self, stage):
                
        if stage is None:
            raise RuntimeError("Invalid USD stage")
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        
        base_layer_path = os.path.join(temp_dir, f"layer_break_base_{uuid.uuid4().hex}.usda")
        stage.GetRootLayer().Export(base_layer_path)
                
        # Create a new empty active stage
        new_stage = Usd.Stage.CreateInMemory()

        absolute_base_path = os.path.abspath(base_layer_path)
        new_stage.GetRootLayer().subLayerPaths.append(absolute_base_path)
        
        return (new_stage,)
