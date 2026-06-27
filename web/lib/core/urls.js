//#region src/urls.ts
function normalizeBrowserFileAssetUrl(value) {
	const baseHref = globalThis.location?.href;
	if (typeof baseHref !== "string") return value;
	try {
		const url = new URL(value, baseHref);
		if (url.protocol !== "file:" || !url.pathname.startsWith("/_next/")) return value;
		return new URL(`${url.pathname}${url.search}${url.hash}`, baseHref).href;
	} catch {
		return value;
	}
}
const coreURL = normalizeBrowserFileAssetUrl(new URL("./openusd_pxr_wasm.js", import.meta.url).href);
const wasmURL = normalizeBrowserFileAssetUrl(new URL("./openusd_pxr_wasm.wasm", import.meta.url).href);
const workerURL = coreURL;
var urls_default = {
	coreURL,
	wasmURL,
	workerURL
};
//#endregion
export { coreURL, urls_default as default, wasmURL, workerURL };
