import os

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
            }
        }

    def preview_openusd(self, USD):
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        if usd_path != "" and usda_text == "" and os.path.exists(usd_path):
            try:
                from pxr import Usd
                stage = Usd.Stage.Open(usd_path)
                if stage:
                    stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(usd_path)}"
                    usda_text = stage.GetRootLayer().ExportToString()
                else:
                    usda_text = "Failed to open USD Stage."
            except ImportError:
                usda_text = (
                    "Error: 'pxr-usd-api' library is not installed.\n"
                    "Please run 'pip install pxr-usd-api' in your ComfyUI environment."
                )
            except Exception as e:
                usda_text = f"An error occurred while processing the USD file:\n{str(e)}"

        return {
            "ui": {"usd_info": [usd_path], "usda_text": [usda_text]},
            "result": (USD,)
        }

class RenderUSD:
    CATEGORY = "3d/USD/View"
    FUNCTION = "render_usd"
    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE",)
    RETURN_NAMES = ("beauty", "depth", "normal",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 64}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 64}),
                "beauty_file": ("STRING", {"default": ""}),
                "depth_file": ("STRING", {"default": ""}),
                "normal_file": ("STRING", {"default": ""}),
            }
        }

    def render_usd(self, USD, width, height, beauty_file, depth_file, normal_file):
        import folder_paths
        from PIL import Image, ImageOps
        import torch
        import numpy as np
        
        def load_image_tensor(filename):
            if not filename:
                # Return empty black tensor if no image uploaded yet
                return torch.zeros((1, height, width, 3), dtype=torch.float32)
            
            try:
                img_path = folder_paths.get_annotated_filepath(filename)
                if not os.path.exists(img_path):
                    return torch.zeros((1, height, width, 3), dtype=torch.float32)
                
                img = Image.open(img_path)
                img = ImageOps.exif_transpose(img)
                # Ensure correct dimensions
                if img.size != (width, height):
                    img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                img = img.convert("RGB")
                img_np = np.array(img).astype(np.float32) / 255.0
                return torch.from_numpy(img_np)[None,]
            except Exception as e:
                print(f"[RenderUSD] Failed to load image {filename}: {e}")
                return torch.zeros((1, height, width, 3), dtype=torch.float32)

        beauty_tensor = load_image_tensor(beauty_file)
        depth_tensor = load_image_tensor(depth_file)
        normal_tensor = load_image_tensor(normal_file)

        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        return {
            "ui": {
                "usd_info": [usd_path],
                "usda_text": [usda_text]
            },
            "result": (beauty_tensor, depth_tensor, normal_tensor)
        }