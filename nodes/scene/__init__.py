from .prim.attribute import GetUSDAttribute, SetUSDAttribute
from .prim.color import SetUSDPrimDisplayColor
from .camera import CreateUSDCamera
from .light import CreateUSDLight
from .material import ApplyUSDMaterial
from .transform import TransformUSDPrim
from .prim.configure import ConfigureUSDPrim
from .prim.prim import GetUSDPrimUSDA, SetUSDPrimUSDA

NODE_CLASS_MAPPINGS = {
    "SetUSDPrimDisplayColor": SetUSDPrimDisplayColor,
    "GetUSDAttribute": GetUSDAttribute,
    "SetUSDAttribute": SetUSDAttribute,
    "CreateUSDCamera": CreateUSDCamera,
    "CreateUSDLight": CreateUSDLight,
    "ApplyUSDMaterial": ApplyUSDMaterial,
    "TransformUSDPrim": TransformUSDPrim,
    "ConfigureUSDPrim": ConfigureUSDPrim,
    #"GetUSDPrimUSDA": GetUSDPrimUSDA,
    #"SetUSDPrimUSDA": SetUSDPrimUSDA
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SetUSDPrimDisplayColor": "Set USD Prim Display Color",
    "GetUSDAttribute": "Get USD Attribute/Primvar",
    "SetUSDAttribute": "Set USD Attribute/Primvar",
    "CreateUSDCamera": "Create USD Camera",
    "CreateUSDLight": "Create USD Light",
    "ApplyUSDMaterial": "Apply USD Material",
    "TransformUSDPrim": "Transform USD Prim",
    "ConfigureUSDPrim": "Configure USD Prim",
    #"GetUSDPrimUSDA": "Get USD Prim USDA",
    #"SetUSDPrimUSDA": "Set USD Prim USDA"
}