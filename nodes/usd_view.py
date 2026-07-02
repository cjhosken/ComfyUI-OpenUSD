import os
import hashlib

IN_MEMORY_STAGES = {}

def register_in_memory_stage(usda_text):
    if not usda_text:
        return ""
    h = hashlib.sha256(usda_text.encode('utf-8')).hexdigest()
    IN_MEMORY_STAGES[h] = usda_text
    return h

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
                "render_mode": (["single_frame", "frame_range"], {"default": "single_frame"}),
                "frame": ("INT", {"default": 0, "min": 0, "max": 100000, "step": 1}),
                "start_frame": ("INT", {"default": 0, "min": 0, "max": 100000, "step": 1}),
                "end_frame": ("INT", {"default": 0, "min": 0, "max": 100000, "step": 1}),
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 64}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 64}),
                "beauty_file": ("STRING", {"default": ""}),
                "depth_file": ("STRING", {"default": ""}),
                "normal_file": ("STRING", {"default": ""}),
            }
        }

    def render_usd(self, USD, render_mode, frame, start_frame, end_frame, width, height, beauty_file, depth_file, normal_file):
        import folder_paths
        from PIL import Image, ImageOps
        import torch
        import numpy as np
        
        def load_image_tensor(filename_list_str):
            if not filename_list_str:
                # Return empty black tensor if no image uploaded yet
                return torch.zeros((1, height, width, 3), dtype=torch.float32)
            
            filenames = [f.strip() for f in filename_list_str.split(",") if f.strip()]
            tensors = []
            for filename in filenames:
                try:
                    img_path = folder_paths.get_annotated_filepath(filename)
                    if not os.path.exists(img_path):
                        tensors.append(torch.zeros((height, width, 3), dtype=torch.float32))
                        continue
                    
                    img = Image.open(img_path)
                    img = ImageOps.exif_transpose(img)
                    # Ensure correct dimensions by cropping (no stretching)
                    if img.size != (width, height):
                        target_ratio = width / height
                        img_w, img_h = img.size
                        img_ratio = img_w / img_h
                        
                        if img_ratio > target_ratio:
                            # Image is wider than target -> crop left/right
                            crop_width = int(img_h * target_ratio)
                            start_x = (img_w - crop_width) // 2
                            img = img.crop((start_x, 0, start_x + crop_width, img_h))
                        elif img_ratio < target_ratio:
                            # Image is taller than target -> crop top/bottom
                            crop_height = int(img_w / target_ratio)
                            start_y = (img_h - crop_height) // 2
                            img = img.crop((0, start_y, img_w, start_y + crop_height))
                            
                        img = img.resize((width, height), Image.Resampling.LANCZOS)
                    
                    img = img.convert("RGB")
                    img_np = np.array(img).astype(np.float32) / 255.0
                    tensors.append(torch.from_numpy(img_np))
                except Exception as e:
                    print(f"[RenderUSD] Failed to load image {filename}: {e}")
                    tensors.append(torch.zeros((height, width, 3), dtype=torch.float32))
            
            if not tensors:
                return torch.zeros((1, height, width, 3), dtype=torch.float32)
            return torch.stack(tensors)

        beauty_tensor = load_image_tensor(beauty_file)
        depth_tensor = load_image_tensor(depth_file)
        normal_tensor = load_image_tensor(normal_file)

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
            "ui": {
                "usd_info": [anchor_path],
                "usda_text": [usda_text],
                "usd_hash": [usd_hash],
                "render_mode": [render_mode],
                "frame": [frame],
                "start_frame": [start_frame],
                "end_frame": [end_frame]
            },
            "result": (beauty_tensor, depth_tensor, normal_tensor)
        }