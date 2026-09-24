from pxr import UsdLux, Gf, Sdf
import os
from ..utils import hex_to_rgba


class CreateUSDLight:
    CATEGORY = "3d/usd/scene"
    FUNCTION = "create_light"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        modes = ["create/set", "block", "ignore"]
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Lights/DomeLight"}),
                "light_type": (["DomeLight", "DistantLight", "SphereLight", "RectLight"], {"default": "DomeLight"}),
                "intensity": ("FLOAT", {"default": 1.0, "step": 0.05}),
                "intensity_mode": (modes, {"default": "create/set"}),
                "exposure": ("FLOAT", {"default": 0.0, "step": 0.05}),
                "exposure_mode": (modes, {"default": "create/set"}),
                "color": ("COLOR", {"default": "#FFFFFF"}),
                "color_mode": (modes, {"default": "create/set"}),
                "texture_path": ("STRING", {"default": "", "path": True}),
                "texture_mode": (modes, {"default": "ignore"}),
            }
        }

    def apply_attr(self, prim, attr_name, value, mode, type_name):
        if mode == "ignore":
            return
        attr = prim.GetAttribute(attr_name)
        if mode == "block":
            if not attr.IsValid():
                attr = prim.CreateAttribute(attr_name, type_name)
            attr.BlockOpinion()
        elif mode == "create/set":
            if not attr.IsValid():
                attr = prim.CreateAttribute(attr_name, type_name)
            attr.Set(value)

    def create_light(self, stage, prim_path, light_type, intensity, intensity_mode,
                     exposure, exposure_mode, color, color_mode,
                     texture_path="", texture_mode="ignore"):

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        # Create or get the light prim
        prim = stage.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            if light_type == "DomeLight":
                light = UsdLux.DomeLight.Define(stage, prim_path)
            elif light_type == "DistantLight":
                light = UsdLux.DistantLight.Define(stage, prim_path)
            elif light_type == "SphereLight":
                light = UsdLux.SphereLight.Define(stage, prim_path)
            elif light_type == "RectLight":
                light = UsdLux.RectLight.Define(stage, prim_path)
            prim = light.GetPrim()
        else:
            # If editing, cast to light
            if light_type == "DomeLight":
                light = UsdLux.DomeLight(prim)
            elif light_type == "DistantLight":
                light = UsdLux.DistantLight(prim)
            elif light_type == "SphereLight":
                light = UsdLux.SphereLight(prim)
            elif light_type == "RectLight":
                light = UsdLux.RectLight(prim)

        color_r, color_g, color_b, color_a = hex_to_rgba(color)

        if prim.IsValid():
            self.apply_attr(prim, "intensity", intensity, intensity_mode, Sdf.ValueTypeNames.Float)
            self.apply_attr(prim, "exposure", exposure, exposure_mode, Sdf.ValueTypeNames.Float)
            self.apply_attr(prim, "color", Gf.Vec3f(color_r, color_g, color_b), color_mode, Sdf.ValueTypeNames.Color3f)
            
            if light_type == "DomeLight":
                abs_tex = os.path.abspath(texture_path) if texture_path.strip() else ""
                self.apply_attr(prim, "texture:file", Sdf.AssetPath(abs_tex) if abs_tex else "", texture_mode, Sdf.ValueTypeNames.Asset)

        return (stage,)

