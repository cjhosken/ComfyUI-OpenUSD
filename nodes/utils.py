import fnmatch
import hashlib
import os
import re

IN_MEMORY_STAGES = {}


class OpenUSDError(Exception):
    """Custom exception that automatically prepends a prefix to the error message."""

    def __init__(self, message: str):
        super().__init__(f"[OpenUSD] {message}")


def register_in_memory_stage(usda_text: str) -> str:
    """Register USDA text in memory by its SHA256 hash and return the hash."""
    if not usda_text:
        return ""
    h = hashlib.sha256(usda_text.encode("utf-8")).hexdigest()
    IN_MEMORY_STAGES[h] = usda_text
    return h


def resolve_usd_paths(layer, relative: bool = False):
    """Convert external references within a USD layer between relative and absolute paths."""
    if not layer or not layer.realPath or layer.anonymous:
        return

    anchor_path = os.path.abspath(layer.realPath)
    anchor_dir = os.path.dirname(anchor_path)

    for ref in layer.GetExternalReferences():
        if os.path.isabs(ref):
            if relative:
                new_ref = ref.replace(anchor_dir, "./")
                layer.UpdateExternalReference(ref, new_ref)
        else:
            if not relative:
                new_ref = os.path.normpath(os.path.join(anchor_dir, ref))
                layer.UpdateExternalReference(ref, new_ref)


def find_prims(stage, prim_path: str):
    """Find all prims on stage matching a path, wildcard (*, ?), or recursive wildcard (**)."""
    matched_prims = []

    if not prim_path.startswith("/"):
        prim_path = "/" + prim_path

    # Handle recursive wildcard pattern (**)
    if "**" in prim_path:
        pattern_parts = prim_path.split("**")
        regex_pattern = ""
        for i, part in enumerate(pattern_parts):
            escaped = re.escape(part)
            escaped = escaped.replace("\\*", "[^/]*")
            escaped = escaped.replace("\\?", "[^/]")

            if i == 0:
                regex_pattern += escaped
            else:
                regex_pattern += "(?:/.*)?" + escaped

        if prim_path.endswith("/**"):
            regex_pattern += "(?:/.*)?"
        elif prim_path.endswith("/**/"):
            regex_pattern += "(?:/.*)?/"

        pattern_re = re.compile(f"^{regex_pattern}$")
        for p in stage.Traverse():
            if pattern_re.match(str(p.GetPath())):
                matched_prims.append(p)

    # Handle standard wildcards (*, ?)
    elif "*" in prim_path or "?" in prim_path:
        for p in stage.Traverse():
            if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                matched_prims.append(p)

    # Exact path lookup
    else:
        prim = stage.GetPrimAtPath(prim_path)
        if prim.IsValid():
            matched_prims.append(prim)

    return matched_prims


def hex_to_rgba(color: str):
    """Parse a hex color string (#RGB, #RRGGBB, or #RRGGBBAA) into normalized (r, g, b, a) floats."""
    color = color.lstrip("#").lower()

    if len(color) == 3:
        color = "".join(c * 2 for c in color) + "ff"
    elif len(color) == 6:
        color += "ff"
    elif len(color) != 8:
        raise ValueError(f"Invalid hex color length: #{color}")

    if not all(c in "0123456789abcdef" for c in color):
        raise ValueError(f"Invalid hex characters in color: #{color}")

    r = int(color[0:2], 16) / 255.0
    g = int(color[2:4], 16) / 255.0
    b = int(color[4:6], 16) / 255.0
    a = int(color[6:8], 16) / 255.0

    return r, g, b, a