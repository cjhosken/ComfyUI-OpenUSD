import os
import uuid
import folder_paths
import fnmatch

class TransformUSDPrim:
    CATEGORY = "3d/USD/Scene"
    FUNCTION = "transform_prim"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "translation": ("VEC3", {"default": [0.0, 0.0, 0.0]}),
                "rotation": ("VEC3", {"default": [0.0, 0.0, 0.0]}),
                "scale": ("VEC3", {"default": [1.0, 1.0, 1.0]}),
            }
        }

    def transform_prim(self, USD, prim_path, translation, rotation, scale):
        from pxr import Usd, UsdGeom, Gf
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"transform_{uuid.uuid4().hex}.usda")

        # Unpack VEC3 values safely
        t_x, t_y, t_z = 0.0, 0.0, 0.0
        if isinstance(translation, (list, tuple)) and len(translation) >= 3:
            t_x, t_y, t_z = float(translation[0]), float(translation[1]), float(translation[2])

        r_x, r_y, r_z = 0.0, 0.0, 0.0
        if isinstance(rotation, (list, tuple)) and len(rotation) >= 3:
            r_x, r_y, r_z = float(rotation[0]), float(rotation[1]), float(rotation[2])

        s_x, s_y, s_z = 1.0, 1.0, 1.0
        if isinstance(scale, (list, tuple)) and len(scale) >= 3:
            s_x, s_y, s_z = float(scale[0]), float(scale[1]), float(scale[2])

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path

            stage = Usd.Stage.Open(usd_path)
            
            # Resolve target prims with wildcard matching
            matched_prims = []
            if "*" in prim_path or "?" in prim_path:
                for p in stage.Traverse():
                    if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                        matched_prims.append(p)
            else:
                prim = stage.GetPrimAtPath(prim_path)
                if prim.IsValid():
                    matched_prims.append(prim)
                else:
                    prim = stage.DefinePrim(prim_path, "Xform")
                    matched_prims.append(prim)

            for prim in matched_prims:
                xformable = UsdGeom.Xformable(prim)
                if not xformable:
                    continue
                
                # Update Translation
                translate_op = None
                for op in xformable.GetOrderedXformOps():
                    if op.GetOpType() == UsdGeom.XformOp.TypeTranslate:
                        translate_op = op
                        break
                if not translate_op:
                    translate_op = xformable.AddTranslateOp()
                translate_op.Set(Gf.Vec3d(t_x, t_y, t_z))

                # Update Rotation
                rotate_op = None
                for op in xformable.GetOrderedXformOps():
                    if op.GetOpType() == UsdGeom.XformOp.TypeRotateXYZ:
                        rotate_op = op
                        break
                if not rotate_op:
                    rotate_op = xformable.AddRotateXYZOp()
                rotate_op.Set(Gf.Vec3f(r_x, r_y, r_z))

                # Update Scale
                scale_op = None
                for op in xformable.GetOrderedXformOps():
                    if op.GetOpType() == UsdGeom.XformOp.TypeScale:
                        scale_op = op
                        break
                if not scale_op:
                    scale_op = xformable.AddScaleOp()
                scale_op.Set(Gf.Vec3f(s_x, s_y, s_z))

            stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class CreateUSDLight:
    CATEGORY = "3d/USD/Scene"
    FUNCTION = "create_light"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        modes = ["create/set", "block", "ignore"]
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Lights/DomeLight"}),
                "light_type": (["DomeLight", "DistantLight", "SphereLight", "RectLight"], {"default": "DomeLight"}),
                "intensity": ("FLOAT", {"default": 1.0, "step": 0.05}),
                "intensity_mode": (modes, {"default": "create/set"}),
                "exposure": ("FLOAT", {"default": 0.0, "step": 0.05}),
                "exposure_mode": (modes, {"default": "create/set"}),
                "color_r": ("FLOAT", {"default": 1.0, "step": 0.05, "min": 0.0, "max": 1.0}),
                "color_g": ("FLOAT", {"default": 1.0, "step": 0.05, "min": 0.0, "max": 1.0}),
                "color_b": ("FLOAT", {"default": 1.0, "step": 0.05, "min": 0.0, "max": 1.0}),
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

    def create_light(self, USD, prim_path, light_type, intensity, intensity_mode,
                     exposure, exposure_mode, color_r, color_g, color_b, color_mode,
                     texture_path="", texture_mode="ignore"):
        from pxr import Usd, UsdLux, Gf, Sdf
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"light_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path

            stage = Usd.Stage.Open(usd_path)
            
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

            if prim.IsValid():
                self.apply_attr(prim, "intensity", intensity, intensity_mode, Sdf.ValueTypeNames.Float)
                self.apply_attr(prim, "exposure", exposure, exposure_mode, Sdf.ValueTypeNames.Float)
                self.apply_attr(prim, "color", Gf.Vec3f(color_r, color_g, color_b), color_mode, Sdf.ValueTypeNames.Color3f)
                
                if light_type == "DomeLight":
                    abs_tex = os.path.abspath(texture_path) if texture_path.strip() else ""
                    self.apply_attr(prim, "texture:file", Sdf.AssetPath(abs_tex) if abs_tex else "", texture_mode, Sdf.ValueTypeNames.Asset)

            stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class CreateUSDCamera:
    CATEGORY = "3d/USD/Scene"
    FUNCTION = "create_camera"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        modes = ["create/set", "block", "ignore"]
        return {
            "required": {
                "USD": ("USD",),
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

    def create_camera(self, USD, prim_path, focal_length, focal_length_mode,
                      horizontal_aperture, horizontal_aperture_mode,
                      vertical_aperture, vertical_aperture_mode,
                      near_clip, near_clip_mode, far_clip, far_clip_mode):
        from pxr import Usd, UsdGeom, Gf, Sdf
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"camera_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path

            stage = Usd.Stage.Open(usd_path)
            
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

            stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class FlattenUSDStage:
    CATEGORY = "3d/USD/Scene"
    FUNCTION = "flatten_stage"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def flatten_stage(self, USD):
        from pxr import Usd
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"flattened_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            stage = Usd.Stage.Open(usd_path)
            flat_layer = stage.Flatten()
            
            flat_layer.comment = f"usd_info: {os.path.abspath(out_path)}"
            flat_layer.Export(out_path)
            new_usda_text = flat_layer.ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class ConfigureUSDStage:
    CATEGORY = "3d/USD/Scene"
    FUNCTION = "configure_stage"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "up_axis": (["Y", "Z"], {"default": "Y"}),
                "meters_per_unit": ("FLOAT", {"default": 1.0, "step": 0.001}),
            }
        }

    def configure_stage(self, USD, up_axis, meters_per_unit):
        from pxr import Usd, UsdGeom
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"config_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            stage = Usd.Stage.Open(usd_path)
            
            # Apply coordinate up-axis
            axis_token = UsdGeom.Tokens.y if up_axis == "Y" else UsdGeom.Tokens.z
            UsdGeom.SetStageUpAxis(stage, axis_token)
            
            # Apply meters-per-unit metric system scale
            UsdGeom.SetStageMetersPerUnit(stage, meters_per_unit)

            stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass
