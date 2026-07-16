from .text import TextToUSD, USDtoText
from .format import ConvertUSD

NODE_CLASS_MAPPINGS = {
    "TexttoUSD": TextToUSD,
    "USDToText": USDtoText,
    "ConvertUSD": ConvertUSD,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TexttoUSD": "Text to USD",
    "USDToText": "USD to Text",
    "ConvertUSD": "Convert USD",
}
