import json
from pxr import UsdGeom, Sdf, Gf, Vt
from ..utils import hex_to_rgba

CONVERTERS = {
    # -------------------------
    # SCALARS
    # -------------------------
    "bool":      (bool, None),
    "uchar":     (int, None),
    "int":       (int, None),
    "uint":      (int, None),
    "int64":     (int, None),
    "uint64":    (int, None),
    "half":      (float, None),
    "float":     (float, None),
    "double":    (float, None),
    "timecode":  (float, None),
    "string":    (str, None),
    "token":     str,   # token behaves like string in Python layer
    "asset":     str,
    "opaque":    str,
    "group":     str,

    # -------------------------
    # 2D VECTORS
    # -------------------------
    "int2":       (lambda x: tuple(x), None),
    "half2":      (lambda x: tuple(map(float, x)), None),
    "float2":     (Gf.Vec2f, Vt.Vec2fArray),
    "double2":    (Gf.Vec2d, Vt.Vec2dArray),
    "texCoord2f": (Gf.Vec2f, Vt.Vec2fArray),
    "texCoord2d":  (Gf.Vec2d, Vt.Vec2dArray),
    "texCoord2h": (lambda x: tuple(map(float, x)), None),

    # -------------------------
    # 3D VECTORS
    # -------------------------
    "int3":       (lambda x: tuple(x), None),
    "half3":      (lambda x: tuple(map(float, x)), None),
    "float3":     (Gf.Vec3f, Vt.Vec3fArray),
    "double3":    (Gf.Vec3d, Vt.Vec3dArray),

    "point3f":    (Gf.Vec3f, Vt.Vec3fArray),
    "vector3f":   (Gf.Vec3f, Vt.Vec3fArray),
    "normal3f":   (Gf.Vec3f, Vt.Vec3fArray),
    "texCoord3f": (Gf.Vec3f, Vt.Vec3fArray),

    "point3d":    (Gf.Vec3d, Vt.Vec3dArray),
    "vector3d":   (Gf.Vec3d, Vt.Vec3dArray),
    "normal3d":   (Gf.Vec3d, Vt.Vec3dArray),
    "texCoord3d": (Gf.Vec3d, Vt.Vec3dArray),

    "point3h":    (lambda x: tuple(map(float, x)), None),
    "vector3h":   (lambda x: tuple(map(float, x)), None),
    "normal3h":   (lambda x: tuple(map(float, x)), None),

    # -------------------------
    # 4D VECTORS / QUATS
    # -------------------------
    "int4":       (lambda x: tuple(x), None),
    "half4":      (lambda x: tuple(map(float, x)), None),

    "float4":     (Gf.Vec4f, Vt.Vec4fArray),
    "double4":    (Gf.Vec4d, Vt.Vec4dArray),

    "color3f": lambda c: Gf.Vec3f(*hex_to_rgba(c)[:3]),
    "color3d": lambda c: Gf.Vec3d(*hex_to_rgba(c)[:3]),
    "color3h": lambda c: tuple(hex_to_rgba(c)[:3]),
    "color4f": lambda c: Gf.Vec4f(*hex_to_rgba(c)),
    "color4d": lambda c: Gf.Vec4d(*hex_to_rgba(c)),
    "color4h": lambda c: tuple(hex_to_rgba(c)),

    "quatf": (lambda x: Gf.Quatf(x[0], Gf.Vec3f(x[1], x[2], x[3])), Vt.QuatfArray),
    "quatd": (lambda x: Gf.Quatd(x[0], Gf.Vec3d(x[1], x[2], x[3])), Vt.QuatdArray),
    # no true half quaternion in USD → keep as float fallback
    "quath": (lambda x: Gf.Quatf(x[0], Gf.Vec3f(x[1], x[2], x[3])), None),

    # -------------------------
    # MATRICES / FRAMES (flat input)
    # -------------------------
    "matrix4d": (
        lambda x: Gf.Transform().SetMatrix(Gf.Matrix4d(x)) or Gf.Transform().GetMatrix(),
        None
    ),

    "matrix3d": (
        lambda x: Gf.Matrix3d(*x) if not isinstance(x, Gf.Matrix3d) else x,
        None
    ),

    "matrix2d": (
        lambda x: Gf.Matrix2d(*x) if not isinstance(x, Gf.Matrix2d) else x,
        None
    ),

    "frame4d": (
        lambda x: Gf.Matrix4d(x),
        None
    ),
}

def convert_value(data, target_type, is_array):
    base = target_type[:-2] if is_array and target_type.endswith("[]") else target_type

    if base not in CONVERTERS:
        raise TypeError(f"Unsupported type: {base}")

    ctor, array_ctor = CONVERTERS[base]

    if is_array:
        items = [ctor(x) if not isinstance(x, ctor) else x for x in data]
        return array_ctor(items) if array_ctor else items

    return ctor(data) if not isinstance(data, ctor) else data

def set_usd_data(prim, name, value, target_type, is_primvar=False):
    if isinstance(value, str):
        value = json.loads(value)

    data = value.get("data")

    is_array = target_type.endswith("[]")
    parsed = convert_value(data, target_type, is_array)

    type_name = Sdf.ValueTypeNames.Find(target_type)

    if is_primvar:
        pv = UsdGeom.PrimvarsAPI(prim).CreatePrimvar(name, type_name)
        pv.Set(parsed)
        return pv

    attr = prim.CreateAttribute(name, type_name)
    attr.Set(parsed)
    return attr