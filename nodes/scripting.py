from pxr import Usd
from .utils import OpenUSDError


class USDPythonScript:
    """Execute arbitrary Python code against an active USD stage."""

    CATEGORY = "3d/usd/utils"
    FUNCTION = "execute_script"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("stage",)

    @classmethod
    def INPUT_TYPES(cls):
        default_script = (
            "# The stage is available as 'stage'\n"
            "# Example:\n"
            "# prim = stage.DefinePrim('/MyPrim', 'Xform')\n"
        )
        return {
            "required": {
                "stage": ("USD",),
                "script": ("STRING", {"default": default_script, "multiline": True}),
            }
        }

    def execute_script(self, stage, script: str):
        if stage is None:
            raise OpenUSDError("Invalid USD stage")

        try:
            local_vars = {"stage": stage, "Usd": Usd}
            exec(script, {}, local_vars)
        except Exception as e:
            print(f"[USDPythonScript] Error executing USD script: {e}")
            raise

        return (stage,)


NODE_CLASS_MAPPINGS = {
    "USDPythonScript": USDPythonScript,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "USDPythonScript": "USD Python Script",
}
