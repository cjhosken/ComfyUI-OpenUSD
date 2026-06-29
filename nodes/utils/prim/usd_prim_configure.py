import folder_paths

class ConfigureUSDPrim:
    CATEGORY = "3d/USD/Prim"
    FUNCTION = "configure_prim"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "active": ("BOOLEAN", {"default": True, "label": "Active"}),
                "visibility": (["inherited", "visible", "invisible"], {"default": "inherited"}),
                "purpose": (["default", "render", "proxy", "guide"], {"default": "default"}),
                "kind": ("STRING", {"default": "", "placeholder": "e.g., component, group, assembly"}),
                "comment": ("STRING", {"default": "", "multiline": True, "placeholder": "Add a comment about this prim"}),
            }
        }

    def configure_prim(self, USD, prim_path, active=True, visibility="inherited", 
                       purpose="default", kind="", comment=""):
        from pxr import Usd, UsdGeom, Sdf
        import os
        import uuid

        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)

        # Use the original USD path if it exists
        if usd_path and os.path.exists(usd_path):
            stage = Usd.Stage.Open(usd_path)
            is_temp = False
        else:
            # If no valid file path, create a temp file from the usda_text
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            stage = Usd.Stage.Open(temp_in)
            usd_path = temp_in
            is_temp = True

        try:
            # Ensure leading slash for prim path
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path

            # Get or create prim
            prim = stage.GetPrimAtPath(prim_path)
            if not prim.IsValid():
                # Create the prim with default type
                prim = stage.DefinePrim(prim_path, "Xform")
                print(f"[ConfigureUSDPrim] Created new prim at {prim_path}")

            # 1. Set active state
            if hasattr(prim, 'SetActive'):
                prim.SetActive(active)

            # 2. Set visibility
            if prim.IsA(UsdGeom.Imageable):
                imageable = UsdGeom.Imageable(prim)
                if imageable:
                    imageable.CreateVisibilityAttr().Set(visibility)

            # 3. Set purpose
            if prim.IsA(UsdGeom.Gprim):
                geom = UsdGeom.Gprim(prim)
                if geom:
                    geom.CreatePurposeAttr().Set(purpose)

            # 4. Set kind
            if kind and kind.strip():
                try:
                    if hasattr(prim, 'SetKind'):
                        prim.SetKind(kind.strip())
                except Exception as e:
                    print(f"[ConfigureUSDPrim] Error setting kind: {e}")

            # 5. Set comment
            if comment and comment.strip():
                try:
                    prim_spec = prim.GetPrimSpec()
                    if prim_spec:
                        prim_spec.SetField('comment', comment.strip())
                    else:
                        layer = stage.GetRootLayer()
                        prim_spec = layer.GetPrimSpec(prim_path)
                        if prim_spec:
                            prim_spec.SetField('comment', comment.strip())
                except Exception as e:
                    print(f"[ConfigureUSDPrim] Error setting comment: {e}")

            # Save changes
            stage.GetRootLayer().Save()

            # Get the updated usda text
            new_usda_text = stage.GetRootLayer().ExportToString()

            # Return the updated USD dict
            return ({
                "usd_info": usd_path,
                "usda_text": new_usda_text
            },)

        except Exception as e:
            print(f"[ConfigureUSDPrim] Error: {e}")
            return (USD,)

        finally:
            # Clean up temp file if we created one
            if is_temp and usd_path and os.path.exists(usd_path):
                try:
                    os.remove(usd_path)
                except:
                    pass