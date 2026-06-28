import { app } from "../../scripts/app.js";

import { createVec2Widget } from "./widgets/vec2.js";
import { createVec3Widget } from "./widgets/vec3.js";
import { createColorWidget } from "./widgets/color.js";

app.registerExtension({
    name: "usd.socket",

    async setup() {
        const color = "#2ECC71";

        LiteGraph.NODE_SLOT_COLORS ??= {};
        LiteGraph.slot_types_default_in ??= {};
        LiteGraph.slot_types_default_out ??= {};

        LiteGraph.NODE_SLOT_COLORS["USD"] = color;
        LiteGraph.slot_types_default_in["USD"] = color;
        LiteGraph.slot_types_default_out["USD"] = color;
    },
});

app.registerExtension({
    name: "usd.datatypes",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        const onNodeCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated?.apply(this, arguments);

            if (!this.widgets) this.widgets = [];

            // Attach widgets based on input type
            for (const input of this.inputs || []) {
                if (input.type === "VEC2") {
                    const w = createVec2Widget(this, input.name);
                    this.widgets.push(w);
                }

                if (input.type === "VEC3") {
                    const w = createVec3Widget(this, input.name);
                    this.widgets.push(w);
                }

                if (input.type === "COLOR") {
                    const w = createColorWidget(this, input.name);
                    this.widgets.push(w);
                }
            }

            return r;
        };
    },
});