import json

class USDDatatypeToJSON:
    CATEGORY = "3d/USD/Data"
    FUNCTION = "to_json"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("json_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("*",),
            }
        }

    def to_json(self, value):
        try:
            return (json.dumps(value),)
        except Exception as e:
            return (json.dumps(str(value)),)

class JSONToUSDDatatype:
    CATEGORY = "3d/USD/Data"
    FUNCTION = "from_json"
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("value",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "json_text": ("STRING", {"multiline": True}),
                "target_type": (["float", "string", "int", "bool", "token", "Vec2", "Vec3", "Matrix"], {"default": "string"}),
            }
        }

    def from_json(self, json_text, target_type):
        try:
            data = json.loads(json_text)
            if target_type == "float":
                return (float(data),)
            elif target_type == "int":
                return (int(data),)
            elif target_type == "bool":
                return (bool(data),)
            elif target_type == "string" or target_type == "token":
                return (str(data),)
            elif target_type == "Vec2":
                if isinstance(data, (list, tuple)):
                    return ([float(x) for x in data[:2]],)
                return ([0.0, 0.0],)
            elif target_type == "Vec3":
                if isinstance(data, (list, tuple)):
                    return ([float(x) for x in data[:3]],)
                return ([0.0, 0.0, 0.0],)
            elif target_type == "Matrix":
                if isinstance(data, (list, tuple)):
                    return ([float(x) for x in data[:16]],)
                return ([1.0, 0.0, 0.0, 0.0, 
                         0.0, 1.0, 0.0, 0.0, 
                         0.0, 0.0, 1.0, 0.0, 
                         0.0, 0.0, 0.0, 1.0],)
            return (data,)
        except Exception as e:
            print(f"[JSONToUSDDatatype] Conversion error: {e}")
            return (None,)

class CreateUSDVec3:
    CATEGORY = "3d/USD/Data"
    FUNCTION = "create_vec3"
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "y": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "z": ("FLOAT", {"default": 0.0, "step": 0.01}),
            }
        }

    def create_vec3(self, x, y, z):
        return ([x, y, z],)

class CreateUSDVec2:
    CATEGORY = "3d/USD/Data"
    FUNCTION = "create_vec2"
    RETURN_TYPES = ("VEC2",)
    RETURN_NAMES = ("vec2",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0, "step": 0.01}),
                "y": ("FLOAT", {"default": 0.0, "step": 0.01}),
            }
        }

    def create_vec2(self, x, y):
        return ([x, y],)

class CreateUSDMatrix:
    CATEGORY = "3d/USD/Data"
    FUNCTION = "create_matrix"
    RETURN_TYPES = ("MATRIX",)
    RETURN_NAMES = ("matrix",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "translation": ("VEC3", {"default": [0.0, 0.0, 0.0]}),
                "rotation": ("VEC3", {"default": [0.0, 0.0, 0.0]}),
                "scale": ("VEC3", {"default": [1.0, 1.0, 1.0]}),
            }
        }

    def create_matrix(self, translation, rotation, scale):
        from pxr import Gf
        t_x, t_y, t_z = translation[0], translation[1], translation[2]
        r_x, r_y, r_z = rotation[0], rotation[1], rotation[2]
        s_x, s_y, s_z = scale[0], scale[1], scale[2]
        
        mat = Gf.Matrix4d(1.0)
        mat.SetTranslate(Gf.Vec3d(t_x, t_y, t_z))
        
        rot = Gf.Rotation(Gf.Vec3d(1, 0, 0), r_x) * \
              Gf.Rotation(Gf.Vec3d(0, 1, 0), r_y) * \
              Gf.Rotation(Gf.Vec3d(0, 0, 1), r_z)
        mat.SetRotate(rot)
        mat.SetScale(Gf.Vec3d(s_x, s_y, s_z))
        
        flat = []
        for r in range(4):
            for c in range(4):
                flat.append(float(mat[r][c]))
        return (flat,)
