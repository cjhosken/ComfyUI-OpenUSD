import os
import folder_paths
import tempfile

class ConvertUSD:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "convert_openusd"

    RETURN_TYPES = ("USD", "STRING", "STRING",)
    RETURN_NAMES = ("USD", "glb_path", "obj_path",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "output_name": ("STRING", {"default": "converted_model"}),
            },
            "optional": {
                "USD": ("USD",),
                "glb": ("STRING", {"forceInput": True}),
                "obj": ("STRING", {"forceInput": True}),
            }
        }

    def convert_openusd(self, output_name, USD=None, glb="", obj=""):
        import trimesh
        from pxr import Usd, UsdGeom, Vt, Gf
        import numpy as np

        overwrite = "True"
        source_path = ""
        source_type = ""
        usd_input = None

        if USD is not None:
            source_type = "USD"
            usd_input = USD
            source_path = USD.get("usd_info", "")
        elif glb != "":
            source_type = "glb"
            source_path = glb
        elif obj != "":
            source_type = "obj"
            source_path = obj
        else:
            raise ValueError("Must provide at least one input (usd, glb, or obj)")

        if source_path and os.path.exists(source_path):
            target_dir = os.path.dirname(os.path.abspath(source_path))
            if not output_name or output_name == "converted_model":
                output_name = os.path.splitext(os.path.basename(source_path))[0]
        else:
            target_dir = folder_paths.get_output_directory()

        out_usd_path = os.path.join(target_dir, f"{output_name}.usd")
        out_glb_path = os.path.join(target_dir, f"{output_name}.glb")
        out_obj_path = os.path.join(target_dir, f"{output_name}.obj")

        temp_usd_path = None
        if source_type == "USD" and (not source_path or not os.path.exists(source_path)):
            import uuid
            temp_dir = folder_paths.get_temp_directory()
            os.makedirs(temp_dir, exist_ok=True)
            usda_text = usd_input.get("usda_text", "")
            temp_usd_path = os.path.join(temp_dir, f"usd_{uuid.uuid4().hex}.usda")
            with open(temp_usd_path, "w") as f:
                f.write(usda_text)
            source_path = temp_usd_path

        try:
            usd_output = {"usd_info": "", "usda_text": ""}
            if source_type != "USD":
                if overwrite == "True" or not os.path.exists(out_usd_path):
                    mesh_or_scene = trimesh.load(source_path)
                    if os.path.exists(out_usd_path):
                        os.remove(out_usd_path)
                    stage = Usd.Stage.CreateNew(out_usd_path)
                    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
                    root_xform = UsdGeom.Xform.Define(stage, "/Root")
                    stage.SetDefaultPrim(root_xform.GetPrim())

                    def add_mesh_to_stage(stage, mesh_path, trimesh_mesh):
                        mesh = UsdGeom.Mesh.Define(stage, mesh_path)
                        usd_points = Vt.Vec3fArray([Gf.Vec3f(float(v[0]), float(v[1]), float(v[2])) for v in trimesh_mesh.vertices])
                        mesh.GetPointsAttr().Set(usd_points)
                        
                        usd_counts = Vt.IntArray([len(face) for face in trimesh_mesh.faces])
                        usd_indices = Vt.IntArray([int(idx) for face in trimesh_mesh.faces for idx in face])
                        mesh.GetFaceVertexCountsAttr().Set(usd_counts)
                        mesh.GetFaceVertexIndicesAttr().Set(usd_indices)

                        if hasattr(trimesh_mesh.visual, "vertex_colors") and len(trimesh_mesh.visual.vertex_colors) > 0:
                            colors = trimesh_mesh.visual.vertex_colors
                            usd_colors = Vt.Vec3fArray([Gf.Vec3f(c[0]/255.0, c[1]/255.0, c[2]/255.0) for c in colors])
                            mesh.GetDisplayColorAttr().Set(usd_colors)
                        elif hasattr(trimesh_mesh.visual, "material") and hasattr(trimesh_mesh.visual.material, "main_color"):
                            c = trimesh_mesh.visual.material.main_color
                            usd_color = Vt.Vec3fArray([Gf.Vec3f(c[0]/255.0, c[1]/255.0, c[2]/255.0)])
                            mesh.GetDisplayColorAttr().Set(usd_color)

                        if hasattr(trimesh_mesh, "vertex_normals") and len(trimesh_mesh.vertex_normals) > 0:
                            normals = trimesh_mesh.vertex_normals
                            usd_normals = Vt.Vec3fArray([Gf.Vec3f(float(n[0]), float(n[1]), float(n[2])) for n in normals])
                            mesh.GetNormalsAttr().Set(usd_normals)
                            mesh.SetNormalsInterpolation(UsdGeom.Tokens.varying)

                    if isinstance(mesh_or_scene, trimesh.Scene):
                        for name, geom in mesh_or_scene.geometry.items():
                            if isinstance(geom, trimesh.Trimesh):
                                add_mesh_to_stage(stage, f"/Root/{name}", geom)
                    elif isinstance(mesh_or_scene, trimesh.Trimesh):
                        add_mesh_to_stage(stage, "/Root/Mesh", mesh_or_scene)

                    stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(out_usd_path)}"
                    stage.Save()

                if os.path.exists(out_usd_path):
                    stage = Usd.Stage.Open(out_usd_path)
                    usda_text = stage.GetRootLayer().ExportToString()
                    usd_output = {"usd_info": out_usd_path, "usda_text": usda_text}
            else:
                usd_output = usd_input

            if source_type != "glb" and (overwrite == "True" or not os.path.exists(out_glb_path)):
                if source_type == "USD":
                    stage = Usd.Stage.Open(source_path)
                    meshes = []
                    for prim in stage.Traverse():
                        if prim.IsA(UsdGeom.Mesh):
                            mesh_geom = UsdGeom.Mesh(prim)
                            points = mesh_geom.GetPointsAttr().Get()
                            if not points: continue
                            vertices = np.array([[p[0], p[1], p[2]] for p in points], dtype=np.float32)
                            face_counts = mesh_geom.GetFaceVertexCountsAttr().Get()
                            face_indices = mesh_geom.GetFaceVertexIndicesAttr().Get()
                            if not face_counts or not face_indices: continue
                            
                            faces = []
                            curr_idx = 0
                            for count in face_counts:
                                face = [face_indices[curr_idx + i] for i in range(count)]
                                if count == 3:
                                    faces.append(face)
                                elif count == 4:
                                    faces.append([face[0], face[1], face[2]])
                                    faces.append([face[0], face[2], face[3]])
                                else:
                                    for i in range(1, count - 1):
                                        faces.append([face[0], face[i], face[i+1]])
                                curr_idx += count
                            faces = np.array(faces, dtype=np.int32)
                            t_mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
                            meshes.append(t_mesh)
                    
                    if len(meshes) > 0:
                        if len(meshes) == 1:
                            meshes[0].export(out_glb_path)
                        else:
                            scene = trimesh.Scene(meshes)
                            scene.export(out_glb_path)
                else:
                    mesh_or_scene = trimesh.load(source_path)
                    mesh_or_scene.export(out_glb_path)

            if source_type != "obj" and (overwrite == "True" or not os.path.exists(out_obj_path)):
                if source_type == "USD":
                    stage = Usd.Stage.Open(source_path)
                    meshes = []
                    for prim in stage.Traverse():
                        if prim.IsA(UsdGeom.Mesh):
                            mesh_geom = UsdGeom.Mesh(prim)
                            points = mesh_geom.GetPointsAttr().Get()
                            if not points: continue
                            vertices = np.array([[p[0], p[1], p[2]] for p in points], dtype=np.float32)
                            face_counts = mesh_geom.GetFaceVertexCountsAttr().Get()
                            face_indices = mesh_geom.GetFaceVertexIndicesAttr().Get()
                            if not face_counts or not face_indices: continue
                            
                            faces = []
                            curr_idx = 0
                            for count in face_counts:
                                face = [face_indices[curr_idx + i] for i in range(count)]
                                if count == 3:
                                    faces.append(face)
                                elif count == 4:
                                    faces.append([face[0], face[1], face[2]])
                                    faces.append([face[0], face[2], face[3]])
                                else:
                                    for i in range(1, count - 1):
                                        faces.append([face[0], face[i], face[i+1]])
                                curr_idx += count
                            faces = np.array(faces, dtype=np.int32)
                            t_mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
                            meshes.append(t_mesh)
                    
                    if len(meshes) > 0:
                        if len(meshes) == 1:
                            meshes[0].export(out_obj_path)
                        else:
                            scene = trimesh.Scene(meshes)
                            scene.export(out_obj_path)
                else:
                    mesh_or_scene = trimesh.load(source_path)
                    mesh_or_scene.export(out_obj_path)

        finally:
            if temp_usd_path and os.path.exists(temp_usd_path):
                try:
                    os.remove(temp_usd_path)
                except:
                    pass

        final_usd = usd_output if source_type == "USD" or os.path.exists(out_usd_path) else {"usd_info": "", "usda_text": ""}
        final_glb = out_glb_path if os.path.exists(out_glb_path) else ""
        final_obj = out_obj_path if os.path.exists(out_obj_path) else ""

        return (final_usd, final_glb, final_obj)

class MeshToUSD:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "mesh_to_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mesh": ("MESH",),
            }
        }

    def mesh_to_usd(self, mesh):
        import trimesh
        from pxr import Usd, UsdGeom, Vt, Gf
        import numpy as np
        import uuid

        if isinstance(mesh, list) and len(mesh) > 0:
            mesh = mesh[0]

        verts = None
        faces = None

        if isinstance(mesh, dict):
            verts = mesh.get("verts", mesh.get("vertices", None))
            faces = mesh.get("faces", None)
        elif hasattr(mesh, "vertices") and hasattr(mesh, "faces"):
            verts = mesh.vertices
            faces = mesh.faces
        else:
            raise TypeError("Unsupported MESH format. Expected a dictionary or object with vertices and faces.")

        if verts is None or faces is None:
            raise ValueError("MESH must contain vertices (verts) and faces.")

        try:
            import torch
            if isinstance(verts, torch.Tensor):
                verts = verts.detach().cpu().numpy()
            if isinstance(faces, torch.Tensor):
                faces = faces.detach().cpu().numpy()
        except ImportError:
            pass

        if isinstance(verts, np.ndarray):
            if len(verts.shape) == 3:
                verts = verts[0]
        if isinstance(faces, np.ndarray):
            if len(faces.shape) == 3:
                faces = faces[0]

        t_mesh = trimesh.Trimesh(vertices=verts, faces=faces)

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"mesh_{uuid.uuid4().hex}.usda")

        stage = Usd.Stage.CreateNew(temp_path)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        root_xform = UsdGeom.Xform.Define(stage, "/Root")
        stage.SetDefaultPrim(root_xform.GetPrim())

        mesh_prim = UsdGeom.Mesh.Define(stage, "/Root/Mesh")
        
        usd_points = Vt.Vec3fArray([Gf.Vec3f(float(v[0]), float(v[1]), float(v[2])) for v in t_mesh.vertices])
        mesh_prim.GetPointsAttr().Set(usd_points)
        
        usd_counts = Vt.IntArray([len(face) for face in t_mesh.faces])
        usd_indices = Vt.IntArray([int(idx) for face in t_mesh.faces for idx in face])
        
        mesh_prim.GetFaceVertexCountsAttr().Set(usd_counts)
        mesh_prim.GetFaceVertexIndicesAttr().Set(usd_indices)

        stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(temp_path)}"
        stage.Save()

        usda_text = stage.GetRootLayer().ExportToString()
        return ({"usd_info": temp_path, "usda_text": usda_text},)

class Model3DToUSD:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "model3d_to_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_3d": ("MODEL3D",),
            }
        }

    def model3d_to_usd(self, model_3d):
        import trimesh
        from pxr import Usd, UsdGeom, Vt, Gf
        import uuid

        path = ""
        if isinstance(model_3d, str):
            path = model_3d
        elif isinstance(model_3d, dict):
            path = model_3d.get("path", model_3d.get("filename", ""))
        elif hasattr(model_3d, "path"):
            path = model_3d.path
        else:
            raise TypeError("Unsupported MODEL3D format. Expected file path (string) or dictionary with path.")

        if not path or not os.path.exists(path):
            raise FileNotFoundError(f"3D model file not found: {path}")

        mesh_or_scene = trimesh.load(path)
        
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"model3d_{uuid.uuid4().hex}.usda")

        stage = Usd.Stage.CreateNew(temp_path)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        root_xform = UsdGeom.Xform.Define(stage, "/Root")
        stage.SetDefaultPrim(root_xform.GetPrim())

        def add_mesh_to_stage(stage, mesh_path, trimesh_mesh):
            mesh = UsdGeom.Mesh.Define(stage, mesh_path)
            usd_points = Vt.Vec3fArray([Gf.Vec3f(float(v[0]), float(v[1]), float(v[2])) for v in trimesh_mesh.vertices])
            mesh.GetPointsAttr().Set(usd_points)
            
            usd_counts = Vt.IntArray([len(face) for face in trimesh_mesh.faces])
            usd_indices = Vt.IntArray([int(idx) for face in trimesh_mesh.faces for idx in face])
            mesh.GetFaceVertexCountsAttr().Set(usd_counts)
            mesh.GetFaceVertexIndicesAttr().Set(usd_indices)

        if isinstance(mesh_or_scene, trimesh.Scene):
            for name, geom in mesh_or_scene.geometry.items():
                if isinstance(geom, trimesh.Trimesh):
                    add_mesh_to_stage(stage, f"/Root/{name}", geom)
        elif isinstance(mesh_or_scene, trimesh.Trimesh):
            add_mesh_to_stage(stage, "/Root/Mesh", mesh_or_scene)

        stage.GetRootLayer().comment = f"usd_info: {os.path.abspath(temp_path)}"
        stage.Save()

        usda_text = stage.GetRootLayer().ExportToString()
        return ({"usd_info": temp_path, "usda_text": usda_text},)

class USDtoModel3D:
    CATEGORY = "3d/USD/Conversion"
    FUNCTION = "usd_to_model3d"

    RETURN_TYPES = ("MODEL3D",)
    RETURN_NAMES = ("model_3d",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def usd_to_model3d(self, USD):
        import trimesh
        from pxr import Usd, UsdGeom
        import numpy as np
        import uuid

        usda_text = USD.get("usda_text", "")
        usd_path = USD.get("usd_info", "")

        source_path = usd_path
        temp_usd_path = None
        if not usd_path or not os.path.exists(usd_path):
            temp_dir = folder_paths.get_temp_directory()
            os.makedirs(temp_dir, exist_ok=True)
            temp_usd_path = os.path.join(temp_dir, f"usd_{uuid.uuid4().hex}.usda")
            with open(temp_usd_path, "w") as f:
                f.write(usda_text)
            source_path = temp_usd_path

        try:
            stage = Usd.Stage.Open(source_path)
            meshes = []
            for prim in stage.Traverse():
                if prim.IsA(UsdGeom.Mesh):
                    mesh_geom = UsdGeom.Mesh(prim)
                    points = mesh_geom.GetPointsAttr().Get()
                    if not points: continue
                    vertices = np.array([[p[0], p[1], p[2]] for p in points], dtype=np.float32)
                    face_counts = mesh_geom.GetFaceVertexCountsAttr().Get()
                    face_indices = mesh_geom.GetFaceVertexIndicesAttr().Get()
                    if not face_counts or not face_indices: continue
                    
                    faces = []
                    curr_idx = 0
                    for count in face_counts:
                        face = [face_indices[curr_idx + i] for i in range(count)]
                        if count == 3:
                            faces.append(face)
                        elif count == 4:
                            faces.append([face[0], face[1], face[2]])
                            faces.append([face[0], face[2], face[3]])
                        else:
                            for i in range(1, count - 1):
                                faces.append([face[0], face[i], face[i+1]])
                        curr_idx += count
                    faces = np.array(faces, dtype=np.int32)
                    t_mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
                    meshes.append(t_mesh)

            if len(meshes) == 0:
                raise ValueError("No meshes found in USD stage.")

            temp_dir = folder_paths.get_temp_directory()
            os.makedirs(temp_dir, exist_ok=True)
            out_path = os.path.join(temp_dir, f"converted_{uuid.uuid4().hex}.glb")

            if len(meshes) == 1:
                meshes[0].export(out_path)
            else:
                scene = trimesh.Scene(meshes)
                scene.export(out_path)

            return ({"path": out_path},)

        finally:
            if temp_usd_path and os.path.exists(temp_usd_path):
                try:
                    os.remove(temp_usd_path)
                except:
                    pass