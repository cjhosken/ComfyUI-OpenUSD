import os

class PreviewOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "preview_openusd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("usd",)

    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd": ("USD",),
            }
        }

    def preview_openusd(self, usd):
        usd_path = usd.get("usd_path", "")
        usda_text = usd.get("usda_text", "")

        if usd_path != "" and usda_text == "" and os.path.exists(usd_path):
            try:
                from pxr import Usd
                stage = Usd.Stage.Open(usd_path)
                if stage:
                    stage.GetRootLayer().comment = f"usd_path: {os.path.abspath(usd_path)}"
                    usda_text = stage.GetRootLayer().ExportToString()
                else:
                    usda_text = "Failed to open USD Stage."
            except ImportError:
                usda_text = (
                    "Error: 'pxr-usd-api' library is not installed.\n"
                    "Please run 'pip install pxr-usd-api' in your ComfyUI environment."
                )
            except Exception as e:
                usda_text = f"An error occurred while processing the USD file:\n{str(e)}"

        return {
            "ui": {"usd_path": [usd_path], "usda_text": [usda_text]},
            "result": (usd,)
        }