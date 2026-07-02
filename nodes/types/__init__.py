from .color import CreateUSDColor
from .matrix import CreateUSDMatrix
from .token import CreateUSDToken
from .quat import CreateUSDQuat
from .vec2 import CreateUSDVec2
from .vec3 import CreateUSDVec3
from .vec4 import CreateUSDVec4

NODE_CLASS_MAPPINGS = {
    "CreateUSDColor": CreateUSDColor,
    "CreateUSDMatrix": CreateUSDMatrix,
    "CreateUSDQuat": CreateUSDQuat,
    "CreateUSDToken": CreateUSDToken,

    "CreateUSDVec2": CreateUSDVec2,
    "CreateUSDVec3": CreateUSDVec3,
    "CreateUSDVec4": CreateUSDVec4
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CreateUSDColor": "Create USD Color",
    "CreateUSDMatrix": "Create USD Matrix",
    "CreateUSDQuat": "Create USD Quaternion",
    "CreateUSDToken": "Create USD Token (String)",

    "CreateUSDVec2": "Create USD Vec2",
    "CreateUSDVec3": "Create USD Vec3",
    "CreateUSDVec4": "Create USD Vec4"
}