import os
import tempfile
import folder_paths
import numpy as np

class USDCreateVec3:
    """Create a USD Vec3 (3D vector) from components"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "combine_vec3"
    
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vector": ("VEC3", {"default": [0.0, 0.0, 0.0]}),
            }
        }
    
    def combine_vec3(self, vector):
        return vector

class USDFloatToVec3:
    """Combine a USD Vec3 (3D vector) from components"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "combine_vec3"
    
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
                "y": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
                "z": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
            }
        }
    
    def combine_vec3(self, x, y, z):
        return ({'x': x, 'y': y, 'z': z},)


class USDVec3ToFloat:
    """Split a USD Vec3 into its components"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "split_vec3"
    
    RETURN_TYPES = ("FLOAT", "FLOAT", "FLOAT")
    RETURN_NAMES = ("x", "y", "z")
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3": ("VEC3",),
            }
        }
    
    def split_vec3(self, vec3):
        if not isinstance(vec3, dict):
            raise TypeError("Expected input of type 'VEC3' (dict)")
        return (vec3.get("x", 0.0), vec3.get("y", 0.0), vec3.get("z", 0.0))


class USDVec3Math:
    """Perform mathematical operations on USD Vec3"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "vec3_math"
    
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3_a": ("VEC3",),
                "vec3_b": ("VEC3",),
                "operation": (["add", "subtract", "multiply", "divide", "cross", "dot"],),
            },
            "optional": {
                "scalar": ("FLOAT", {"default": 1.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
            }
        }
    
    def vec3_math(self, vec3_a, vec3_b, operation, scalar=1.0):
        if not isinstance(vec3_a, dict) or not isinstance(vec3_b, dict):
            raise TypeError("Expected inputs of type 'VEC3' (dict)")
        
        a = np.array([vec3_a.get('x', 0.0), vec3_a.get('y', 0.0), vec3_a.get('z', 0.0)])
        b = np.array([vec3_b.get('x', 0.0), vec3_b.get('y', 0.0), vec3_b.get('z', 0.0)])
        
        if operation == "add":
            result = a + b
        elif operation == "subtract":
            result = a - b
        elif operation == "multiply":
            result = a * b
        elif operation == "divide":
            result = a / b if b.all() else np.zeros(3)
        elif operation == "cross":
            result = np.cross(a, b)
        elif operation == "dot":
            dot_product = np.dot(a, b)
            return ({'x': dot_product, 'y': 0.0, 'z': 0.0},)
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return ({'x': float(result[0]), 'y': float(result[1]), 'z': float(result[2])},)


class USDVec3Transform:
    """Transform a USD Vec3 with scale, rotation, translation"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "transform_vec3"
    
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3": ("VEC3",),
                "scale": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 100.0, "step": 0.01}),
                "rotation_x": ("FLOAT", {"default": 0.0, "min": -360.0, "max": 360.0, "step": 0.1}),
                "rotation_y": ("FLOAT", {"default": 0.0, "min": -360.0, "max": 360.0, "step": 0.1}),
                "rotation_z": ("FLOAT", {"default": 0.0, "min": -360.0, "max": 360.0, "step": 0.1}),
                "translate_x": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
                "translate_y": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
                "translate_z": ("FLOAT", {"default": 0.0, "min": -1000.0, "max": 1000.0, "step": 0.01}),
            }
        }
    
    def transform_vec3(self, vec3, scale, rotation_x, rotation_y, rotation_z, 
                       translate_x, translate_y, translate_z):
        if not isinstance(vec3, dict):
            raise TypeError("Expected input of type 'VEC3' (dict)")
        
        v = np.array([vec3.get('x', 0.0), vec3.get('y', 0.0), vec3.get('z', 0.0)])
        
        # Scale
        v *= scale
        
        # Rotation matrices (in radians)
        rx = np.radians(rotation_x)
        ry = np.radians(rotation_y)
        rz = np.radians(rotation_z)
        
        # X rotation
        Rx = np.array([[1, 0, 0],
                       [0, np.cos(rx), -np.sin(rx)],
                       [0, np.sin(rx), np.cos(rx)]])
        
        # Y rotation
        Ry = np.array([[np.cos(ry), 0, np.sin(ry)],
                       [0, 1, 0],
                       [-np.sin(ry), 0, np.cos(ry)]])
        
        # Z rotation
        Rz = np.array([[np.cos(rz), -np.sin(rz), 0],
                       [np.sin(rz), np.cos(rz), 0],
                       [0, 0, 1]])
        
        # Apply rotations (ZYX order)
        v = np.dot(Rz, np.dot(Ry, np.dot(Rx, v)))
        
        # Translation
        v += np.array([translate_x, translate_y, translate_z])
        
        return ({'x': float(v[0]), 'y': float(v[1]), 'z': float(v[2])},)


class USDVec3ToUSD:
    """Convert a Vec3 to USD format (for use with USD nodes)"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "vec3_to_usd"
    
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("usd",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3": ("VEC3",),
                "property_name": ("STRING", {"default": "myVector", "multiline": False}),
            }
        }
    
    def vec3_to_usd(self, vec3, property_name):
        if not isinstance(vec3, dict):
            raise TypeError("Expected input of type 'VEC3' (dict)")
        
        # Create USD format for vector property
        # This will return a dict that can be used by other USD nodes
        usd_data = {
            "property_name": property_name,
            "type": "Vec3",
            "value": [vec3.get('x', 0.0), vec3.get('y', 0.0), vec3.get('z', 0.0)]
        }
        
        return (usd_data,)


