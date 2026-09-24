import os
import shutil
from pxr import Sdf, Usd
from .utils import OpenUSDError, resolve_usd_paths


class LoadUSD:
    """Load a USD stage from disk."""

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

    def load_usd(self, file_path: str):
        if not os.path.exists(file_path):
            raise OpenUSDError(f"File not found: {file_path}")

        stage = Usd.Stage.Open(file_path)
        if not stage:
            raise OpenUSDError(f"Failed to open USD stage from {file_path}")

        stage.Load()
        return (stage,)


class SaveUSD:
    """Save or export an active USD stage to disk."""

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
        layer_idents = [layer.identifier for layer in stage.GetUsedLayers()]

        for ident in layer_idents:
            layer = Sdf.Layer.FindOrOpen(ident)
            if layer is None or layer.anonymous:
                continue

            for ref in layer.GetExternalReferences():
                if not ref:
                    continue

                abs_src = layer.ComputeAbsolutePath(ref)
                if not os.path.exists(abs_src):
                    print(f"[SaveUSD] Warning: could not resolve external reference '{ref}' from {layer.identifier}")
                    continue

                if abs_src in copied:
                    new_ref = copied[abs_src]
                else:
                    os.makedirs(asset_folder, exist_ok=True)
                    ref_name = os.path.basename(abs_src)
                    dest = os.path.join(asset_folder, ref_name)

                    base, ext = os.path.splitext(ref_name)
                    counter = 1
                    while os.path.exists(dest) and not os.path.samefile(dest, abs_src):
                        dest = os.path.join(asset_folder, f"{base}_{counter}{ext}")
                        counter += 1

                    shutil.copy(abs_src, dest)
                    new_ref = dest
                    copied[abs_src] = new_ref

                layer.UpdateExternalReference(ref, new_ref)

    def save_usd(
        self,
        stage,
        output_path: str,
        make_paths_relative: bool,
        package_assets: bool,
        flatten_stage: bool,
    ):
        if stage is None:
            raise OpenUSDError("Invalid USD Stage")

        stage.Load()

        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        root_layer = stage.GetRootLayer()
        if flatten_stage:
            root_layer = stage.Flatten()

        resolve_usd_paths(root_layer, relative=False)
        root_layer.Export(output_path)

        saved_stage = Usd.Stage.Open(output_path)
        saved_stage.Load()
        saved_root_layer = saved_stage.GetRootLayer()

        if package_assets:
            self._package_assets(saved_stage)

        resolve_usd_paths(saved_root_layer, relative=make_paths_relative)
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