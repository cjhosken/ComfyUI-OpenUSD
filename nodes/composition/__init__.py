from .configure import ConfigureUSDStage
from .create import CreateUSDStage
from .layerbreak import LayerBreakUSD
from .sublayer import AddUSDSublayer
from .specializes import AddUSDSpecializes
from .reference import AddUSDReferenceOrPayload
from .variant import AddUSDVariant

NODE_CLASS_MAPPINGS = {
    "ConfigureUSDStage": ConfigureUSDStage,
    "CreateUSDStage": CreateUSDStage,
    "LayerBreakUSD": LayerBreakUSD,
    "AddUSDSublayer": AddUSDSublayer,
    "AddUSDReferenceOrPayload": AddUSDReferenceOrPayload,
    "AddUSDVariant": AddUSDVariant,
    "AddUSDSpecializes": AddUSDSpecializes
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ConfigureUSDStage": "Configure USD Stage",
    "CreateUSDStage": "Create USD Stage",
    "LayerBreakUSD": "Layer Break USD",
    "AddUSDSublayer": "Sublayer USD",
    "AddUSDReferenceOrPayload": "Add USD Reference / Payload",
    "AddUSDVariant": "Add USD Variant",
    "AddUSDSpecializes": "Add USD Specializes"
}