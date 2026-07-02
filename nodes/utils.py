import os
import hashlib
import fnmatch
import re

IN_MEMORY_STAGES = {}

def register_in_memory_stage(usda_text):
    if not usda_text:
        return ""
    h = hashlib.sha256(usda_text.encode('utf-8')).hexdigest()
    IN_MEMORY_STAGES[h] = usda_text
    return h

def resolve_usd_paths(layer, relative=False):
        if not layer.realPath or layer.anonymous:
             return
        
        anchor_path = os.path.abspath(layer.realPath)

        for ref in layer.GetExternalReferences():
            if (os.path.isabs(ref)):
                if relative:
                    new_ref = ref.replace(os.path.dirname(anchor_path), "./")
                    layer.UpdateExternalReference(ref, new_ref)
            else:
                if not relative:
                    new_ref = os.path.normpath(os.path.join(os.path.dirname(anchor_path), ref))
                    layer.UpdateExternalReference(ref, new_ref)

def find_prims(stage, prim_path):
    matched_prims = []

    if not prim_path.startswith("/"):
        prim_path = "/" + prim_path
    
    # Handle ** pattern (recursive directory wildcard)
    if "**" in prim_path:
        # Convert ** pattern to regex
        # **/ means any number of directories
        # /**/ means any number of directories at the end
        pattern_parts = prim_path.split("**")
        
        # Build regex pattern
        regex_pattern = ""
        for i, part in enumerate(pattern_parts):
            # Escape special regex characters (except * and ? which we'll handle)
            part = re.escape(part)
            # Convert * and ? back to regex equivalents
            part = part.replace("\\*", "[^/]*")  # * matches any chars except /
            part = part.replace("\\?", "[^/]")   # ? matches single char except /
            
            if i == 0:
                regex_pattern += part
            else:
                # ** means zero or more directory levels
                regex_pattern += "(?:/.*)?" + part
        
        # Handle trailing /**/ case
        if prim_path.endswith("/**"):
            regex_pattern += "(?:/.*)?"
        elif prim_path.endswith("/**/"):
            regex_pattern += "(?:/.*)?/"
        
        # Compile regex
        pattern_re = re.compile(f"^{regex_pattern}$")
        
        # Traverse and match
        for p in stage.Traverse():
            path_str = str(p.GetPath())
            if pattern_re.match(path_str):
                matched_prims.append(p)
    
    elif "*" in prim_path or "?" in prim_path:
        # Regular fnmatch for single-level wildcards
        for p in stage.Traverse():
            if fnmatch.fnmatch(str(p.GetPath()), prim_path):
                matched_prims.append(p)
    else:
        # Exact path match
        prim = stage.GetPrimAtPath(prim_path)
        if prim.IsValid():
            matched_prims.append(prim)
    
    return matched_prims

def hex_to_rgba(color: str):
    color = color.lstrip("#").lower()

    if len(color) == 6:
        color += "ff"
    elif len(color) != 8:
        raise ValueError(f"Invalid color: #{color}")

    if not all(c in "0123456789abcdef" for c in color):
        raise ValueError(f"Invalid hex color: #{color}")

    r = int(color[0:2], 16) / 255.0
    g = int(color[2:4], 16) / 255.0
    b = int(color[4:6], 16) / 255.0
    a = int(color[6:8], 16) / 255.0

    return r, g, b, a


class OpenUSDError(Exception):
    """Custom exception that automatically prepends a prefix to the error message."""
    def __init__(self, message):
        super().__init__(f"[OpenUSD] {message}")