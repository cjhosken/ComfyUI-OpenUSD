import os
import json
import uuid
import tempfile
import traceback
from aiohttp import web
import server

from .nodes.utils import IN_MEMORY_STAGES
from .nodes import (
    composition as usd_composition,
    convert as usd_convert,
    display as usd_display,
    io as usd_io,
    scene as usd_scene,
    scripting as usd_scripting,
    types as usd_types,
)

# ---------------------------------------------------------------------------
# Constants & Headers
# ---------------------------------------------------------------------------

WASM_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
}

WEB_DIRECTORY = "web"

# ---------------------------------------------------------------------------
# Middleware: Enable WASM SharedArrayBuffer / SIMD Headers
# ---------------------------------------------------------------------------

@web.middleware
async def allow_wasm_headers(request, handler):
    response = await handler(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

# Register middleware with ComfyUI's PromptServer instance (idempotently)
if hasattr(server, "PromptServer") and hasattr(server.PromptServer, "instance"):
    prompt_server = server.PromptServer.instance
    if prompt_server and hasattr(prompt_server, "app"):
        app_ref = prompt_server.app
        existing = getattr(app_ref, "_middlewares", None)
        if existing is not None and allow_wasm_headers not in existing:
            new_middlewares = [allow_wasm_headers] + list(existing)
            app_ref._middlewares = existing.__class__(new_middlewares)


# ---------------------------------------------------------------------------
# Path & Case-Sensitivity Utilities
# ---------------------------------------------------------------------------

def resolve_case_insensitive(path: str):
    """Resolve a filesystem path in a case-insensitive manner (useful on Linux)."""
    if not path or os.path.exists(path):
        return path

    parts = path.split(os.sep)
    current = "/" if path.startswith("/") else ""

    for part in parts:
        if not part:
            continue
        next_path = os.path.join(current, part) if current else part
        if os.path.exists(next_path):
            current = next_path
            continue

        search_dir = current or "."
        if os.path.isdir(search_dir):
            try:
                matched_entry = next((e for e in os.listdir(search_dir) if e.lower() == part.lower()), None)
                if matched_entry:
                    current = os.path.join(current, matched_entry) if current else matched_entry
                    continue
            except Exception:
                return None
        return None

    return current


# ---------------------------------------------------------------------------
# Prim-Tree Serialization Helpers
# ---------------------------------------------------------------------------

def _usd_val(v):
    """Convert a USD attribute value to a JSON-serializable representation."""
    if v is None:
        return None

    # Check for pxr Gf types (e.g. Vec3f, Matrix4d, Color3f, Quatf, Range, etc.)
    typename = type(v).__name__
    if typename.startswith(("Vec", "Matrix", "Quat", "Color", "Range", "Rect", "Frustum", "Interval")):
        if hasattr(v, "__len__"):
            try:
                return [float(x) for x in v]
            except Exception:
                pass
        return str(v)

    # Handle Sdf.AssetPath or objects with a path property
    if hasattr(v, "path"):
        return v.path

    # Standard JSON-serializable primitives
    if isinstance(v, (str, int, float, bool)):
        return v

    # Recursively convert iterables (Vt arrays, lists, tuples)
    if hasattr(v, "__iter__") and not isinstance(v, (str, bytes)):
        try:
            return [_usd_val(x) for x in v]
        except Exception:
            pass

    # Fallback to direct serialization check or string representation
    try:
        json.dumps(v)
        return v
    except Exception:
        return str(v)


def _prim_to_dict(prim):
    """Recursively serialize a Usd.Prim and its children into a dictionary tree."""
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
        "children": [_prim_to_dict(child) for child in prim.GetChildren()],
        "attributes": attributes,
        "metadata": metadata,
    }


def _build_prim_payload(stage):
    """Build the stage metadata and prim-tree dictionary for frontend consumption."""
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

    pseudo_root = stage.GetPseudoRoot()
    return {
        "name": "/",
        "path": "/",
        "type": "Stage",
        "active": True,
        "children": [_prim_to_dict(p) for p in pseudo_root.GetChildren()],
        "attributes": {},
        "metadata": stage_metadata,
    }


