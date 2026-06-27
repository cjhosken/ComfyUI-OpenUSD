import os
import folder_paths

class LoadOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "load_openusd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("usd",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_path": (
                    "STRING",
                    {
                        "default":"path/to/file.usd",
                        "multiline": False,
                        "path": True,
                    },
                ),
            }
        }
    
    def load_openusd(self, usd_path):
        if not os.path.exists(usd_path):
            raise FileNotFoundError(f"USD file not found at {usd_path}")
        
        usda_text = ""
        try:
            from pxr import Usd

            stage = Usd.Stage.Open(usd_path)
            if stage:
                usda_text = stage.GetRootLayer().ExportToString()
            else:
                usda_text = "Failed to open USD Stage."

        except ImportError:
            usda_text = (
                "Error: 'pxr-usd-api' library is not installed.\n"
                "Please run 'pip install pxr-usd-api' in your ComfyUI environment."
            )
        except Exception as e:
            usda_text = f"An error occured while processing the USD file:\n{str(e)}"
        
        return ({"usd_path": usd_path, "usda_text": usda_text},)