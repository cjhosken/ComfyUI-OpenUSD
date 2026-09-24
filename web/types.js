import { app } from "../../../scripts/app.js";
import { createVec2Widget } from "./widgets/vec2.js";
import { createVec3Widget } from "./widgets/vec3.js";
import { createVec4Widget } from "./widgets/vec4.js";

const VECTOR_FACTORIES = {
    VEC2: createVec2Widget,
    VEC3: createVec3Widget,
    VEC4: createVec4Widget,
};

app.registerExtension({
    name: "usd.datatypes",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        const onNodeCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated?.apply(this, arguments);
            if (!this.widgets) this.widgets = [];

            const getDefVal = (name) => {
                const config = nodeData.input?.required?.[name] || nodeData.input?.optional?.[name];
                return config?.[1]?.default;
            };

            for (const input of (this.inputs || [])) {
                const factory = VECTOR_FACTORIES[input.type];
                if (!factory) continue;

                const defVal = getDefVal(input.name);
                const widgetObj = factory(this, input.name, defVal);

                // Prepend label element
                const label = document.createElement("span");
                label.textContent = `${input.name}:`;
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
                widgetObj.element.insertBefore(label, widgetObj.element.firstChild);
                widgetObj.element.style.marginBottom = "4px";

                this.addDOMWidget(input.name, "HTML", widgetObj.element, {
                    getValue: widgetObj.get,
                    setValue: widgetObj.set,
                    serializeValue: widgetObj.serializeValue,
                });

                // Update disabled and dim styling when an input link is connected
                const updateConnectedState = () => {
                    const inputSlot = this.inputs?.find(inp => inp.name === input.name);
                    const isConnected = Boolean(inputSlot && inputSlot.link !== null);

                    const inputs = widgetObj.element.querySelectorAll("input");
                    inputs.forEach(el => {
                        el.disabled = isConnected;
                        el.style.opacity = isConnected ? "0.35" : "1.0";
                        el.style.cursor = isConnected ? "not-allowed" : "auto";
                    });
                    label.style.opacity = isConnected ? "0.4" : "1.0";
                };

                const originalConnectionsChange = this.onConnectionsChange;
                this.onConnectionsChange = function () {
                    originalConnectionsChange?.apply(this, arguments);
                    updateConnectedState();
                };

                setTimeout(updateConnectedState, 50);
            }

            return r;
        };
    },
});