def _json_response(payload, status=200):
    """Return an aiohttp JSON response with WASM and CORS headers."""
    headers = {"Content-Type": "application/json", **WASM_CORS_HEADERS}
    return web.Response(
        status=status,
        text=json.dumps(payload),
        headers=headers,
    )


# ---------------------------------------------------------------------------
# API Routes: /usd/view and /usd/prims
# ---------------------------------------------------------------------------

async def serve_usd_file(request):
    """Serve a USD file or in-memory stage with appropriate WASM/CORS headers."""
    filename = request.query.get("filename")
    usd_hash = request.query.get("h")

    if not filename:
        return web.Response(status=400, text="Missing filename parameter")

    # 1. Check for in-memory stage update registered for this hash
    if usd_hash and usd_hash in IN_MEMORY_STAGES:
        try:
            from pxr import Usd

            usda_text = IN_MEMORY_STAGES[usd_hash]
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

            return web.Response(
                text=flat_usda,
                content_type="text/plain",
                headers=WASM_CORS_HEADERS,
            )
        except Exception as e:
            print(f"[ComfyUI-USD] Failed to serve in-memory stage: {e}")

    # 2. Serve physical file from disk
    abs_filename = os.path.abspath(filename)
    resolved = resolve_case_insensitive(abs_filename)

    if resolved and os.path.exists(resolved):
        response = web.FileResponse(resolved)
        for k, v in WASM_CORS_HEADERS.items():
            response.headers[k] = v
        return response

    return web.Response(status=404, text=f"File not found: {filename}")


async def serve_usd_prims_get(request):
    """Return a full JSON prim-tree for a given USD file path."""
    from pxr import Usd

    filename = request.query.get("filename")
    if not filename:
        return web.Response(status=400, text="Missing filename parameter")

    resolved = resolve_case_insensitive(os.path.abspath(filename))
    if not resolved or not os.path.exists(resolved):
        return web.Response(status=404, text=f"File not found: {filename}")

    try:
        stage = Usd.Stage.Open(resolved)
        return _json_response(_build_prim_payload(stage))
    except Exception as e:
        return web.Response(
            status=500,
            text=f"USD prim traversal failed: {e}\n{traceback.format_exc()}",
            headers=WASM_CORS_HEADERS,
        )


async def serve_usd_prims_post(request):
    """Return a full JSON prim-tree from raw USDA text sent in the request body."""
    from pxr import Usd

    try:
        usda_text = await request.text()
        if not usda_text.strip():
            return web.Response(status=400, text="Empty USDA body")

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
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except Exception as e:
        return web.Response(
            status=500,
            text=f"USD prim traversal failed: {e}\n{traceback.format_exc()}",
            headers=WASM_CORS_HEADERS,
        )


# Register routes if PromptServer instance is available
if hasattr(server, "PromptServer") and getattr(server.PromptServer, "instance", None) is not None:
    server.PromptServer.instance.routes.get("/usd/view")(serve_usd_file)
    server.PromptServer.instance.routes.get("/usd/prims")(serve_usd_prims_get)
    server.PromptServer.instance.routes.post("/usd/prims")(serve_usd_prims_post)



# ---------------------------------------------------------------------------
# Node Registrations
# ---------------------------------------------------------------------------

NODE_CLASS_MAPPINGS = {
    **usd_io.NODE_CLASS_MAPPINGS,
    **usd_types.NODE_CLASS_MAPPINGS,
    **usd_scene.NODE_CLASS_MAPPINGS,
    **usd_convert.NODE_CLASS_MAPPINGS,
    **usd_composition.NODE_CLASS_MAPPINGS,
    **usd_scripting.NODE_CLASS_MAPPINGS,
    **usd_display.NODE_CLASS_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **usd_io.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_types.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_scene.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_convert.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_composition.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_scripting.NODE_DISPLAY_NAME_MAPPINGS,
    **usd_display.NODE_DISPLAY_NAME_MAPPINGS,
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]