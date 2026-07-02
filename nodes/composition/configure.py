from pxr import Usd, UsdGeom

class ConfigureUSDStage:
    CATEGORY = "3d/usd/composition"
    FUNCTION = "configure_stage"
    RETURN_TYPES = ("USD",)
    RETURN_NAMES = ("USD",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "USD": ("USD",),
                "up_axis": (["Y", "Z"], {"default": "Y"}),
                "meters_per_unit": ("FLOAT", {"default": 1.0, "step": 0.001}),
            }
        }

    def configure_stage(self, USD, up_axis, meters_per_unit):
        stage = USD.get("stage", None)

        # Apply coordinate up-axis
        axis_token = UsdGeom.Tokens.y if up_axis == "Y" else UsdGeom.Tokens.z
        UsdGeom.SetStageUpAxis(stage, axis_token)
        
        # Apply meters-per-unit metric system scale
        UsdGeom.SetStageMetersPerUnit(stage, meters_per_unit)

        return ({"stage": stage},)