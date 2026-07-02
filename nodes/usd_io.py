import os
import shutil
from pxr import Usd, Sdf

class LoadUSD:
    CATEGORY = "3d/USD/IO"
    FUNCTION = "load_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

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

    def load_usd(self, file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"USD file not found at {file_path}")

        try:
            stage = Usd.Stage.Open(file_path)
        except Exception:
            stage = Usd.Stage.CreateInMemory()

        return ({"stage": stage},)


class SaveUSD:
    CATEGORY = "3d/USD/IO"
    FUNCTION = "save_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
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

    def _resolve_paths(self, layer, relative=False):
        anchor_path = os.path.abspath(layer.realPath)

        for ref in layer.GetExternalReferences():
            if (os.path.isabs(ref)):
                if relative:
                    new_ref = ref.replace(os.path.dirname(anchor_path), "./")
                    layer.UpdateExternalReference(ref, new_ref)
            else:
                if not relative:
                    new_ref = os.path.normpath(os.path.join(os.path.dirname(anchor_path), ref))
                    layer.UpdateExternalReference(ref, new_ref)
                    

    def _package_assets(self, stage, relative=False):
        root_dir = os.path.dirname(os.path.abspath(stage.GetRootLayer().realPath))
        asset_folder = os.path.join(root_dir, "assets")
        copied = {}

        layer_ids = [l.identifier for l in stage.GetUsedLayers()]

        for layer_id in layer_ids:
            layer = Sdf.Layer.FindOrOpen(layer_id)
            if layer is None or layer.anonymous:
                continue

            for ref in layer.GetExternalReferences():
                if not ref:
                    continue

                abs_src = layer.ComputeAbsolutePath(ref)
                if not os.path.exists(abs_src):
                    print(f"[SaveUSD] Warning: could not resolve '{ref}' from {layer.identifier}")
                    continue

                if abs_src in copied:
                    new_ref = copied[abs_src]

                else:
                    os.makedirs(asset_folder, exist_ok=True)
                    ref_name = os.path.basename(abs_src)
                    dest = os.path.join(asset_folder, ref_name)

                    # avoid clobbering distinct source files that share a basename
                    base, ext = os.path.splitext(ref_name)
                    n = 1
                    while os.path.exists(dest) and not os.path.samefile(dest, abs_src) if os.path.exists(dest) else False:
                        dest = os.path.join(asset_folder, f"{base}_{n}{ext}")
                        n += 1

                    shutil.copy(abs_src, dest)
                    new_ref = dest
                    copied[abs_src] = new_ref

                layer.UpdateExternalReference(ref, new_ref)

    def save_usd(self, USD, output_path, make_paths_relative, package_assets, flatten_stage):

        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        root_layer = stage.GetRootLayer()

        if flatten_stage:
            root_layer = stage.Flatten()

        self._resolve_paths(root_layer, False)

        root_layer.Export(output_path)

        saved_stage = Usd.Stage.Open(output_path)
        saved_root_layer = saved_stage.GetRootLayer()

        if package_assets:
            self._package_assets(saved_stage, make_paths_relative)

        self._resolve_paths(saved_root_layer, make_paths_relative)
        
        saved_root_layer.Save()

        print(f"[SaveUSD] Saved correctly with textures resolved to {output_path}")

        return ({"stage":saved_stage})