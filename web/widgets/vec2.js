export function createVec2Widget(node, inputName, value = [0, 0]) {
    value = Array.isArray(value) ? value : [0, 0];

    const container = document.createElement("div");
    container.style.cssText = `
        display: flex;
        gap: 6px;
        align-items: center;
        background: #111112;
        padding: 3px 6px;
        border: 1px solid #222;
        border-radius: 4px;
    `;

    const inputs = [];

    function makeNumber(i, labelText) {
        const item = document.createElement("div");
        item.style.cssText = `
            display: flex;
            align-items: center;
            gap: 3px;
        `;

        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.cssText = `
            font-size: 9px;
            color: #666;
            font-weight: bold;
            font-family: sans-serif;
        `;

        const el = document.createElement("input");
        el.type = "number";
        el.value = value[i];
        el.step = "0.1";
        el.style.cssText = `
            width: 44px;
            background: #1a1a1c;
            border: 1px solid #333;
            color: #ccc;
            font-size: 10px;
            font-family: monospace;
            padding: 1px 2px;
            border-radius: 2px;
            text-align: center;
            outline: none;
        `;

        el.oninput = () => {
            value[i] = parseFloat(el.value) || 0.0;
            node.setDirtyCanvas(true, true);
        };

        item.appendChild(label);
        item.appendChild(el);
        inputs.push(el);
        container.appendChild(item);
    }

    makeNumber(0, "X");
    makeNumber(1, "Y");

    return {
        name: inputName,
        type: "VEC2",
        value: value,
        element: container,

        set(v) {
            value = Array.isArray(v) ? v : [0, 0];
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