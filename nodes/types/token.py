from .utils import CONVERTERS

class CreateUSDToken:
    CATEGORY = "3d/usd/type"
    FUNCTION = "create_token"
    RETURN_TYPES = ("TOKEN",)
    RETURN_NAMES = ("token",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("STRING", {"default": ""}),
                "token_type": ([
                    "token", "string", "asset", "opaque", "group", 
                ], {"default": "token"}),
            }
        }

    def create_token(self, value, token_type):
        if token_type not in CONVERTERS:
            raise TypeError(f"Unsupported token type: {token_type}")

        ctor, _ = CONVERTERS[token_type]

        token_value = ctor(value)

        return (
            {
                "data": token_value,
                "type": token_type,
            },
        )