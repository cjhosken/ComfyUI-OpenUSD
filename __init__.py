from aiohttp import web
import os
import server

@web.middleware
async def allow_wasm_headers(request, handler):
    response = await handler(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

existing = server.PromptServer.instance.app._middlewares
new_middlewares = [allow_wasm_headers] + list(existing)
server.PromptServer.instance.app._middlewares = existing.__class__(new_middlewares)

from .nodes.usd_io import LoadUSD, SaveUSD
from .nodes.usd_view import PreviewUSD
from .nodes.usd_utils import (SplitUSD, CombineUSD)
from .nodes.usd_convert import (
    ConvertUSD, MeshToUSD, Model3DToUSD, USDtoModel3D,
)


from .nodes.utils.shader.usd_material import ApplyUSDMaterial
from .nodes.utils.prim.usd_prim_get import GetUSDPrimInfo
from .nodes.utils.prim.usd_prim_set import SetUSDPrimInfo

from .nodes.utils.prim.usd_prim_color import SetUSDPrimDisplayColor
from .nodes.utils.prim.usd_prim_configure import ConfigureUSDPrim

NODE_CLASS_MAPPINGS = {
    "LoadUSD": LoadUSD,
    "SaveUSD": SaveUSD,
    "PreviewUSD": PreviewUSD,
    "SplitUSD": SplitUSD,
    "CombineUSD": CombineUSD,
    "ConvertUSD": ConvertUSD,
    "MeshToUSD": MeshToUSD,
    "Model3DToUSD": Model3DToUSD,
    "USDtoModel3D": USDtoModel3D,
    "ApplyUSDMaterial": ApplyUSDMaterial,

    "SetUSDPrimInfo": SetUSDPrimInfo,
    "GetUSDPrimInfo": GetUSDPrimInfo,

    "ConfigureUSDPrim": ConfigureUSDPrim,
    "SetUSDPrimDisplayColor": SetUSDPrimDisplayColor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadUSD": "Load USD",
    "SaveUSD": "Save USD",
    "PreviewUSD": "Preview USD",
    "SplitUSD": "Split USD",
    "CombineUSD": "Combine USD",
    "ConvertUSD": "Convert USD",
    "MeshToUSD": "Mesh to USD",
    "Model3DToUSD": "Model3D to USD",
    "USDtoModel3D": "USD to Model3D",
    "ApplyUSDMaterial": "USD Material",

    "SetUSDPrimInfo": "Set USD Prim Info",
    "GetUSDPrimInfo": "Get USD Prim Info",

    "ConfigureUSDPrim": "Configure USD Prim",
    "SetUSDPrimDisplayColor": "Set USD Prim Display Color"
}

WEB_DIRECTORY = "web"

def resolve_case_insensitive(path):
    if os.path.exists(path):
        return path
    parts = path.split(os.sep)
    current = '/' if path.startswith('/') else ''
    for part in parts:
        if not part:
            continue
        next_path = os.path.join(current, part) if current else part
        if os.path.exists(next_path):
            current = next_path
            continue
        if os.path.isdir(current or '.'):
            try:
                entries = os.listdir(current or '.')
                matched = False
                for entry in entries:
                    if entry.lower() == part.lower():
                        current = os.path.join(current, entry) if current else entry
                        matched = True
                        break
                if not matched:
                    return None
            except Exception:
                return None
        else:
            return None
    return current

@server.PromptServer.instance.routes.get("/usd/view")
async def serve_usd_file(request):
    filename = request.query.get("filename")
    if not filename:
        return web.Response(status=400, text="Missing filename")
    
    # Normalize absolute path
    filename = os.path.abspath(filename)
    
    # Attempt case-insensitive resolution if file does not exist directly
    resolved = resolve_case_insensitive(filename)
    
    if resolved and os.path.exists(resolved):
        response = web.FileResponse(resolved)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        return response
    else:
        return web.Response(status=404, text=f"File not found: {filename}")


# ---- Shared helpers for prim-tree serialisation ----------------------

def _usd_val(v):
    """Convert a USD value to something JSON-serialisable."""
    if v is None:
        return None
    if hasattr(v, '__iter__') and not isinstance(v, str):
        try:
            return list(v)
        except Exception:
            pass
    return str(v)


def _prim_to_dict(prim):
    children = [_prim_to_dict(child) for child in prim.GetChildren()]

    attributes = {}
    for attr in prim.GetAttributes():
        try:
            val = attr.Get()
            attributes[attr.GetName()] = {
                "type": str(attr.GetTypeName()),
                "value": _usd_val(val),
            }
        except Exception:
            pass

    metadata = {}
    try:
        for key in prim.GetAllMetadata():
            try:
                metadata[key] = _usd_val(prim.GetMetadata(key))
            except Exception:
                pass
    except Exception:
        pass

    return {
        "name": prim.GetName() or "/",
        "path": str(prim.GetPath()),
        "type": prim.GetTypeName() or "Prim",
        "active": prim.IsActive(),
        "children": children,
        "attributes": attributes,
        "metadata": metadata,
    }


def _build_prim_payload(stage):
    pseudo_root = stage.GetPseudoRoot()
    return {
        "name": "/",
        "path": "/",
        "type": "Stage",
        "active": True,
        "children": [_prim_to_dict(p) for p in pseudo_root.GetChildren()],
        "attributes": {},
        "metadata": {},
    }


def _json_response(payload):
    import json
    return web.Response(
        content_type="application/json",
        text=json.dumps(payload),
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ---- GET /usd/prims?filename=<path> ------------------------------------

@server.PromptServer.instance.routes.get("/usd/prims")
async def serve_usd_prims_get(request):
    """Return a full JSON prim-tree for a given USD file path."""
    from pxr import Usd
    filename = request.query.get("filename")
    if not filename:
        return web.Response(status=400, text="Missing filename")

    filename = os.path.abspath(filename)
    resolved = resolve_case_insensitive(filename)
    if not resolved or not os.path.exists(resolved):
        return web.Response(status=404, text=f"File not found: {filename}")

    try:
        stage = Usd.Stage.Open(resolved)
        return _json_response(_build_prim_payload(stage))
    except Exception as e:
        import traceback
        return web.Response(status=500, text=f"USD prim traversal failed: {e}\n{traceback.format_exc()}")


# ---- POST /usd/prims  (body = raw USDA text) --------------------------

@server.PromptServer.instance.routes.post("/usd/prims")
async def serve_usd_prims_post(request):
    """Return a full JSON prim-tree from raw USDA text sent in the request body."""
    import uuid, tempfile
    from pxr import Usd

    try:
        usda_text = await request.text()
        if not usda_text.strip():
            return web.Response(status=400, text="Empty USDA body")

        # Write to a temp file so OpenUSD can open it
        tmp_path = os.path.join(tempfile.gettempdir(), f"comfyusd_tree_{uuid.uuid4().hex}.usda")
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                f.write(usda_text)
            stage = Usd.Stage.Open(tmp_path)
            return _json_response(_build_prim_payload(stage))
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    except Exception as e:
        import traceback
        return web.Response(status=500, text=f"USD prim traversal failed: {e}\n{traceback.format_exc()}")


__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']