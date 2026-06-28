import os

class SaveOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "save_openusd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "output_path": (
                    "STRING", 
                    {
                        "default":"path/to/file.usda",
                        "multiline": False,
                        "path": True,
                    },
                ),
            }
        }
    
    def save_openusd(self, USD, output_path):
        usda_text = USD.get("usda_text", "")

        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        try:
            from pxr import Usd

            if usda_text.startswith("Error:") or usda_text.startswith("An error occured"):
                raise ValueError("Cannot save USD because the input USDA text contains an error message.")
            
            stage = Usd.Stage.CreateInMemory()
            stage.GetRootLayer().ImportFromString(usda_text)
            stage.GetRootLayer().Export(output_path)
            print(f"[SaveOpenUSD] Successfully saved USD stage to {output_path}")

        except ImportError:
            raise RuntimeError(
                "Error: 'pxr-usd-api' library is not installed.\n"
                "Please run 'pip install pxr-usd-api' in your ComfyUI environment."
            )
        except Exception as e:
            raise RuntimeError(f"An error occured while saving the USD file:\n{str(e)}")
        
        new_usd = USD.copy()
        new_usd["usd_path"] = output_path
        # Update usda_text with the newly exported version that contains the updated path comment
        try:
            new_usd["usda_text"] = stage.GetRootLayer().ExportToString()
        except Exception:
            pass
        return (new_usd,)