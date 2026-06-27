import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "OpenUSD.SlotColor",
    async init() {
        const LG = window.LiteGraph || window.LGraphConstants;
        
        if (LG) {
            // Ensure the colors_by_slot_type object exists before assigning to it
            if (!LG.colors_by_slot_type) {
                LG.colors_by_slot_type = {};
            }
            
            // Assign the USD connection dot color
            LG.colors_by_slot_type["USD"] = "#009dff";

            // Safely assign link colors if the array exists
            if (LG.LINK_COLORS && Array.isArray(LG.LINK_COLORS)) {
                LG.LINK_COLORS.push(["USD", "#009dff"]);
            }
        } else {
            console.warn("OpenUSD.SlotColor: Neither LiteGraph nor LGraphConstants could be found during init.");
        }
    }
});