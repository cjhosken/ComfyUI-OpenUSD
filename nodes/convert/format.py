import numpy as np
from pxr import Gf, Sdf, Usd, UsdGeom
from ..utils import OpenUSDError, register_in_memory_stage

try:
    import trimesh
    HAS_TRIMESH = True
except ImportError:
    HAS_TRIMESH = False


def _trimesh_to_usd_stage(mesh_or_scene, stage=None, prim_path="/World"):
    """Convert a trimesh Mesh or Scene to a USD Stage."""
    if stage is None:
        stage = Usd.Stage.CreateInMemory()

    if isinstance(mesh_or_scene, trimesh.Scene):
        for name, geom in mesh_or_scene.geometry.items():
            if isinstance(geom, trimesh.Trimesh):
                _add_mesh_to_stage(stage, geom, name, prim_path)
    elif isinstance(mesh_or_scene, trimesh.Trimesh):
        _add_mesh_to_stage(stage, mesh_or_scene, mesh_or_scene.metadata.get("name", "Mesh"), prim_path)
    else:
        raise TypeError(f"Unsupported trimesh type: {type(mesh_or_scene)}")

    return stage


def _add_mesh_to_stage(stage, mesh, name: str, prim_path: str):
    """Add a trimesh.Trimesh geometry as a UsdGeom.Mesh prim."""
    safe_name = name.replace("/", "_").replace(" ", "_")
    path = f"{prim_path}/{safe_name}" if prim_path != "/" else f"/{safe_name}"
    usd_mesh = UsdGeom.Mesh.Define(stage, path)

    usd_mesh.CreatePointsAttr().Set(
        [Gf.Vec3d(float(v[0]), float(v[1]), float(v[2])) for v in mesh.vertices]
    )

    if mesh.faces is not None and len(mesh.faces) > 0:
        flat_indices = []
        counts = []
        for face in mesh.faces:
            flat_indices.extend([int(i) for i in face])
            counts.append(len(face))
        usd_mesh.CreateFaceVertexIndicesAttr().Set(flat_indices)
        usd_mesh.CreateFaceVertexCountsAttr().Set(counts)

    if mesh.vertex_normals is not None and len(mesh.vertex_normals) == len(mesh.vertices):
        usd_mesh.CreateNormalsAttr().Set(
            [Gf.Vec3f(float(n[0]), float(n[1]), float(n[2])) for n in mesh.vertex_normals]
        )
        usd_mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)

    if hasattr(mesh.visual, "uv") and mesh.visual.uv is not None:
        uvs = mesh.visual.uv
        primvars_api = UsdGeom.PrimvarsAPI(usd_mesh.GetPrim())
        uv_primvar = primvars_api.CreatePrimvar(
            "primvars:st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.faceVarying
        )
        uv_primvar.Set([Gf.Vec2f(float(u[0]), float(u[1])) for u in uvs])


class ConvertUSD:
    """Convert ComfyUI MESH geometry into a USD stage."""

    CATEGORY = "3d/usd/convert"
    FUNCTION = "convert"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mesh": ("MESH",),
            },
        }

    def convert(self, mesh):
        if not HAS_TRIMESH:
            raise OpenUSDError("The 'trimesh' library is required. Install via: pip install trimesh")

        if mesh is None or not hasattr(mesh, "vertices"):
            raise OpenUSDError("MESH input required (ComfyUI geometry MESH object).")

        if mesh.vertices.dim() == 3:
            verts = mesh.vertices[0].cpu().numpy().astype(np.float64)
        else:
            verts = mesh.vertices.cpu().numpy().astype(np.float64)

        if mesh.faces is not None:
            if mesh.faces.dim() == 3:
                faces = mesh.faces[0].cpu().numpy().astype(np.int64)
            else:
                faces = mesh.faces.cpu().numpy().astype(np.int64)
        else:
            faces = None

        tmp_mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
        tmp_mesh.metadata["name"] = "Mesh"
        stage = _trimesh_to_usd_stage(tmp_mesh)

        usda_text = stage.GetRootLayer().ExportToString()
        register_in_memory_stage(usda_text)

        return (stage,)


NODE_CLASS_MAPPINGS = {
    "ConvertUSD": ConvertUSD,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ConvertUSD": "MESH to USD",
}
