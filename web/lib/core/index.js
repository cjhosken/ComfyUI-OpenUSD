import { coreURL, wasmURL, workerURL } from "./urls.js";
import rawCreateOpenUsdPxrWasm from "./openusd_pxr_wasm.js";
//#region src/index.ts
const createOpenUsdPxrWasm = rawCreateOpenUsdPxrWasm;
const core = createOpenUsdPxrWasm;
const openUsdPxrCore = {
	core,
	coreURL,
	wasmURL,
	workerURL
};
//#endregion
export { core, coreURL, createOpenUsdPxrWasm, openUsdPxrCore as default, wasmURL, workerURL };
