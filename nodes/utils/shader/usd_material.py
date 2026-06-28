import os
import folder_paths

class ApplyUSDMaterial:
    CATEGORY = "3d/USD"
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
                "diffuse_color": ("COLOR", {"default": "#cccccc"}),
                "roughness": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
                "metallic": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "emissive_color": ("COLOR", {"default": "#000000"}),
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