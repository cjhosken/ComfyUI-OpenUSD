import { app } from "../../scripts/app.js";

function createVec3Widget(node, inputName, value = [0, 0, 0]) {
    value = Array.isArray(value) ? value : [0, 0, 0];

    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "4px";
    container.style.alignItems = "center";

    const inputs = [];

    function makeNumber(i) {
        const el = document.createElement("input");
        el.type = "number";
        el.value = value[i];
        el.step = "0.1";
        el.style.width = "60px";

        el.oninput = () => {
            value[i] = parseFloat(el.value);
            node.setDirtyCanvas(true, true);
        };

        inputs.push(el);
        container.appendChild(el);
    }

    makeNumber(0);
    makeNumber(1);
    makeNumber(2);

    return {
        name: inputName,
        type: "VEC3",
        value: value,
        element: container,

        set(v) {
            value = Array.isArray(v) ? v : [0, 0, 0];
            inputs.forEach((inp, i) => inp.value = value[i]);
        },

        get() {
            return value;
        },

        serializeValue() {
            return value;
        },
    };
}