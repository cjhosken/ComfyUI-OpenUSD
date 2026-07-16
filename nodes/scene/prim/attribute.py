import json
from ...utils import find_prims
from ...types.utils import CONVERTERS, set_usd_data

USD_TYPE_LIST = sorted(list(CONVERTERS.keys()))

class GetUSDAttribute:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "get_attribute"
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("value",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "attribute_name": ("STRING", {"default": "myAttribute"}),
                "is_primvar": ("BOOLEAN", {"default": True})
            }
        }

    def get_attribute(self, USD, prim_path, attribute_name, is_primvar):
        stage = USD.get("stage", None)

        if stage is None:
            raise RuntimeError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        prim = stage.GetPrimAtPath(prim_path)
            
        if not prim.IsValid():
            print(f"[GetUSDAttribute] Warning: Prim '{prim_path}' not found.")
            return (None,)

        attr = prim.GetAttribute(attribute_name)
        if not attr.IsValid() or not attr.HasValue():
            if is_primvar:
                if not attribute_name.startswith("primvars:"):
                    attr = prim.GetAttribute(f"primvars:{attribute_name}")
            
        if not attr.IsValid() or not attr.HasValue():
            print(f"[GetUSDAttribute] Warning: Attribute '{attribute_name}' not found on '{prim_path}'.")
            return (None,)

        val = attr.Get()
        if val is None:
            return (None,)

        return json.dumps({
            "data": val,
            "type": attr.GetTypeName().GetAsToken()
        })


class SetUSDAttribute:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "set_attribute"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "usd_attribute_name": ("STRING", {"default": "myAttribute"}),
                "usd_attribute_type": (USD_TYPE_LIST, {"default": "vector3f"}),

                "is_primvar": ("BOOLEAN", {"default": True}),
                "value": ("*",)
            }
        }


    def set_attribute(self, USD, prim_path, usd_attribute_name, usd_attribute_type, is_primvar, value):
        stage = USD.get("stage", None)
        if stage is None:
            raise RuntimeError("Invalid USD stage")

        matched_prims = find_prims(stage, prim_path)
        if not matched_prims:
            raise RuntimeError(f"No prims matched: {prim_path}")

        for prim in matched_prims:
            set_usd_data(
                prim,
                usd_attribute_name,
                value,
                usd_attribute_type,
                is_primvar
            )

        return ({"stage":stage},)