class USDVec3Normalize:
    """Normalize a USD Vec3 (convert to unit vector)"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "normalize_vec3"
    
    RETURN_TYPES = ("VEC3",)
    RETURN_NAMES = ("vec3",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3": ("VEC3",),
            }
        }
    
    def normalize_vec3(self, vec3):
        if not isinstance(vec3, dict):
            raise TypeError("Expected input of type 'VEC3' (dict)")
        
        v = np.array([vec3.get('x', 0.0), vec3.get('y', 0.0), vec3.get('z', 0.0)])
        norm = np.linalg.norm(v)
        
        if norm > 0:
            v = v / norm
        else:
            v = np.zeros(3)
        
        return ({'x': float(v[0]), 'y': float(v[1]), 'z': float(v[2])},)


class USDVec3Length:
    """Calculate the length/magnitude of a USD Vec3"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "vec3_length"
    
    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("length",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3": ("VEC3",),
            }
        }
    
    def vec3_length(self, vec3):
        if not isinstance(vec3, dict):
            raise TypeError("Expected input of type 'VEC3' (dict)")
        
        v = np.array([vec3.get('x', 0.0), vec3.get('y', 0.0), vec3.get('z', 0.0)])
        return (float(np.linalg.norm(v)),)


class USDVec3Distance:
    """Calculate the distance between two USD Vec3"""
    
    CATEGORY = "USD/Vec3"
    FUNCTION = "vec3_distance"
    
    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("distance",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vec3_a": ("VEC3",),
                "vec3_b": ("VEC3",),
            }
        }
    
    def vec3_distance(self, vec3_a, vec3_b):
        if not isinstance(vec3_a, dict) or not isinstance(vec3_b, dict):
            raise TypeError("Expected inputs of type 'VEC3' (dict)")
        
        a = np.array([vec3_a.get('x', 0.0), vec3_a.get('y', 0.0), vec3_a.get('z', 0.0)])
        b = np.array([vec3_b.get('x', 0.0), vec3_b.get('y', 0.0), vec3_b.get('z', 0.0)])
        
        return (float(np.linalg.norm(a - b)),)


# Node mappings for ComfyUI
NODE_CLASS_MAPPINGS = {
    "USDVec3Create": USDCreateVec3,
    "USDVec3ToFloat": USDVec3ToFloat,
    "USDFloatToVec3": USDFloatToVec3,
    "USDVec3Math": USDVec3Math,
    "USDVec3Transform": USDVec3Transform,
    "USDVec3ToUSD": USDVec3ToUSD,
    "USDVec3Normalize": USDVec3Normalize,
    "USDVec3Length": USDVec3Length,
    "USDVec3Distance": USDVec3Distance,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "USDVec3Create": "Create USD Vec3",
    "USDVec3Split": "Split USD Vec3",
    "USDVec3Math": "USD Vec3 Math",
    "USDVec3Transform": "Transform USD Vec3",
    "USDVec3ToUSD": "Vec3 to USD",
    "USDVec3Normalize": "Normalize USD Vec3",
    "USDVec3Length": "USD Vec3 Length",
    "USDVec3Distance": "USD Vec3 Distance",
}