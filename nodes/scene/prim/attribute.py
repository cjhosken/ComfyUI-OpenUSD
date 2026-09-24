import json
from ...types.utils import CONVERTERS, set_usd_data
from ...utils import OpenUSDError, find_prims

USD_TYPE_LIST = sorted(list(CONVERTERS.keys()))


def _serialize_usd_value(val):
    """Recursively convert USD/Gf/Vt types to JSON-serializable Python objects."""
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    if hasattr(val, "path"):
        return val.path
    if hasattr(val, "GetReal") and hasattr(val, "GetImaginary"):
        return [float(val.GetReal()), *(float(x) for x in val.GetImaginary())]
    if hasattr(val, "__len__") and not isinstance(val, (str, bytes, dict)):
        return [_serialize_usd_value(x) for x in val]
    try:
        json.dumps(val)
        return val
    except Exception:
        return str(val)


class GetUSDAttribute:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "get_attribute"
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("value",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "attribute_name": ("STRING", {"default": "myAttribute"}),
                "is_primvar": ("BOOLEAN", {"default": True}),
            }
        }

    def get_attribute(self, stage, prim_path: str, attribute_name: str, is_primvar: bool):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        if not prim_path.startswith("/"):
            prim_path = "/" + prim_path

        prim = stage_obj.GetPrimAtPath(prim_path)
        if not prim.IsValid():
            print(f"[GetUSDAttribute] Warning: Prim '{prim_path}' not found.")
            return (None,)

        attr = prim.GetAttribute(attribute_name)
        if not attr.IsValid() or not attr.HasValue():
            if is_primvar and not attribute_name.startswith("primvars:"):
                attr = prim.GetAttribute(f"primvars:{attribute_name}")

        if not attr.IsValid() or not attr.HasValue():
            print(f"[GetUSDAttribute] Warning: Attribute '{attribute_name}' not found on '{prim_path}'.")
            return (None,)

        val = attr.Get()
        if val is None:
            return (None,)

        payload = json.dumps({
            "data": _serialize_usd_value(val),
            "type": str(attr.GetTypeName()),
        })
        return (payload,)



class SetUSDAttribute:
    CATEGORY = "3d/usd/prim"
    FUNCTION = "set_attribute"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage": ("USD",),
                "prim_path": ("STRING", {"default": "/Root/Mesh"}),
                "usd_attribute_name": ("STRING", {"default": "myAttribute"}),
                "usd_attribute_type": (USD_TYPE_LIST, {"default": "vector3f"}),
                "is_primvar": ("BOOLEAN", {"default": True}),
                "value": ("*",),
            }
        }

    def set_attribute(self, stage, prim_path: str, usd_attribute_name: str, usd_attribute_type: str, is_primvar: bool, value):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        stage_obj = stage.get("stage") if isinstance(stage, dict) else stage
        if stage_obj is None:
            raise OpenUSDError("Invalid USD stage")

        matched_prims = find_prims(stage_obj, prim_path)
        if not matched_prims:
            raise OpenUSDError(f"No prims matched: {prim_path}")

        for prim in matched_prims:
            set_usd_data(
                prim,
                usd_attribute_name,
                value,
                usd_attribute_type,
                is_primvar,
            )

        return (stage,)