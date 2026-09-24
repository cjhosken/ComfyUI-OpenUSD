import { createVectorWidget } from "./vec_common.js";

/**
 * Create a 2D vector widget (X, Y).
 */
export function createVec2Widget(node, inputName, value = [0, 0]) {
    return createVectorWidget(node, inputName, "VEC2", ["X", "Y"], value);
}