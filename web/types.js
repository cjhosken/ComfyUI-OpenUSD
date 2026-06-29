import { app } from "../../../scripts/app.js";

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
                if (input.type === "VEC2" || input.type === "VEC3" || input.type === "COLOR") {
                    const w = input.type === "VEC2" ? createVec2Widget(this, input.name) :
                              input.type === "VEC3" ? createVec3Widget(this, input.name) :
                                                      createColorWidget(this, input.name);

                    // Create and prepend a label
                    const label = document.createElement("span");
                    label.textContent = input.name + ":";
                    label.style.cssText = `
                        width: 75px;
                        font-size: 10px;
                        color: #bbb;
                        font-family: monospace;
                        text-align: right;
                        margin-right: 6px;
                        text-overflow: ellipsis;
                        overflow: hidden;
                        white-space: nowrap;
                    `;
                    w.element.insertBefore(label, w.element.firstChild);
                    w.element.style.marginBottom = "4px";

                    this.addDOMWidget(input.name, "HTML", w.element, {
                        getValue: w.get,
                        setValue: w.set,
                        serializeValue: w.serializeValue
                    });

                    // Helper to update disabled state based on connection
                    const updateConnectedState = () => {
                        const inputSlot = this.inputs.find(inp => inp.name === input.name);
                        const isConnected = inputSlot && inputSlot.link !== null;
                        
                        const els = w.element.querySelectorAll("input");
                        els.forEach(el => {
                            el.disabled = isConnected;
                            el.style.opacity = isConnected ? "0.35" : "1.0";
                            el.style.cursor = isConnected ? "not-allowed" : "auto";
                        });
                        label.style.opacity = isConnected ? "0.4" : "1.0";
                    };

                    // Hook connection changes
                    const originalConnectionsChange = this.onConnectionsChange;
                    this.onConnectionsChange = function(type, index, connected, link_info, input_info) {
                        originalConnectionsChange?.apply(this, arguments);
                        updateConnectedState();
                    };

                    setTimeout(updateConnectedState, 50);
                }
            }

            return r;
        };
    },
});