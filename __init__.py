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
from .nodes.usd_utils import (
    SplitUSD, CombineUSD, EditUSDPrim, ApplyUSDMaterial, AddUSDSublayer
)
from .nodes.usd_convert import (
    ConvertUSD, MeshToUSD, Model3DToUSD, USDtoModel3D,
)

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
    "EditUSDPrim": EditUSDPrim,
    "ApplyUSDMaterial": ApplyUSDMaterial,
    "AddUSDSublayer": AddUSDSublayer
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
    "EditUSDPrim": "Edit USD Prim",
    "ApplyUSDMaterial": "USD Material",
    "AddUSDSublayer": "Add USD Sublayer"
}

WEB_DIRECTORY = "./web"

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

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']