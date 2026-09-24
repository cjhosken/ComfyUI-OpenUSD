import { createVectorWidget } from "./vec_common.js";

/**
 * Create a 3D vector widget (X, Y, Z).
 */
export function createVec3Widget(node, inputName, value = [0, 0, 0]) {
    return createVectorWidget(node, inputName, "VEC3", ["X", "Y", "Z"], value);
}