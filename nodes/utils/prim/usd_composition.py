import os
import uuid
import folder_paths
import fnmatch

class AddUSDSublayer:
    CATEGORY = "3d/USD/Composition"
    FUNCTION = "add_sublayer"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "sublayer_path": ("STRING", {"default": "path/to/sublayer.usda", "path": True}),
                "position": (["prepend", "append"], {"default": "prepend"}),
            }
        }

    def add_sublayer(self, USD, sublayer_path, position="prepend"):
        from pxr import Usd
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"sublayer_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            stage = Usd.Stage.Open(usd_path)
            root_layer = stage.GetRootLayer()
            
            abs_sub_path = os.path.abspath(sublayer_path)
            
            # Remove duplicate reference if it exists
            sub_paths = list(root_layer.subLayerPaths)
            if abs_sub_path in sub_paths:
                sub_paths.remove(abs_sub_path)
            
            if position == "prepend":
                sub_paths.insert(0, abs_sub_path)
            else:
                sub_paths.append(abs_sub_path)
                
            root_layer.subLayerPaths = sub_paths
            
            root_layer.comment = f"usd_info: {os.path.abspath(out_path)}"
            root_layer.Export(out_path)
            new_usda_text = root_layer.ExportToString()
            return ({"usd_info": out_path, "usda_text": new_usda_text},)

        finally:
            if temp_in and os.path.exists(temp_in):
                try:
                    os.remove(temp_in)
                except:
                    pass

class AddUSDReferenceOrPayload:
    CATEGORY = "3d/USD/Composition"
    FUNCTION = "add_reference_or_payload"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "arc_type": (["reference", "payload"], {"default": "reference"}),
                "file_path": ("STRING", {"default": "", "path": True}),
                "target_prim_mode": (["Use default prim", "specify prim"], {"default": "Use default prim"}),
                "referenced_prim_path": ("STRING", {"default": ""}),
            }
        }

    def add_reference_or_payload(self, USD, prim_path, arc_type, file_path, target_prim_mode, referenced_prim_path=""):
        from pxr import Usd, Sdf
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"{arc_type}_{uuid.uuid4().hex}.usda")

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

            ref_prim_path_obj = Sdf.Path.emptyPath
            if target_prim_mode == "specify prim" and referenced_prim_path.strip():
                ref_prim_path_obj = Sdf.Path(referenced_prim_path.strip())
                
            ref_file = os.path.abspath(file_path) if file_path.strip() else ""

            for prim in matched_prims:
                if arc_type == "reference":
                    prim.GetReferences().AddReference(assetPath=ref_file, primPath=ref_prim_path_obj)
                else:
                    prim.GetPayloads().AddPayload(assetPath=ref_file, primPath=ref_prim_path_obj)

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

class AddUSDVariant:
    CATEGORY = "3d/USD/Composition"
    FUNCTION = "add_variant"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "variant_set_name": ("STRING", {"default": "shadingVariant"}),
                "variant_name": ("STRING", {"default": "default"}),
                "set_selection": ("BOOLEAN", {"default": True}),
            }
        }

    def add_variant(self, USD, prim_path, variant_set_name, variant_name, set_selection=True):
        from pxr import Usd
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"variant_{uuid.uuid4().hex}.usda")

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
                vsets = prim.GetVariantSets()
                vset = vsets.AddVariantSet(variant_set_name)
                vset.AddVariant(variant_name)
                
                if set_selection:
                    vset.SetVariantSelection(variant_name)

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

class AddUSDInherit:
    CATEGORY = "3d/USD/Composition"
    FUNCTION = "add_inherit"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "inherit_prim_path": ("STRING", {"default": "/_class_Mesh"}),
            }
        }

    def add_inherit(self, USD, prim_path, inherit_prim_path):
        from pxr import Usd, Sdf
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"inherit_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path
            if not inherit_prim_path.startswith("/"):
                inherit_prim_path = "/" + inherit_prim_path

            stage = Usd.Stage.Open(usd_path)
            
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
                prim.GetInherits().AddInherit(Sdf.Path(inherit_prim_path))

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

class AddUSDSpecializes:
    CATEGORY = "3d/USD/Composition"
    FUNCTION = "add_specialize"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "specializes_prim_path": ("STRING", {"default": "/_spec_Mesh"}),
            }
        }

    def add_specialize(self, USD, prim_path, specializes_prim_path):
        from pxr import Usd, Sdf
        
        usd_path = USD.get("usd_info", "")
        usda_text = USD.get("usda_text", "")

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        out_path = os.path.join(temp_dir, f"specialize_{uuid.uuid4().hex}.usda")

        temp_in = None
        if not usd_path or not os.path.exists(usd_path):
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.usda")
            with open(temp_in, "w") as f:
                f.write(usda_text)
            usd_path = temp_in

        try:
            if not prim_path.startswith("/"):
                prim_path = "/" + prim_path
            if not specializes_prim_path.startswith("/"):
                specializes_prim_path = "/" + specializes_prim_path

            stage = Usd.Stage.Open(usd_path)
            
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
                prim.GetSpecializes().AddSpecialize(Sdf.Path(specializes_prim_path))

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
