from .color import CreateUSDColor
from .matrix import CreateUSDMatrix
from .quat import CreateUSDQuat
from .token import CreateUSDToken
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
    "CreateUSDVec4": CreateUSDVec4,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CreateUSDColor": "USD Color",
    "CreateUSDMatrix": "USD Matrix",
    "CreateUSDQuat": "USD Quaternion",
    "CreateUSDToken": "USD Token",
    "CreateUSDVec2": "USD Vec2",
    "CreateUSDVec3": "USD Vec3",
    "CreateUSDVec4": "USD Vec4",
}