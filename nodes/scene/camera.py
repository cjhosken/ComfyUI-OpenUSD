from pxr import Sdf, UsdGeom, Gf

class CreateUSDCamera:
    CATEGORY = "3d/usd/scene"
    FUNCTION = "create_camera"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        modes = ["create/set", "block", "ignore"]
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Cameras/MainCamera"}),
                "focal_length": ("FLOAT", {"default": 50.0, "step": 0.5}),
                "focal_length_mode": (modes, {"default": "create/set"}),
                "horizontal_aperture": ("FLOAT", {"default": 20.955, "step": 0.05}),
                "horizontal_aperture_mode": (modes, {"default": "create/set"}),
                "vertical_aperture": ("FLOAT", {"default": 15.2908, "step": 0.05}),
                "vertical_aperture_mode": (modes, {"default": "create/set"}),
                "near_clip": ("FLOAT", {"default": 0.1, "step": 0.05}),
                "near_clip_mode": (modes, {"default": "create/set"}),
                "far_clip": ("FLOAT", {"default": 10000.0, "step": 10.0}),
                "far_clip_mode": (modes, {"default": "create/set"}),
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

    def create_camera(self, stage, prim_path, focal_length, focal_length_mode,
                      horizontal_aperture, horizontal_aperture_mode,
                      vertical_aperture, vertical_aperture_mode,
                      near_clip, near_clip_mode, far_clip, far_clip_mode):

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        prim = stage.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            cam = UsdGeom.Camera.Define(stage, prim_path)
            prim = cam.GetPrim()
        else:
            cam = UsdGeom.Camera(prim)

        if prim.IsValid():
            self.apply_attr(prim, "focalLength", focal_length, focal_length_mode, Sdf.ValueTypeNames.Float)
            self.apply_attr(prim, "horizontalAperture", horizontal_aperture, horizontal_aperture_mode, Sdf.ValueTypeNames.Float)
            self.apply_attr(prim, "verticalAperture", vertical_aperture, vertical_aperture_mode, Sdf.ValueTypeNames.Float)
            
            # Clipping range requires combining near and far clips into a float2
            if near_clip_mode == "block" or far_clip_mode == "block":
                clip_attr = prim.GetAttribute("clippingRange")
                if not clip_attr.IsValid():
                    clip_attr = prim.CreateAttribute("clippingRange", Sdf.ValueTypeNames.Float2)
                clip_attr.BlockOpinion()
            elif near_clip_mode == "create/set" or far_clip_mode == "create/set":
                # Get existing clipping range to preserve unaffected values
                curr_val = Gf.Vec2f(near_clip, far_clip)
                clip_attr = prim.GetAttribute("clippingRange")
                if clip_attr.IsValid() and clip_attr.HasValue():
                    ex_val = clip_attr.Get()
                    curr_val = Gf.Vec2f(
                        near_clip if near_clip_mode == "create/set" else ex_val[0],
                        far_clip if far_clip_mode == "create/set" else ex_val[1]
                    )
                if not clip_attr.IsValid():
                    clip_attr = prim.CreateAttribute("clippingRange", Sdf.ValueTypeNames.Float2)
                clip_attr.Set(curr_val)

        return (stage,)
