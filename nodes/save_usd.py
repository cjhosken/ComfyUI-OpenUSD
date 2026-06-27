import os

class SaveOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "save_openusd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("usd",)

    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd": ("USD",),
                "output_path": (
                    "STRING", 
                    {
                        "default":"path/to/file.usda",
                        "multiline": False,
                        "path": True,
                    },
                ),
                "extension": (
                    ["usda", "usdc", "usdz"],
                    {
                        "default":"usda",  
                    },
                ),
                "overwrite": (["True", "False"], {"default": "True"})
            }
        }
    
    def save_openusd(self, usd, output_path, extension, overwrite):
        usda_text = usd.get("usda_text", "")
        extension = extension.lstrip(".")

        # Strip any existing extension and apply the selected one
        output_path = f"{os.path.splitext(output_path)[0]}.{extension}"

        if os.path.exists(output_path) and overwrite == "False":
            print(f"[SaveOpenUSD] File already exists at {output_path}. Skipping save.")
            new_usd = usd.copy()
            new_usd["usd_path"] = output_path
            return (new_usd,)
        
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
        
        new_usd = usd.copy()
        new_usd["usd_path"] = output_path
        # Update usda_text with the newly exported version that contains the updated path comment
        try:
            new_usd["usda_text"] = stage.GetRootLayer().ExportToString()
        except Exception:
            pass
        return (new_usd,)