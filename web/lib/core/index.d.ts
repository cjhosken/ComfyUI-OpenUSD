import { coreURL, wasmURL, workerURL } from "./urls.js";

//#region src/index.d.ts
type OpenUsdPxrResourceURL = string | URL | Blob;
interface OpenUsdPxrWasmModule extends Record<string, any> {
  FS?: any;
  mainScriptUrlOrBlob?: unknown;
  PxrJsInitializeOpenUsdRuntime?: () => void;
}
type OpenUsdPxrWasmFactory = (options?: Record<string, unknown>) => Promise<OpenUsdPxrWasmModule> | OpenUsdPxrWasmModule;
declare const createOpenUsdPxrWasm: OpenUsdPxrWasmFactory;
declare const core: OpenUsdPxrWasmFactory;
declare const openUsdPxrCore: {
  core: OpenUsdPxrWasmFactory;
  coreURL: string;
  wasmURL: string;
  workerURL: string;
};
//#endregion
export { OpenUsdPxrResourceURL, OpenUsdPxrWasmFactory, OpenUsdPxrWasmModule, core, coreURL, createOpenUsdPxrWasm, openUsdPxrCore as default, wasmURL, workerURL };