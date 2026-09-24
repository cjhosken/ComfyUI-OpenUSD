/**
 * Shared factory for multi-dimensional vector widgets (Vec2, Vec3, Vec4).
 *
 * @param {object} node - The LiteGraph node instance.
 * @param {string} inputName - Name of the input slot.
 * @param {string} typeName - Type identifier ('VEC2', 'VEC3', 'VEC4').
 * @param {string[]} labels - Component labels (e.g. ['X', 'Y', 'Z']).
 * @param {number[]} defaultValue - Default vector values.
 * @returns {object} The widget interface object expected by ComfyUI DOM widgets.
 */
export function createVectorWidget(node, inputName, typeName, labels, defaultValue = []) {
    const dim = labels.length;
    let value = Array.isArray(defaultValue) && defaultValue.length === dim
        ? [...defaultValue]
        : new Array(dim).fill(0.0);

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

    const inputs = labels.map((labelText, i) => {
        const item = document.createElement("div");
        item.style.cssText = "display: flex; align-items: center; gap: 3px;";

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
        el.value = value[i] !== undefined ? value[i] : 0.0;
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
        container.appendChild(item);
        return el;
    });

    return {
        name: inputName,
        type: typeName,
        value,
        element: container,

        set(v) {
            value = Array.isArray(v) && v.length === dim ? [...v] : new Array(dim).fill(0.0);
            inputs.forEach((inp, i) => {
                inp.value = value[i];
            });
        },

        get() {
            return value;
        },

        serializeValue() {
            return value;
        },
    };
}
