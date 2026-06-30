import os

class LoadUSD:
    CATEGORY = "3d/USD/IO"
    FUNCTION = "load_openusd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_info": (
                    "STRING",
                    {
                        "default":"path/to/file.usd",
                        "multiline": False,
                        "path": True,
                    },
                ),
            }
        }
    
    def load_openusd(self, usd_info):
        if not os.path.exists(usd_info):
            raise FileNotFoundError(f"USD file not found at {usd_info}")
        
        usda_text = ""
        try:
            from pxr import Usd

            stage = Usd.Stage.Open(usd_info)
            if stage:
                usda_text = stage.GetRootLayer().ExportToString()
            else:
                usda_text = "Failed to open USD Stage."

        except ImportError:
            usda_text = (
                "Error: 'pxr-usd-api' library is not installed.\n"
                "Please run 'pip install pxr-usd-api' in your ComfyUI environment."
            )
        except Exception as e:
            usda_text = f"An error occured while processing the USD file:\n{str(e)}"
        
        return ({"usd_info": usd_info, "usda_text": usda_text},)

class SaveUSD:
    CATEGORY = "3d/USD/IO"
    FUNCTION = "save_openusd"
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
                        "default":"path/to/file.usda",
                        "multiline": False,
                        "path": True,
                    },
                ),
                "package_assets": ("BOOLEAN", {"default": False}),
                "flatten_stage": ("BOOLEAN", {"default": False}),
            }
        }
    
    def save_openusd(self, USD, output_path, package_assets, flatten_stage):
        usda_text = USD.get("usda_text", "")
        usd_path = USD.get("usd_info", "")

        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        try:
            from pxr import Usd, UsdGeom, Sdf
            import shutil

            if usda_text.startswith("Error:") or usda_text.startswith("An error occured"):
                raise ValueError("Cannot save USD because the input USDA text contains an error message.")
            
            # 1. Parse upstream stage using a temp file in the original base directory
            # so that relative references and sublayers resolve correctly
            import uuid
            base_dir = os.path.dirname(os.path.abspath(usd_path)) if usd_path and os.path.exists(usd_path) else os.path.dirname(os.path.abspath(output_path))
            temp_path = os.path.join(base_dir, f"temp_save_{uuid.uuid4().hex}.usda")
            
            try:
                with open(temp_path, "w", encoding="utf-8") as f:
                    f.write(usda_text)
                
                upstream_stage = Usd.Stage.Open(temp_path)
                upstream_stage.Load()
                
                if flatten_stage:
                    # Flatten directly from the resolved upstream stage
                    flat_layer = upstream_stage.Flatten()
                    flat_layer.Export(output_path)
                    stage = Usd.Stage.Open(output_path)
                else:
                    # 2. Check if output path exists for appending
                    if os.path.exists(output_path):
                        stage = Usd.Stage.Open(output_path)
                    else:
                        stage = Usd.Stage.CreateNew(output_path)
                        # Copy stage metadata like upAxis and metersPerUnit
                        UsdGeom.SetStageUpAxis(stage, UsdGeom.GetStageUpAxis(upstream_stage))
                        UsdGeom.SetStageMetersPerUnit(stage, UsdGeom.GetStageMetersPerUnit(upstream_stage))

                    # 3. Copy/merge all prims and attributes from upstream to disk stage
                    for upstream_prim in upstream_stage.Traverse():
                        prim_path = upstream_prim.GetPath()
                        prim = stage.GetPrimAtPath(prim_path)
                        if not prim.IsValid():
                            prim = stage.DefinePrim(prim_path, upstream_prim.GetTypeName())
                        
                        # Copy attributes
                        for upstream_attr in upstream_prim.GetAttributes():
                            attr_name = upstream_attr.GetName()
                            attr = prim.GetAttribute(attr_name)
                            if not attr.IsValid():
                                attr = prim.CreateAttribute(attr_name, upstream_attr.GetTypeName())
                            
                            # Copy default value
                            if upstream_attr.HasValue():
                                val = upstream_attr.Get()
                                if val is not None:
                                    attr.Set(val)
                            
                            # Copy time samples
                            for ts in upstream_attr.GetTimeSamples():
                                attr.Set(upstream_attr.Get(ts), ts)
                    
                    # Copy sublayers if present
                    sublayers = list(upstream_stage.GetRootLayer().subLayerPaths)
                    clean_sublayers = []
                    for path in sublayers:
                        norm_path = path.replace("\\", "/").lower()
                        if "/tmp/" in norm_path or "layer_break" in norm_path or "temp_in" in norm_path:
                            continue
                        clean_sublayers.append(path)
                    
                    if clean_sublayers:
                        # Add sublayers if they are not already in the disk stage
                        existing_sublayers = list(stage.GetRootLayer().subLayerPaths)
                        for path in clean_sublayers:
                            if path not in existing_sublayers:
                                existing_sublayers.append(path)
                        stage.GetRootLayer().subLayerPaths = existing_sublayers
                    
                    stage.GetRootLayer().Save()
            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass

            # 5. Package assets if requested
            if package_assets:
                usd_dir = os.path.dirname(os.path.abspath(output_path))
                assets_dir = os.path.join(usd_dir, "assets")
                os.makedirs(assets_dir, exist_ok=True)
                
                # Package sublayers
                sublayers = list(stage.GetRootLayer().subLayerPaths)
                new_sublayers = []
                for path in sublayers:
                    resolved = stage.GetRootLayer().ResolveRelativePathWithinLookups(path) or path
                    if resolved and os.path.exists(resolved):
                        filename = os.path.basename(resolved)
                        dest = os.path.join(assets_dir, filename)
                        try:
                            shutil.copy2(resolved, dest)
                            new_sublayers.append(f"assets/{filename}")
                        except Exception as e:
                            print(f"[SaveUSD] Failed to copy sublayer {resolved}: {e}")
                            new_sublayers.append(path)
                    else:
                        new_sublayers.append(path)
                stage.GetRootLayer().subLayerPaths = new_sublayers
                
                # Package references and texture maps
                for prim in stage.Traverse():
                    for attr in prim.GetAttributes():
                        val = attr.Get()
                        if isinstance(val, Sdf.AssetPath):
                            path = val.path
                            resolved = val.resolvedPath or path
                            if not path or "/tmp/" in path.lower():
                                continue
                            if resolved and os.path.exists(resolved):
                                filename = os.path.basename(resolved)
                                dest = os.path.join(assets_dir, filename)
                                try:
                                    shutil.copy2(resolved, dest)
                                    attr.Set(Sdf.AssetPath(f"assets/{filename}"))
                                except Exception as e:
                                    print(f"[SaveUSD] Failed to copy asset {resolved}: {e}")

            # Save root layer to disk
            stage.GetRootLayer().Save()
            print(f"[SaveUSD] Successfully saved USD stage to {output_path}")

        except ImportError:
            raise RuntimeError(
                "Error: 'pxr-usd-api' library is not installed.\n"
                "Please run 'pip install pxr-usd-api' in your ComfyUI environment."
            )
        except Exception as e:
            raise RuntimeError(f"An error occured while saving the USD file:\n{str(e)}")
        
        return (USD,)