import os
import tempfile
import folder_paths

class SplitOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "split_usd"

    RETURN_TYPES = ("STRING", "TEXT",)
    RETURN_NAMES = ("usd_path", "usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd": ("USD",),
            }
        }

    def split_usd(self, usd):
        if not isinstance(usd, dict):
            raise TypeError("Expected input of type 'USD' (dict)")
        return (usd.get("usd_path", ""), usd.get("usda_text", ""))

class CombineOpenUSD:
    CATEGORY = "USD"
    FUNCTION = "combine_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("usd",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_path": ("STRING", {"default": "", "multiline": False}),
                "usda_text": ("TEXT", {"multiline": True, "forceInput": True}),
            }
        }

    def combine_usd(self, usd_path, usda_text):
        return ({"usd_path": usd_path, "usda_text": usda_text},)