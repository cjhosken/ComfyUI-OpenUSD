import os
import shutil
from pxr import Usd, Sdf
from .utils import OpenUSDError, resolve_usd_paths

class LoadUSD:
    CATEGORY = "3d/usd/io"
    FUNCTION = "load_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "file_path": (
                    "STRING",
                    {
                        "default": "path/to/file.usd",
                        "multiline": False,
                        "path": True,
                    },
                ),
            }
        }
    
    @classmethod
    def IS_CHANGED(cls, file_path):
        return float("NaN")

    def load_usd(self, file_path):
        if not os.path.exists(file_path):
            raise OpenUSDError(f"file not found at {file_path}")

        stage = Usd.Stage.Open(file_path)
        stage.Load()

        return (stage,)

class SaveUSD:
    CATEGORY = "3d/usd/io"
    FUNCTION = "save_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "output_path": (
                    "STRING",
                    {
                        "default": "path/to/file.usda",
                        "multiline": False,
                        "path": True,
                    },
                ),
                "make_paths_relative": ("BOOLEAN", {"default": True}),
                "package_assets": ("BOOLEAN", {"default": False}),
                "flatten_stage": ("BOOLEAN", {"default": False}),
            }
        }

    def _package_assets(self, stage):
        root_dir = os.path.dirname(os.path.abspath(stage.GetRootLayer().realPath))
        asset_folder = os.path.join(root_dir, "assets")

        if os.path.exists(asset_folder):
            shutil.rmtree(asset_folder)

        copied = {}

        layer_idents = [l.identifier for l in stage.GetUsedLayers()]

        for ident in layer_idents:
            lyr = Sdf.Layer.FindOrOpen(ident)
            
            if lyr is None or lyr.anonymous:
                continue

            for ref in lyr.GetExternalReferences():
                if not ref:
                    continue

                abs_src = lyr.ComputeAbsolutePath(ref)

                if not os.path.exists(abs_src):
                    print(f"[SaveUSD] Warning: could not resolve '{ref}' from {lyr.identifier}")
                    continue

                if abs_src in copied:
                    new_ref = copied[abs_src]

                else:
                    os.makedirs(asset_folder, exist_ok=True)
                    ref_name = os.path.basename(abs_src)
                    dest = os.path.join(asset_folder, ref_name)

                    base, ext = os.path.splitext(ref_name)
                    n = 1
                    while os.path.exists(dest) and not os.path.samefile(dest, abs_src):
                        dest = os.path.join(asset_folder, f"{base}_{n}{ext}")
                        n += 1

                    shutil.copy(abs_src, dest)
                    new_ref = dest
                    copied[abs_src] = new_ref

                lyr.UpdateExternalReference(ref, new_ref)

    def save_usd(self, stage, output_path, make_paths_relative, package_assets, flatten_stage):

        if stage is None:
            raise OpenUSDError("Invalid Stage")

        stage.Load()

        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        root_layer = stage.GetRootLayer()

        if flatten_stage:
            root_layer = stage.Flatten()

        resolve_usd_paths(root_layer, False)

        root_layer.Export(output_path)

        saved_stage = Usd.Stage.Open(output_path)
        saved_stage.Load()
        saved_root_layer = saved_stage.GetRootLayer()

        if package_assets:
            self._package_assets(saved_stage)

        resolve_usd_paths(saved_root_layer, make_paths_relative)
        
        saved_root_layer.Save()

        return (saved_stage,)
    

NODE_CLASS_MAPPINGS = {
    "LoadUSD": LoadUSD,
    "SaveUSD": SaveUSD,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadUSD": "Load USD",
    "SaveUSD": "Save USD",
}