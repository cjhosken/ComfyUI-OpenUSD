
export function createColorWidget(node, inputName, value = "#ffffff") {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "6px";
    container.style.alignItems = "center";

    const color = document.createElement("input");
    color.type = "color";
    color.value = value;
    color.style.cssText = `
        width: 24px;
        height: 20px;
        border: 1px solid #3e3e3f;
        background: none;
        padding: 0;
        cursor: pointer;
        border-radius: 3px;
    `;

    const text = document.createElement("input");
    text.type = "text";
    text.value = value;
    text.style.cssText = `
        width: 70px;
        background: #1e1e1f;
        border: 1px solid #3e3e3f;
        color: #ddd;
        font-size: 10px;
        font-family: monospace;
        padding: 2px 4px;
        border-radius: 3px;
        text-align: center;
    `;

    function syncFromColor() {
        text.value = color.value;
        widget.value = color.value;
        node.setDirtyCanvas(true, true);
    }

    function syncFromText() {
        if (/^#([0-9A-Fa-f]{6})$/.test(text.value)) {
            color.value = text.value;
            widget.value = text.value;
            node.setDirtyCanvas(true, true);
        }
    }

    color.oninput = syncFromColor;
    text.oninput = syncFromText;

    container.appendChild(color);
    container.appendChild(text);

    const widget = {
        name: inputName,
        type: "COLOR",
        value: value,
        element: container,

        set(v) {
            value = v;
            color.value = v;
            text.value = v;
        },

        get() {
            return value;
        },

        serializeValue() {
            return value;
        },
    };

    return widget;
}