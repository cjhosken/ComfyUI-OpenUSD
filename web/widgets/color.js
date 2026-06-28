
function createColorWidget(node, inputName, value = "#ffffff") {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "6px";
    container.style.alignItems = "center";

    const color = document.createElement("input");
    color.type = "color";
    color.value = value;

    const text = document.createElement("input");
    text.type = "text";
    text.value = value;
    text.style.width = "80px";

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