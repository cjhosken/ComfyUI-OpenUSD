import { createVectorWidget } from "./vec_common.js";

/**
 * Create a 4D vector widget (X, Y, Z, W).
 */
export function createVec4Widget(node, inputName, value = [0, 0, 0, 0]) {
    return createVectorWidget(node, inputName, "VEC4", ["X", "Y", "Z", "W"], value);
}