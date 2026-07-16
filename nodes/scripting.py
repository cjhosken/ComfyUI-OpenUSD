from pxr import Usd

class USDPythonScript:
    CATEGORY = "3d/usd/utils"
    FUNCTION = "execute_script"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_stage": ("USD",),
                "script": ("STRING", {"default": "# The stage is available as 'stage'\n\n# Example:\n# prim = stage.DefinePrim('/MyPrim', 'Xform')\n", "multiline": True}),
            }
        }
    
    def execute_script(self, usd_stage, script):
        stage = usd_stage["stage"]
        
        # Execute the script
        
        try:
            # Create a dictionary for local variables
            local_vars = {"stage": stage, "Usd": Usd}
            exec(script, {}, local_vars)
        except Exception as e:
            print(f"Error executing USD script: {e}")
            raise e
            
        return ({"stage": stage},)

NODE_CLASS_MAPPINGS = {
    "USDPythonScript": USDPythonScript,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "USDPythonScript": "USD Python Script",
}
