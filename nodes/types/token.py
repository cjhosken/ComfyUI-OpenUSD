from .utils import CONVERTERS


class CreateUSDToken:
    """Create a USD Token or string/asset value."""

    CATEGORY = "3d/usd/type"
    FUNCTION = "create_token"
    RETURN_TYPES = ("TOKEN",)
    RETURN_NAMES = ("token",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("STRING", {"default": ""}),
                "token_type": (
                    ["token", "string", "asset", "opaque", "group"],
                    {"default": "token"},
                ),
            }
        }

    def create_token(self, value: str, token_type: str):
        if token_type not in CONVERTERS:
            raise TypeError(f"Unsupported token type: {token_type}")

        entry = CONVERTERS[token_type]
        ctor = entry[0] if isinstance(entry, (tuple, list)) else entry
        token_value = ctor(value)

        return (
            {
                "data": token_value,
                "type": token_type,
            },
        )