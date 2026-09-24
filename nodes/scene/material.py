import os
import folder_paths
from pxr import Gf, Sdf, UsdShade
from ..utils import OpenUSDError, find_prims, hex_to_rgba


class ApplyUSDMaterial:
    CATEGORY = "3d/usd/scene"
    FUNCTION = "apply_material"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
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
            },
        }

    def apply_material(
        self,
        stage,
        material_prim_path: str,
        mesh_prim_path: str,
        diffuse_color: str,
        roughness: float,
        metallic: float,
        emissive_color: str,
        opacity: float,
        ior: float,
        diffuse_texture: str = "",
        roughness_texture: str = "",
        metallic_texture: str = "",
    ):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        # Helper: resolve a texture name/path to a full absolute path.
        # Bare filenames (e.g. "texture.png") are looked up in ComfyUI's input directory.
        # Absolute paths are passed through unchanged.
        def resolve_tex_path(raw: str):
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

        tex_diffuse_path = resolve_tex_path(diffuse_texture)
        tex_roughness_path = resolve_tex_path(roughness_texture)
        tex_metallic_path = resolve_tex_path(metallic_texture)

        diff_r, diff_g, diff_b, _ = hex_to_rgba(diffuse_color)
        emis_r, emis_g, emis_b, _ = hex_to_rgba(emissive_color)

        # Normalize material path
        if not material_prim_path.startswith("/"):
            material_prim_path = "/" + material_prim_path

        # Define or retrieve material prim path
        material = UsdShade.Material.Define(stage_obj, material_prim_path)

        # Create Preview Surface shader
        shader = UsdShade.Shader.Define(stage_obj, f"{material_prim_path}/PreviewSurface")
        shader.CreateIdAttr().Set("UsdPreviewSurface")

        # Connect shader output to material surface terminal
        material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")

        # Helper to create texture nodes
        def setup_texture(input_name: str, texture_path: str, value_type_name, connection_name: str) -> bool:
            if not texture_path or not os.path.exists(texture_path):
                return False

            # 1. Create UV reader
            reader_path = f"{material_prim_path}/uvReader_{input_name}"
            reader = UsdShade.Shader.Define(stage_obj, reader_path)
            reader.CreateIdAttr().Set("UsdPrimvarReader_float2")
            reader.CreateInput("varname", Sdf.ValueTypeNames.Token).Set("st")

            # 2. Create texture node
            tex_path = f"{material_prim_path}/texture_{input_name}"
            tex = UsdShade.Shader.Define(stage_obj, tex_path)
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

        matched_prims = find_prims(stage_obj, mesh_prim_path)
        for prim in matched_prims:
            UsdShade.MaterialBindingAPI(prim).Bind(material)

        return (stage,)