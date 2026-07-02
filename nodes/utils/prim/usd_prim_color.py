import folder_paths
from pxr import UsdGeom
import os
import uuid

class SetUSDPrimDisplayColor:
    CATEGORY = "3d/USD/Prim"
    FUNCTION = "set_display_color"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "display_color": ("COLOR", {"default": "#ffffff"}),
                "display_opacity": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.05}),
            },
            "optional": {
                "color_space": (["sRGB", "linear"], {"default": "sRGB"}),
                "apply_to_children": ("BOOLEAN", {"default": False}),
            }
        }

    def set_display_color(self, USD, prim_path, display_color="1.0,1.0,1.0", 
                          display_opacity=1.0, color_space="sRGB", apply_to_children=False):


        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        # Ensure leading slash for prim path
        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        # Get prims to process
        prims_to_process = []
        prim = stage.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            print(f"[SetUSDPrimDisplayColor] Prim '{prim_path}' not found, creating it")
            prim = stage.DefinePrim(prim_path, "Xform")
            prims_to_process.append(prim)
        else:
            prims_to_process.append(prim)
                
            # Add children if requested
            if apply_to_children:
                for child in stage.Traverse():
                    if str(child.GetPath()).startswith(prim_path) and child != prim:
                        prims_to_process.append(child)

        # Parse color
        color = self.parse_color(display_color, color_space)
        if color is None:
            print(f"[SetUSDPrimDisplayColor] Invalid color format: {display_color}")
            return (USD,)

        # Apply display color and opacity to each prim
        for target_prim in prims_to_process:
            if target_prim.IsA(UsdGeom.Gprim):
                geom = UsdGeom.Gprim(target_prim)
                if geom:
                    # Set display color
                    try:
                        geom.CreateDisplayColorAttr().Set([color])
                    except Exception as e:
                        print(f"[SetUSDPrimDisplayColor] Error setting display color on {target_prim.GetPath()}: {e}")
                        
                    # Set display opacity
                    try:
                        geom.CreateDisplayOpacityAttr().Set([display_opacity])
                    except Exception as e:
                        print(f"[SetUSDPrimDisplayColor] Error setting display opacity on {target_prim.GetPath()}: {e}")

        return ({"stage": stage},)

    def parse_color(self, color_string, color_space="sRGB"):
        """Parse color string and convert to Gf.Vec3f"""
        from pxr import Gf
        
        if not color_string or not color_string.strip():
            return None
        
        try:
            # Handle different color formats
            color_string = color_string.strip()
            
            # Support standard hex color string format (e.g. #ffffff)
            if color_string.startswith("#") and len(color_string) == 7:
                r = int(color_string[1:3], 16) / 255.0
                g = int(color_string[3:5], 16) / 255.0
                b = int(color_string[5:7], 16) / 255.0
                return Gf.Vec3f(r, g, b)
            
            # Try comma-separated values
            if "," in color_string:
                parts = [float(x.strip()) for x in color_string.split(",") if x.strip()]
            else:
                # Try space-separated
                parts = [float(x.strip()) for x in color_string.split() if x.strip()]
            
            if len(parts) >= 3:
                r, g, b = parts[0], parts[1], parts[2]
                
                # Clamp values
                r = max(0.0, min(1.0, r))
                g = max(0.0, min(1.0, g))
                b = max(0.0, min(1.0, b))
                
                # Convert from sRGB to linear if needed
                if color_space == "linear" and color_space != "sRGB":
                    r = self.srgb_to_linear(r)
                    g = self.srgb_to_linear(g)
                    b = self.srgb_to_linear(b)
                
                return Gf.Vec3f(r, g, b)
            else:
                print(f"[SetUSDPrimDisplayColor] Expected 3 values, got {len(parts)}")
                return None
                
        except Exception as e:
            print(f"[SetUSDPrimDisplayColor] Error parsing color: {e}")
            return None

    def srgb_to_linear(self, value):
        """Convert sRGB value to linear color space"""
        if value <= 0.04045:
            return value / 12.92
        else:
            return pow((value + 0.055) / 1.055, 2.4)