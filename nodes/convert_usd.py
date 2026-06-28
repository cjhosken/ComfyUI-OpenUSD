import os
import re
import json
import tempfile
import numpy as np
from pathlib import Path

try:
    import pygltflib
    from pxr import Usd, UsdGeom, UsdShade, Sdf, Gf, Vt
except ImportError as e:
    print(f"Please install required packages: pip install pygltflib usd-core numpy")

class ConvertOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "convert"
    
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_3d": ("FILE_3D", {"path": True}),
                "up_axis": (["Y", "Z"], {"default": "Y"}),
                "scale": ("FLOAT", {"default": 1.0, "min": 0.001, "max": 100.0, "step": 0.001}),
            }
        }
    
    def convert(self, model_3d, up_axis="Y", scale=1.0):
        print(f"Input model: {model_3d}")
        
        # Extract the file path
        file_path = self._extract_file_path(model_3d)
        
        print(f"Extracted file path: {file_path}")
        
        if not file_path or not os.path.exists(file_path):
            print(f"Error: File not found - {file_path}")
            return ({"usd_path": "", "usda_text": "", "error": f"File not found: {file_path}"},)
        
        file_ext = Path(file_path).suffix.lower()
        print(f"File extension: {file_ext}")
        
        # Check if it's a GLB/GLTF file
        if file_ext in ['.glb', '.gltf']:
            print(f"Converting {file_ext} to USD ASCII format...")
            usd_text = self._convert_gltf_to_usda(file_path, up_axis, scale)
            
            if usd_text:
                return ({"usd_path": "", "usda_text": usd_text, "format": "usda", "success": True},)
            else:
                return ({"usd_path": "", "usda_text": "", "error": "Conversion failed"},)
        else:
            print(f"Unsupported format: {file_ext}")
            return ({"usd_path": "", "usda_text": "", "error": f"Unsupported format: {file_ext}"},)
    
    def _extract_file_path(self, model_3d):
        """Extract file path from various input formats."""
        # If it's already a string
        if isinstance(model_3d, str):
            # Try to parse as File3D format
            if 'File3D' in model_3d or 'source=' in model_3d:
                # Extract source path from File3D(source='path', format='...')
                match = re.search(r"source='([^']*)'", model_3d)
                if match:
                    return match.group(1)
                # Try with double quotes
                match = re.search(r'source="([^"]*)"', model_3d)
                if match:
                    return match.group(1)
            
            # If it's just a path
            if os.path.exists(model_3d):
                return model_3d
                
            return model_3d
        
        # If it's a dictionary
        elif isinstance(model_3d, dict):
            for key in ['source', 'path', 'file_path', 'file']:
                if key in model_3d:
                    return model_3d[key]
            if model_3d:
                return list(model_3d.values())[0]
        
        # If it's a custom object with attributes
        elif hasattr(model_3d, 'source'):
            return model_3d.source
        elif hasattr(model_3d, 'path'):
            return model_3d.path
        
        # If it's a list or tuple, take first element
        elif isinstance(model_3d, (list, tuple)) and model_3d:
            return self._extract_file_path(model_3d[0])
        
        # Last resort: convert to string and try to parse
        try:
            str_repr = str(model_3d)
            if 'source=' in str_repr:
                match = re.search(r"source='([^']*)'", str_repr)
                if match:
                    return match.group(1)
                match = re.search(r'source="([^"]*)"', str_repr)
                if match:
                    return match.group(1)
        except:
            pass
        
        return None
    
    def _convert_gltf_to_usda(self, gltf_path, up_axis="Y", scale=1.0):
        """Convert GLTF/GLB to USD ASCII format."""
        try:
            print(f"Loading GLTF file: {gltf_path}")
            # Load GLTF file
            gltf = pygltflib.GLTF2().load(gltf_path)
            
            # Create USD stage in memory
            stage = Usd.Stage.CreateInMemory()
            
            # Set stage metadata
            if up_axis.upper() == 'Y':
                UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
            else:
                UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
            
            UsdGeom.SetStageMetersPerUnit(stage, 1.0)
            
            # Create root prim
            root_prim = UsdGeom.Xform.Define(stage, Sdf.Path("/root"))
            stage.SetDefaultPrim(root_prim.GetPrim())
            
            # Process nodes
            if gltf.scenes:
                scene = gltf.scenes[gltf.scene] if gltf.scene is not None else gltf.scenes[0]
                for node_index in scene.nodes:
                    self._process_node(stage, gltf, node_index, Sdf.Path("/root"), scale)
            
            # Process materials
            if gltf.materials:
                self._process_materials(stage, gltf)
            
            # Export to USDA string
            usda_text = stage.GetRootLayer().ExportToString()
            
            if usda_text:
                print(f"✅ Successfully converted to USDA ({len(usda_text)} bytes)")
                return usda_text
            else:
                print("❌ Export failed - empty USDA string")
                return ""
            
        except Exception as e:
            print(f"Error converting GLTF to USD: {e}")
            import traceback
            traceback.print_exc()
            return ""
    
    def _process_node(self, stage, gltf, node_index, parent_path, scale=1.0):
        """Process a GLTF node and its children."""
        if node_index is None or node_index >= len(gltf.nodes):
            return
            
        node = gltf.nodes[node_index]
        node_name = node.name or f"node_{node_index}"
        node_path = parent_path.AppendChild(self._sanitize_name(node_name))
        
        # Create Xform for this node
        xform = UsdGeom.Xform.Define(stage, node_path)
        
        # Set transform
        if node.matrix is not None:
            # Use matrix directly
            matrix = np.array(node.matrix).reshape(4, 4)
            # Apply scale
            if scale != 1.0:
                scale_matrix = np.diag([scale, scale, scale, 1.0])
                matrix = matrix @ scale_matrix
            xform.AddTransformOp().Set(Gf.Matrix4d(matrix))
        else:
            # Use translation, rotation, scale
            if node.translation is not None:
                trans = np.array(node.translation) * scale
                xform.AddTranslateOp().Set(Gf.Vec3d(trans[0], trans[1], trans[2]))
                
            if node.rotation is not None:
                rot = np.array(node.rotation)
                xform.AddRotateOp().Set(Gf.Quatd(rot[3], rot[0], rot[1], rot[2]))
                
            if node.scale is not None:
                scale_vec = np.array(node.scale)
                xform.AddScaleOp().Set(Gf.Vec3d(scale_vec[0], scale_vec[1], scale_vec[2]))
        
        # If node has mesh, create mesh
        if node.mesh is not None:
            mesh_path = node_path.AppendChild("mesh")
            self._create_mesh(stage, gltf, node.mesh, mesh_path, scale)
            
        # Process children
        if node.children is not None:
            for child_index in node.children:
                self._process_node(stage, gltf, child_index, node_path, scale)
    
    def _create_mesh(self, stage, gltf, mesh_index, mesh_path, scale=1.0):
        """Create USD mesh from GLTF mesh data."""
        if mesh_index is None or mesh_index >= len(gltf.meshes):
            return
            
        mesh = gltf.meshes[mesh_index]
        
        # Process each primitive
        for prim_index, primitive in enumerate(mesh.primitives):
            prim_path = mesh_path.AppendChild(f"primitive_{prim_index}")
            
            # Get vertex data
            positions = self._get_accessor_data(gltf, primitive.attributes.POSITION)
            if positions is None:
                continue
            
            # Apply scale to positions
            positions = positions * scale
            
            # Get indices
            indices = self._get_accessor_data(gltf, primitive.indices) if primitive.indices is not None else None
            
            # Create USD mesh
            mesh_prim = UsdGeom.Mesh.Define(stage, prim_path)
            
            # Set points
            mesh_prim.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(positions))
            
            # Set face vertex counts and indices
            if indices is not None:
                face_vertex_counts = np.full(len(indices) // 3, 3)
                mesh_prim.CreateFaceVertexCountsAttr(Vt.IntArray.FromNumpy(face_vertex_counts))
                mesh_prim.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(indices))
            else:
                num_vertices = len(positions)
                if num_vertices > 0:
                    face_vertex_counts = np.full(num_vertices // 3, 3)
                    mesh_prim.CreateFaceVertexCountsAttr(Vt.IntArray.FromNumpy(face_vertex_counts))
                    mesh_prim.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(np.arange(num_vertices)))
            
            # Set normals if available
            if primitive.attributes.NORMAL is not None:
                normals = self._get_accessor_data(gltf, primitive.attributes.NORMAL)
                if normals is not None:
                    mesh_prim.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(normals))
                    
            # Set UVs if available
            if primitive.attributes.TEXCOORD_0 is not None:
                uvs = self._get_accessor_data(gltf, primitive.attributes.TEXCOORD_0)
                if uvs is not None:
                    mesh_prim.CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, 
                                           UsdGeom.Tokens.varying).Set(Vt.Vec2fArray.FromNumpy(uvs))
            
            # Set material binding if available
            if primitive.material is not None:
                material_path = Sdf.Path(f"/materials/material_{primitive.material}")
                binding = UsdShade.MaterialBindingAPI(mesh_prim)
                material = UsdShade.Material.Get(stage, material_path)
                if material:
                    binding.Bind(material)
    
    def _get_accessor_data(self, gltf, accessor_index):
        """Get data from a GLTF accessor."""
        if accessor_index is None or accessor_index >= len(gltf.accessors):
            return None
            
        try:
            accessor = gltf.accessors[accessor_index]
            
            if accessor.bufferView is None:
                return None
                
            buffer_view = gltf.bufferViews[accessor.bufferView]
            
            # Get the binary data
            # For GLB files, use binary_blob()
            # For GLTF files, use the buffer data from the file
            buffer_data = gltf.binary_blob() if gltf.binary_blob() else None
            
            if buffer_data is None:
                print(f"Warning: No buffer data found for accessor {accessor_index}")
                return None
                
            # Get data type
            dtype = self._get_numpy_dtype(accessor.componentType)
            if dtype is None:
                print(f"Warning: Unknown component type {accessor.componentType}")
                return None
                
            # Calculate start and end positions
            start = buffer_view.byteOffset + (accessor.byteOffset or 0)
            
            # Determine element size based on type
            type_sizes = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
            type_size = type_sizes.get(accessor.type, 1)
            element_size = np.dtype(dtype).itemsize * type_size
            
            end = start + accessor.count * element_size
            
            # Ensure we don't read beyond buffer
            if end > len(buffer_data):
                print(f"Warning: Accessor {accessor_index} exceeds buffer size")
                return None
                
            # Read data
            data = np.frombuffer(buffer_data[start:end], dtype=dtype)
            
            # Reshape for vector types
            if accessor.type == "VEC2":
                data = data.reshape(-1, 2)
            elif accessor.type == "VEC3":
                data = data.reshape(-1, 3)
            elif accessor.type == "VEC4":
                data = data.reshape(-1, 4)
            elif accessor.type == "MAT4":
                data = data.reshape(-1, 4, 4)
                
            return data
            
        except Exception as e:
            print(f"Error reading accessor data: {e}")
            return None
    
    def _get_numpy_dtype(self, component_type):
        """Map GLTF component type to numpy dtype."""
        COMPONENT_TYPES = {
            5120: np.int8,
            5121: np.uint8,
            5122: np.int16,
            5123: np.uint16,
            5124: np.int32,
            5125: np.uint32,
            5126: np.float32,
        }
        return COMPONENT_TYPES.get(component_type)
    
    def _process_materials(self, stage, gltf):
        """Process GLTF materials to USD materials."""
        if not gltf.materials:
            return
            
        for mat_index, material in enumerate(gltf.materials):
            mat_name = material.name or f"material_{mat_index}"
            mat_path = Sdf.Path(f"/materials/{self._sanitize_name(mat_name)}")
            
            # Create USD material
            usd_material = UsdShade.Material.Define(stage, mat_path)
            
            # Create shader
            shader = UsdShade.Shader.Define(stage, mat_path.AppendChild("shader"))
            shader.CreateIdAttr("UsdPreviewSurface")
            
            # Process PBR material properties
            if hasattr(material, 'pbrMetallicRoughness') and material.pbrMetallicRoughness:
                pbr = material.pbrMetallicRoughness
                
                # Base color
                if hasattr(pbr, 'baseColorFactor') and pbr.baseColorFactor is not None:
                    color = Gf.Vec3f(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2])
                    shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(color)
                    
                # Metallic and roughness
                if hasattr(pbr, 'metallicFactor') and pbr.metallicFactor is not None:
                    shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(pbr.metallicFactor)
                if hasattr(pbr, 'roughnessFactor') and pbr.roughnessFactor is not None:
                    shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(pbr.roughnessFactor)
            
            # Connect shader to material
            usd_material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    
    def _sanitize_name(self, name):
        """Sanitize name for USD compatibility."""
        import re
        # Remove invalid characters
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
        # Ensure it starts with a letter or underscore
        if sanitized and not sanitized[0].isalpha() and sanitized[0] != '_':
            sanitized = f"prim_{sanitized}"
        # If empty, use default
        if not sanitized:
            sanitized = "prim"
        return sanitized