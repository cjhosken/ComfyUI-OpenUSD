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

from .nodes import types as usd_types
from .nodes import io as usd_io
from .nodes import scene as usd_scene
from .nodes import convert as usd_convert
from .nodes import composition as usd_composition
from .nodes import scripting as usd_scripting
from .nodes import display as usd_display

NODE_CLASS_MAPPINGS = {
    **usd_io.NODE_CLASS_MAPPINGS, 
    **usd_types.NODE_CLASS_MAPPINGS, 
    **usd_scene.NODE_CLASS_MAPPINGS,
    **usd_convert.NODE_CLASS_MAPPINGS,
    **usd_composition.NODE_CLASS_MAPPINGS,
    **usd_scripting.NODE_CLASS_MAPPINGS,
    **usd_display.NODE_CLASS_MAPPINGS
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **usd_io.NODE_DISPLAY_NAME_MAPPINGS, 
    **usd_types.NODE_DISPLAY_NAME_MAPPINGS, 
    **usd_scene.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_convert.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_composition.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_scripting.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_display.NODE_DISPLAY_NAME_MAPPINGS
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
    usd_hash = request.query.get("h")
    if not filename:
        return web.Response(status=400, text="Missing filename")
    
    # Check if there is an in-memory stage update registered for this hash
    if usd_hash:
        try:
            from nodes.utils import IN_MEMORY_STAGES
            if usd_hash in IN_MEMORY_STAGES:
                from pxr import Usd
                usda_text = IN_MEMORY_STAGES[usd_hash]
                
                # To resolve relative sublayers and references, write usda_text to a temp file
                # next to the original filename directory
                import uuid
                usd_dir = os.path.dirname(os.path.abspath(filename))
                temp_path = os.path.join(usd_dir, f"temp_flatten_{uuid.uuid4().hex}.usda")
                try:
                    with open(temp_path, "w", encoding="utf-8") as f:
                        f.write(usda_text)
                    
                    stage = Usd.Stage.Open(temp_path)
                    stage.Load()
                    flat_layer = stage.Flatten()
                    flat_usda = flat_layer.ExportToString()
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                
                response = web.Response(text=flat_usda, content_type="text/plain")
                response.headers["Access-Control-Allow-Origin"] = "*"
                response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
                response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
                response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
                return response
        except Exception as e:
            print(f"[serve_usd_file] Failed to serve in-memory stage: {e}")

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
    
    # Check for pxr Gf types (e.g. Vec3f, Matrix4d, Color3f, Quatf)
    typename = type(v).__name__
    if typename.startswith(('Vec', 'Matrix', 'Quat', 'Color', 'Range', 'Rect', 'Frustum', 'Interval')):
        try:
            if hasattr(v, '__len__'):
                return [float(x) for x in v]
        except Exception:
            pass
        return str(v)
        
    # Handle Sdf.AssetPath or other USD-specific types
    if hasattr(v, 'path'):
        return v.path
        
    # Standard JSON serializable basic types
    if isinstance(v, (str, int, float, bool)):
        return v

    # Convert iterables recursively (e.g. VtVec3fArray, list, tuple)
    if hasattr(v, '__iter__') and not isinstance(v, (str, bytes)):
        try:
            return [_usd_val(x) for x in v]
        except Exception:
            pass

    # Fallback to string representation to ensure it is always JSON serializable
    try:
        import json
        json.dumps(v)
        return v
    except Exception:
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
    
    stage_metadata = {}
    try:
        from pxr import UsdGeom
        stage_metadata["upAxis"] = str(UsdGeom.GetStageUpAxis(stage))
        stage_metadata["metersPerUnit"] = float(UsdGeom.GetStageMetersPerUnit(stage))
    except Exception:
        pass
    try:
        stage_metadata["startTimeCode"] = stage.GetStartTimeCode()
        stage_metadata["endTimeCode"] = stage.GetEndTimeCode()
        stage_metadata["timeCodesPerSecond"] = stage.GetTimeCodesPerSecond()
        stage_metadata["defaultPrim"] = str(stage.GetDefaultPrim().GetPath()) if stage.GetDefaultPrim() else ""
    except Exception:
        pass
    
    return {
        "name": "/",
        "path": "/",
        "type": "Stage",
        "active": True,
        "children": [_prim_to_dict(p) for p in pseudo_root.GetChildren()],
        "attributes": {},
        "metadata": stage_metadata,
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

        # Write to a temp file next to the original USD file to resolve relative sublayers and references
        filename = request.query.get("filename")
        if filename:
            usd_dir = os.path.dirname(os.path.abspath(filename))
            tmp_path = os.path.join(usd_dir, f"comfyusd_tree_{uuid.uuid4().hex}.usda")
        else:
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