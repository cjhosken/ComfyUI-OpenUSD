import os
import folder_paths

class SplitUSD:
    CATEGORY = "USD"
    FUNCTION = "split_usd"

    RETURN_TYPES = ("STRING", "STRING",)
    RETURN_NAMES = ("usd_path", "usda_text",)

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
        return (USD.get("usd_path", ""), USD.get("usda_text", ""))

class CombineUSD:
    CATEGORY = "USD"
    FUNCTION = "combine_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_path": ("STRING", {"default": "", "multiline": False}),
                "usda_text": ("STRING", {"multiline": True, "forceInput": True}),
            }
        }

    def combine_usd(self, usd_path, usda_text):
        return ({"usd_path": usd_path, "usda_text": usda_text},)

class EditUSDPrim:
    CATEGORY = "USD"
    FUNCTION = "edit_prim"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "attribute_name": ("STRING", {"default": "xformOpOrder"}),
                "value": ("STRING", {"default": ""}),
                "value_type": (["string", "float", "int", "bool", "Vec3f", "Vec3d", "token"],),
                "visibility": (["inherited", "invisible"],),
            }
        }

    def edit_prim(self, USD, prim_path, attribute_name, value, value_type, visibility):
        from pxr import Usd, Gf, UsdGeom, Sdf
        import uuid
        import fnmatch

        usd_path = USD.get("usd_path", "")
        usda_text = USD.get("usda_text", "")
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"edit_prim_{uuid.uuid4().hex}.usda")
        
        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            # Ensure leading slash for prim path
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
                # Parse and set attribute value if specified
                if attribute_name.strip():
                    typed_val = None
                    try:
                        if value_type == "string":
                            typed_val = str(value)
                        elif value_type == "float":
                            typed_val = float(value)
                        elif value_type == "int":
                            typed_val = int(value)
                        elif value_type == "bool":
                            typed_val = value.lower() in ("true", "1", "yes", "on")
                        elif value_type == "token":
                            typed_val = value.strip()
                        elif value_type == "Vec3f":
                            cleaned = value.replace("(", "").replace(")", "")
                            parts = [float(x.strip()) for x in cleaned.split(",")]
                            typed_val = Gf.Vec3f(parts[0], parts[1], parts[2])
                        elif value_type == "Vec3d":
                            cleaned = value.replace("(", "").replace(")", "")
                            parts = [float(x.strip()) for x in cleaned.split(",")]
                            typed_val = Gf.Vec3d(parts[0], parts[1], parts[2])
                    except Exception as e:
                        print(f"[EditUSDPrim] Value parsing failed for type {value_type} and value '{value}': {e}")
                        raise ValueError(f"Failed to parse value '{value}' as type {value_type}: {e}")

                    if typed_val is not None:
                        attr = prim.GetAttribute(attribute_name)
                        if not attr.IsValid():
                            sdf_type_map = {
                                "string": Sdf.ValueTypeNames.String,
                                "float": Sdf.ValueTypeNames.Float,
                                "int": Sdf.ValueTypeNames.Int,
                                "bool": Sdf.ValueTypeNames.Bool,
                                "token": Sdf.ValueTypeNames.Token,
                                "Vec3f": Sdf.ValueTypeNames.Vector3f,
                                "Vec3d": Sdf.ValueTypeNames.Vector3d
                            }
                            type_name = sdf_type_map.get(value_type, Sdf.ValueTypeNames.String)
                            attr = prim.CreateAttribute(attribute_name, type_name)
                        attr.Set(typed_val)
                
                # Set visibility
                imageable = UsdGeom.Imageable(prim)
                if imageable:
                    imageable.CreateVisibilityAttr().Set(visibility)
                
            stage.GetRootLayer().comment = f"usd_path: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_path": out_path, "usda_text": new_usda_text},)
            
        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class ApplyUSDMaterial:
    CATEGORY = "USD"
    FUNCTION = "apply_material"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "material_prim_path": ("STRING", {"default": "/Root/Materials/Material"}),
                "mesh_prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "diffuse_color": ("STRING", {"default": "#cccccc"}),
                "roughness": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
                "metallic": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "emissive_color": ("STRING", {"default": "#000000"}),
                "opacity": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "ior": ("FLOAT", {"default": 1.5, "min": 0.0, "max": 5.0, "step": 0.01}),
            },
            "optional": {
                "diffuse_texture": ("STRING", {"default": "", "placeholder": "filename.png or /full/path.png"}),
                "roughness_texture": ("STRING", {"default": "", "placeholder": "filename.png or /full/path.png"}),
                "metallic_texture": ("STRING", {"default": "", "placeholder": "filename.png or /full/path.png"}),
            }
        }

    def apply_material(self, USD, material_prim_path, mesh_prim_path, diffuse_color, roughness, metallic, emissive_color, opacity, ior, diffuse_texture="", roughness_texture="", metallic_texture=""):
        from pxr import Usd, UsdShade, Sdf, Gf
        import uuid
        import fnmatch

        usd_path = USD.get("usd_path", "")
        usda_text = USD.get("usda_text", "")
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"material_{uuid.uuid4().hex}.usda")

        # Helper: resolve a texture name/path to a full absolute path.
        # Bare filenames (e.g. "texture.png") are looked up in ComfyUI's input directory.
        # Absolute paths are passed through unchanged.
        def resolve_tex_path(raw):
            if not raw or not raw.strip():
                return None
            raw = raw.strip()
            if os.path.isabs(raw):
                return raw if os.path.exists(raw) else None
            try:
                resolved = folder_paths.get_annotated_filepath(raw)
                return resolved if os.path.exists(resolved) else None
            except Exception:
                return None

        tex_diffuse_path   = resolve_tex_path(diffuse_texture)
        tex_roughness_path = resolve_tex_path(roughness_texture)
        tex_metallic_path  = resolve_tex_path(metallic_texture)

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        def hex_to_rgb(hex_str):
            if not hex_str:
                return 0.8, 0.8, 0.8
            hex_str = hex_str.lstrip('#')
            if len(hex_str) == 6:
                try:
                    r = int(hex_str[0:2], 16) / 255.0
                    g = int(hex_str[2:4], 16) / 255.0
                    b = int(hex_str[4:6], 16) / 255.0
                    return r, g, b
                except:
                    pass
            return 0.8, 0.8, 0.8

        diff_r, diff_g, diff_b = hex_to_rgb(diffuse_color)
        emis_r, emis_g, emis_b = hex_to_rgb(emissive_color)

        try:
            # Normalize material path
            if not material_prim_path.startswith("/"):
                material_prim_path = "/" + material_prim_path

            stage = Usd.Stage.Open(usd_path)
            
            # Define or retrieve material prim path
            material = UsdShade.Material.Define(stage, material_prim_path)
            
            # Create Preview Surface shader
            shader = UsdShade.Shader.Define(stage, f"{material_prim_path}/PreviewSurface")
            shader.CreateIdAttr().Set("UsdPreviewSurface")
            
            # Connect shader output to material surface terminal
            material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
            
            # Helper to create texture nodes
            def setup_texture(input_name, texture_path, value_type_name, connection_name):
                if not texture_path or not os.path.exists(texture_path):
                    return False
                
                # 1. Create UV reader
                reader_path = f"{material_prim_path}/uvReader_{input_name}"
                reader = UsdShade.Shader.Define(stage, reader_path)
                reader.CreateIdAttr().Set("UsdPrimvarReader_float2")
                reader.CreateInput("varname", Sdf.ValueTypeNames.Token).Set("st")
                
                # 2. Create texture node
                tex_path = f"{material_prim_path}/texture_{input_name}"
                tex = UsdShade.Shader.Define(stage, tex_path)
                tex.CreateIdAttr().Set("UsdUVTexture")
                tex.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(os.path.abspath(texture_path))
                tex.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), "result")
                
                # 3. Connect texture to preview shader
                shader.CreateInput(input_name, value_type_name).ConnectToSource(tex.ConnectableAPI(), connection_name)
                return True

            # Setup textures or fallback to constants
            if not setup_texture("diffuseColor", tex_diffuse_path, Sdf.ValueTypeNames.Color3f, "rgb"):
                shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(diff_r, diff_g, diff_b))
                
            if not setup_texture("roughness", tex_roughness_path, Sdf.ValueTypeNames.Float, "r"):
                shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(roughness)
                
            if not setup_texture("metallic", tex_metallic_path, Sdf.ValueTypeNames.Float, "r"):
                shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(metallic)
                
            shader.CreateInput("emissiveColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(emis_r, emis_g, emis_b))
            shader.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(opacity)
            shader.CreateInput("ior", Sdf.ValueTypeNames.Float).Set(ior)
            
            # Bind material to all normalized comma-separated targets (with wildcard matching)
            targets = [p.strip() for p in mesh_prim_path.split(",") if p.strip()]
            matched_prims = []
            for target_path in targets:
                if not target_path.startswith("/"):
                    target_path = "/" + target_path
                    
                if "*" in target_path or "?" in target_path:
                    for p in stage.Traverse():
                        if fnmatch.fnmatch(str(p.GetPath()), target_path):
                            matched_prims.append(p)
                else:
                    mesh_prim = stage.GetPrimAtPath(target_path)
                    if mesh_prim.IsValid():
                        matched_prims.append(mesh_prim)
                    else:
                        print(f"[ApplyUSDMaterial] Warning: mesh target path '{target_path}' not found, skipping binding.")
            
            for prim in matched_prims:
                UsdShade.MaterialBindingAPI(prim).Bind(material)
            
            stage.GetRootLayer().comment = f"usd_path: {os.path.abspath(out_path)}"
            stage.GetRootLayer().Export(out_path)
            
            new_usda_text = stage.GetRootLayer().ExportToString()
            return ({"usd_path": out_path, "usda_text": new_usda_text},)
            
        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class AddUSDSublayer:
    CATEGORY = "USD"
    FUNCTION = "add_sublayer"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "parent_USD": ("USD",),
                "sublayer_USD": ("USD",),
                "position": (["prepend", "append"],),
            },
            "optional": {
                "save_path": ("STRING", {"default": "", "placeholder": "/path/to/output.usda"}),
            }
        }

    def add_sublayer(self, parent_USD, sublayer_USD, position, save_path=""):
        from pxr import Usd
        import uuid
        
        parent_path = parent_USD.get("usd_path", "")
        parent_text = parent_USD.get("usda_text", "")
        sublayer_path = sublayer_USD.get("usd_path", "")
        sublayer_text = sublayer_USD.get("usda_text", "")
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        # Use the user-specified save path if provided, otherwise write to a temp location
        if save_path and save_path.strip():
            out_path = save_path.strip()
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
        else:
            out_path = os.path.join(temp_dir, f"sublayered_{uuid.uuid4().hex}.usda")
        
        temp_parent = None
        temp_sub = None
        
        if not parent_path or not os.path.exists(parent_path):
            temp_parent = os.path.join(temp_dir, f"temp_parent_{uuid.uuid4().hex}.usda")
            with open(temp_parent, "w") as f:
                f.write(parent_text)
            parent_path = temp_parent
            
        if not sublayer_path or not os.path.exists(sublayer_path):
            temp_sub = os.path.join(temp_dir, f"temp_sub_{uuid.uuid4().hex}.usda")
            with open(temp_sub, "w") as f:
                f.write(sublayer_text)
            sublayer_path = temp_sub
            
        try:
            stage = Usd.Stage.Open(parent_path)
            root_layer = stage.GetRootLayer()
            
            sublayer_abs = os.path.abspath(sublayer_path)
            
            if position == "prepend":
                root_layer.subLayerPaths.insert(0, sublayer_abs)
            else:
                root_layer.subLayerPaths.append(sublayer_abs)
                
            root_layer.comment = f"usd_path: {os.path.abspath(out_path)}"
            root_layer.Export(out_path)
            
            new_usda_text = root_layer.ExportToString()
            return ({"usd_path": out_path, "usda_text": new_usda_text},)
            
        finally:
            # Clean up temp inputs
            for temp_file in [temp_parent, temp_sub]:
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except:
                        pass