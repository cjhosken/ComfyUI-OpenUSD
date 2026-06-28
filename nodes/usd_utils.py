import os
import folder_paths

class SplitUSD:
    CATEGORY = "3d/USD"
    FUNCTION = "split_usd"

    RETURN_TYPES = ("STRING", "STRING",)
    RETURN_NAMES = ("usd_path", "usda_text",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
            }
        }

    def split_usd(self, USD):
        if not isinstance(USD, dict):
            raise TypeError("Expected input of type 'USD' (dict)")
        return (USD.get("usd_path", ""), USD.get("usda_text", ""))

class CombineUSD:
    CATEGORY = "3d/USD"
    FUNCTION = "combine_usd"

    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "usd_path": ("STRING", {"default": "", "multiline": False}),
                "usda_text": ("STRING", {"multiline": True, "forceInput": True}),
            }
        }

    def combine_usd(self, usd_path, usda_text):
        return ({"usd_path": usd_path, "usda_text": usda_text},)