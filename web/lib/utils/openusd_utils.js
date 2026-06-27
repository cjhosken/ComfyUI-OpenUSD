//#region src/asset-resolver.ts
const DEFAULT_ASSET_SEARCH_EXTENSIONS = [
	".usd",
	".usda",
	".usdc",
	".usdz",
	".png",
	".jpg",
	".jpeg",
	".webp",
	".ktx2",
	".exr",
	".hdr",
	".mdl"
];
const DEFAULT_ASSET_SEARCH_ROOTS = [
	"resource",
	"resources",
	"asset",
	"assets",
	"img",
	"image",
	"images",
	"texture",
	"textures",
	"material",
	"materials"
];
const DEFAULT_MAX_ASSET_REFERENCES = 512;
const DEFAULT_MAX_ASSET_REFERENCE_DEPTH = 4;
const DEFAULT_PACKAGE_REMAP_ALIAS_COUNT = 16;
const USD_LAYER_EXTENSIONS = new Set([
	".usd",
	".usda",
	".usdc"
]);
const TEXTURE_DIRECTORY_NAMES = new Set([
	"img",
	"image",
	"images",
	"texture",
	"textures"
]);
const ABSOLUTE_OR_SCHEME_PATH_PATTERN = /^(?:\/|[A-Za-z][A-Za-z0-9+.-]*:)/;
function toFetchableUrl(value) {
	try {
		const url = new URL(value, globalThis.location?.href);
		return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:" ? url.href : null;
	} catch {
		return null;
	}
}
function normalizeFsRelativePath(path) {
	const parts = [];
	for (const part of path.replaceAll("\\", "/").split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") {
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	return parts.join("/");
}
function toLayerRelativeAssetPath(assetPath) {
	if (!assetPath || assetPath.startsWith("./") || assetPath.startsWith("../") || ABSOLUTE_OR_SCHEME_PATH_PATTERN.test(assetPath)) return assetPath;
	return `./${assetPath}`;
}
function dirname(path) {
	const normalized = normalizeFsRelativePath(path);
	const index = normalized.lastIndexOf("/");
	return index === -1 ? "" : normalized.slice(0, index);
}
function joinRelativePath(base, path) {
	return normalizeFsRelativePath(base ? `${base}/${path}` : path);
}
function joinFsPath(base, path) {
	return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
function fsDirname(path) {
	const normalized = path.replace(/\/+$/, "");
	const index = normalized.lastIndexOf("/");
	if (index <= 0) return "/";
	return normalized.slice(0, index);
}
function extensionOf(path) {
	const match = /\.([A-Za-z0-9]+)$/.exec(path.split(/[?#]/)[0] ?? path);
	return match ? `.${match[1]?.toLowerCase()}` : "";
}
function contentTypeForPath(path) {
	switch (extensionOf(path)) {
		case ".png": return "image/png";
		case ".jpg":
		case ".jpeg": return "image/jpeg";
		case ".webp": return "image/webp";
		default: return "application/octet-stream";
	}
}
function baseName(path) {
	return normalizeFsRelativePath(path).split("/").pop() ?? "";
}
function getEffectivePath(path) {
	if (!path) return "";
	try {
		const url = new URL(path, window.location.origin);
		const filename = url.searchParams.get("filename");
		if (filename) return filename;
	} catch {}
	return path;
}
function fileNameForSource(sourcePath) {
	const effective = getEffectivePath(sourcePath);
	const name = (effective.split(/[?#]/)[0] ?? effective).split("/").filter(Boolean).pop();
	return name && /\.[a-z0-9]+$/i.test(name) ? name : "scene.usda";
}
function toArrayBuffer(data) {
	const buffer = new ArrayBuffer(data.byteLength);
	new Uint8Array(buffer).set(data);
	return buffer;
}
function buildExtensionVariants(path, searchExtensions) {
	const normalized = normalizeFsRelativePath(path);
	if (!normalized) return [];
	if (extensionOf(normalized)) return [normalized];
	return [...searchExtensions.map((extension) => `${normalized}${extension}`), normalized];
}
function buildPackageRemapAliases(sourceRelativePath, assetPath) {
	const extension = extensionOf(assetPath);
	if (!extension || USD_LAYER_EXTENSIONS.has(extension)) return [];
	const name = baseName(assetPath);
	if (!name) return [];
	const aliasDirs = new Set([dirname(sourceRelativePath)]);
	const assetDir = dirname(assetPath);
	const assetParentDir = dirname(assetDir);
	const assetTextureDir = baseName(assetDir).toLowerCase();
	if (TEXTURE_DIRECTORY_NAMES.has(assetTextureDir)) aliasDirs.add(assetParentDir);
	return unique([...aliasDirs].flatMap((aliasDir) => Array.from({ length: DEFAULT_PACKAGE_REMAP_ALIAS_COUNT }, (_, index) => joinRelativePath(aliasDir, `${index}/${name}`))));
}
function addPackageRemapAliases(files, aliases, data, ownedAliases, aliasConflicts, existingFiles = {}) {
	for (const alias of aliases) {
		if (aliasConflicts.has(alias)) continue;
		const existingInput = existingFiles[alias];
		if (existingInput && existingInput !== data) {
			aliasConflicts.add(alias);
			continue;
		}
		const existing = files[alias];
		if (existing && existing !== data) {
			if (ownedAliases.has(alias)) {
				delete files[alias];
				ownedAliases.delete(alias);
			}
			aliasConflicts.add(alias);
			continue;
		}
		if (!existing) {
			files[alias] = data;
			ownedAliases.add(alias);
		}
	}
}
function unique(values) {
	return [...new Set(values)];
}
function uniqueFileCount(files) {
	return new Set(Object.values(files)).size;
}
function firstPathSegment(path) {
	return normalizeFsRelativePath(path).split("/")[0] ?? "";
}
function normalizeSearchRoots(roots) {
	return unique((roots ?? DEFAULT_ASSET_SEARCH_ROOTS).map((root) => normalizeFsRelativePath(root)).filter(Boolean));
}
function inferReferencedSearchRoots(refs, searchRoots) {
	const rootSet = new Set(searchRoots);
	return unique(refs.map((ref) => firstPathSegment(ref)).filter((segment) => rootSet.has(segment)));
}
function buildFetchAttempts(ref, sourceUrl, sourceRelativePath, searchExtensions, rootSourceUrl, searchRoots) {
	const sourceDir = dirname(sourceRelativePath);
	const attempts = [];
	const seen = /* @__PURE__ */ new Set();
	const normalizedRef = normalizeFsRelativePath(ref);
	const isDotRelative = /^\.{1,2}\//.test(ref);
	const candidates = [];
	function addCandidate(fsPath, fetchPath, baseUrl, aliases = []) {
		const normalizedFsPath = normalizeFsRelativePath(fsPath);
		if (!normalizedFsPath) return;
		candidates.push({
			fsPath: normalizedFsPath,
			fetchPath,
			baseUrl,
			aliases: unique([
				normalizedRef,
				normalizedFsPath,
				...aliases
			].filter(Boolean))
		});
	}
	if (!isDotRelative) {
		for (const root of searchRoots) if (normalizedRef !== root && !normalizedRef.startsWith(`${root}/`)) addCandidate(`${root}/${normalizedRef}`, `${root}/${normalizedRef}`, rootSourceUrl);
	}
	addCandidate(joinRelativePath(sourceDir, ref), ref, sourceUrl);
	if (!isDotRelative && sourceDir) addCandidate(normalizedRef, normalizedRef, rootSourceUrl);
	for (const candidate of candidates) {
		const fsAliases = new Set(candidate.aliases);
		for (const pathWithExtension of buildExtensionVariants(candidate.fsPath, searchExtensions)) {
			const extension = extensionOf(pathWithExtension);
			fsAliases.add(pathWithExtension);
			const fetchPath = extensionOf(candidate.fetchPath) ? candidate.fetchPath : `${candidate.fetchPath}${extension}`;
			try {
				const url = new URL(fetchPath, candidate.baseUrl).href;
				if (seen.has(url)) continue;
				seen.add(url);
				attempts.push({
					url,
					fsPaths: [...fsAliases],
					sourceRelativePath: pathWithExtension,
					packageRemapAliases: buildPackageRemapAliases(sourceRelativePath, pathWithExtension)
				});
			} catch {}
		}
	}
	return attempts;
}
async function fetchBinary(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return new Uint8Array(await response.arrayBuffer());
	} catch {
		return null;
	}
}
function isQueueableUsdLayer(path) {
	return USD_LAYER_EXTENSIONS.has(extensionOf(path));
}
function shouldFetchAssetReference(ref, searchExtensions) {
	const extension = extensionOf(ref);
	return !extension || searchExtensions.includes(extension);
}
function existingFsPath(pxr, directory, relativePaths, files) {
	for (const relativePath of relativePaths) if (files[relativePath] || pxr.FS.exists(joinFsPath(directory, relativePath))) return relativePath;
	return null;
}
function writeQueueableLayer(pxr, directory, files, relativePath, data) {
	if (!isQueueableUsdLayer(relativePath)) return;
	const filePath = joinFsPath(directory, relativePath);
	if (!files[relativePath]) files[relativePath] = data;

	// Ensure parent directories exist recursively in Emscripten FS without double slashes
	const parts = filePath.split('/').filter(Boolean);
	parts.pop();
	let current = '';
	for (const part of parts) {
		current += '/' + part;
		try {
			if (!pxr.FS.exists(current)) {
				pxr.FS.mkdir(current);
			}
		} catch (e) {}
	}

	pxr.FS.writeFile(filePath, data);
}
function urlForSourceRelativePath(sourceRelativePath, rootSourceUrl) {
	try {
		return new URL(sourceRelativePath, rootSourceUrl).href;
	} catch {
		return rootSourceUrl;
	}
}
function queueUsdLayer(queue, queuedLayers, pxr, directory, sourceRelativePath, sourceUrl, rootSourceUrl, searchRoots, depth) {
	if (!isQueueableUsdLayer(sourceRelativePath)) return;
	const filePath = joinFsPath(directory, sourceRelativePath);
	if (!pxr.FS.exists(filePath)) return;
	const queueKey = sourceRelativePath;
	if (queuedLayers.has(queueKey)) return;
	queuedLayers.add(queueKey);
	queue.push({
		filePath,
		sourceUrl,
		rootSourceUrl,
		sourceRelativePath,
		searchRoots,
		depth
	});
}
async function autoResolveAssetFiles(pxr, rootFilePath, options) {
	const sourcePath = options.sourcePath ?? "";
	if (options.autoResolveAssets === false || !sourcePath) return {};
	const sourceUrl = toFetchableUrl(sourcePath);
	if (!sourceUrl) return {};
	const searchExtensions = options.assetSearchExtensions ?? DEFAULT_ASSET_SEARCH_EXTENSIONS;
	const configuredSearchRoots = normalizeSearchRoots(options.assetSearchRoots);
	const maxFiles = options.maxAssetReferences ?? DEFAULT_MAX_ASSET_REFERENCES;
	const maxDepth = options.maxAssetReferenceDepth ?? DEFAULT_MAX_ASSET_REFERENCE_DEPTH;
	const rootRelativePath = normalizeFsRelativePath(options.fileName ?? fileNameForSource(sourcePath));
	const directory = fsDirname(rootFilePath);
	const files = {};
	const ownedPackageAliases = /* @__PURE__ */ new Set();
	const packageAliasConflicts = /* @__PURE__ */ new Set();
	const fetchedUrls = /* @__PURE__ */ new Set();
	const queuedLayers = /* @__PURE__ */ new Set();
	const queue = [{
		filePath: rootFilePath,
		sourceUrl,
		rootSourceUrl: sourceUrl,
		sourceRelativePath: rootRelativePath,
		searchRoots: inferReferencedSearchRoots([rootRelativePath], configuredSearchRoots),
		depth: 0
	}];
	queuedLayers.add(rootRelativePath);
	while (queue.length > 0 && uniqueFileCount(files) < maxFiles) {
		const item = queue.shift();
		if (!item || item.depth > maxDepth) continue;
		const refs = pxr.UsdUtils.ExtractSanitizedExternalReferences(item.filePath).filter((ref) => shouldFetchAssetReference(ref, searchExtensions));
		const itemSearchRoots = unique([
			...item.searchRoots,
			...inferReferencedSearchRoots(refs, configuredSearchRoots),
			...inferReferencedSearchRoots([item.sourceRelativePath], configuredSearchRoots)
		]);
		for (const ref of refs) {
			if (uniqueFileCount(files) >= maxFiles) break;
			for (const attempt of buildFetchAttempts(ref, item.sourceUrl, item.sourceRelativePath, searchExtensions, item.rootSourceUrl, itemSearchRoots)) {
				const existingPath = existingFsPath(pxr, directory, [attempt.sourceRelativePath, ...attempt.fsPaths], files);
				if (existingPath) {
					if (item.depth < maxDepth) queueUsdLayer(queue, queuedLayers, pxr, directory, existingPath, urlForSourceRelativePath(existingPath, item.rootSourceUrl), item.rootSourceUrl, itemSearchRoots, item.depth + 1);
					break;
				}
				if (fetchedUrls.has(attempt.url)) continue;
				fetchedUrls.add(attempt.url);
				const data = await fetchBinary(attempt.url);
				if (!data) continue;
				writeQueueableLayer(pxr, directory, files, attempt.sourceRelativePath, data);
				for (const fsPath of attempt.fsPaths) {
					ownedPackageAliases.delete(fsPath);
					files[fsPath] = data;
					writeQueueableLayer(pxr, directory, files, fsPath, data);
				}
				addPackageRemapAliases(files, attempt.packageRemapAliases, data, ownedPackageAliases, packageAliasConflicts);
				if (item.depth < maxDepth) queueUsdLayer(queue, queuedLayers, pxr, directory, attempt.sourceRelativePath, attempt.url, item.rootSourceUrl, itemSearchRoots, item.depth + 1);
				break;
			}
		}
	}
	return files;
}
function isMetadataAssetReference(value, searchExtensions) {
	if (/^(blob|data):/i.test(value)) return false;
	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
	if (value.startsWith("/")) return false;
	return searchExtensions.includes(extensionOf(value));
}
function collectMetadataAssetReferences(value, searchExtensions, refs = /* @__PURE__ */ new Set()) {
	if (!value) return refs;
	if (Array.isArray(value)) {
		for (const item of value) collectMetadataAssetReferences(item, searchExtensions, refs);
		return refs;
	}
	if (typeof value !== "object") return refs;
	const asset = value;
	for (const item of [asset.path, asset.url]) if (typeof item === "string" && isMetadataAssetReference(item, searchExtensions)) refs.add(item);
	for (const item of Object.values(value)) collectMetadataAssetReferences(item, searchExtensions, refs);
	return refs;
}
async function autoResolveTextureFiles(metadata, existingFiles, options) {
	const sourcePath = options.sourcePath ?? "";
	if (options.autoResolveAssets === false || !sourcePath) return {};
	const sourceUrl = toFetchableUrl(sourcePath);
	if (!sourceUrl) return {};
	const searchExtensions = options.assetSearchExtensions ?? DEFAULT_ASSET_SEARCH_EXTENSIONS;
	const configuredSearchRoots = normalizeSearchRoots(options.assetSearchRoots);
	const textureRefs = [...collectMetadataAssetReferences(metadata, searchExtensions)];
	const searchRoots = unique([...inferReferencedSearchRoots(Object.keys(existingFiles), configuredSearchRoots), ...inferReferencedSearchRoots(textureRefs, configuredSearchRoots)]);
	const maxFiles = options.maxAssetReferences ?? DEFAULT_MAX_ASSET_REFERENCES;
	const remainingFiles = Math.max(maxFiles - uniqueFileCount(existingFiles), 0);
	if (remainingFiles === 0) return {};
	const rootRelativePath = normalizeFsRelativePath(options.fileName ?? fileNameForSource(sourcePath));
	const files = {};
	const ownedPackageAliases = /* @__PURE__ */ new Set();
	const packageAliasConflicts = /* @__PURE__ */ new Set();
	const fetchedUrls = /* @__PURE__ */ new Set();
	let resolvedFiles = 0;
	for (const ref of textureRefs) {
		if (resolvedFiles >= remainingFiles) break;
		for (const attempt of buildFetchAttempts(ref, sourceUrl, rootRelativePath, searchExtensions, sourceUrl, searchRoots)) {
			if (attempt.fsPaths.some((path) => existingFiles[path] || files[path])) break;
			if (fetchedUrls.has(attempt.url)) continue;
			fetchedUrls.add(attempt.url);
			const data = await fetchBinary(attempt.url);
			if (!data) continue;
			for (const fsPath of attempt.fsPaths) {
				ownedPackageAliases.delete(fsPath);
				files[fsPath] = data;
			}
			addPackageRemapAliases(files, attempt.packageRemapAliases, data, ownedPackageAliases, packageAliasConflicts, existingFiles);
			resolvedFiles += 1;
			break;
		}
	}
	return files;
}
function createTextureResolverFromEntries(entries) {
	if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
	const imageEntries = new Map([...entries].filter(([path]) => [
		".png",
		".jpg",
		".jpeg",
		".webp"
	].includes(extensionOf(path))));
	if (imageEntries.size === 0) return null;
	const byBaseName = /* @__PURE__ */ new Map();
	for (const path of imageEntries.keys()) {
		const name = baseName(path);
		byBaseName.set(name, byBaseName.has(name) ? null : path);
	}
	const urls = /* @__PURE__ */ new Map();
	const urlForEntry = (path) => {
		const entry = imageEntries.get(path);
		if (!entry) return null;
		let url = urls.get(path);
		if (!url) {
			url = URL.createObjectURL(new Blob([toArrayBuffer(entry)], { type: contentTypeForPath(path) }));
			urls.set(path, url);
		}
		return url;
	};
	const resolvePath = (value) => {
		if (!value) return null;
		const normalized = normalizeFsRelativePath(value.split(/[?#]/)[0] ?? value);
		if (!normalized) return null;
		if (imageEntries.has(normalized)) return urlForEntry(normalized);
		const suffixMatches = [...imageEntries.keys()].filter((path) => path.endsWith(`/${normalized}`));
		if (suffixMatches.length === 1 && suffixMatches[0]) return urlForEntry(suffixMatches[0]);
		const virtualFsMatches = [...imageEntries.keys()].filter((path) => normalized.endsWith(`/${path}`));
		if (virtualFsMatches.length === 1 && virtualFsMatches[0]) return urlForEntry(virtualFsMatches[0]);
		const uniqueBaseName = byBaseName.get(baseName(normalized));
		return uniqueBaseName ? urlForEntry(uniqueBaseName) : null;
	};
	return {
		urls,
		resolve(asset) {
			return resolvePath(asset.resolvedPath) ?? resolvePath(asset.path) ?? resolvePath(asset.url) ?? null;
		}
	};
}
function extractPackageEntries(pxr, filePath, tempDirectory) {
	const entries = /* @__PURE__ */ new Map();
	for (const item of pxr.UsdUtils.GetPackageEntries(filePath, tempDirectory ?? "/tmp/openusd-wasm-package-entries", DEFAULT_MAX_ASSET_REFERENCE_DEPTH)) if (typeof item.path === "string" && item.data instanceof Uint8Array) entries.set(item.path, item.data);
	return entries;
}
function createPackageTextureResolver(pxr, filePath, tempDirectory) {
	return createTextureResolverFromEntries(extractPackageEntries(pxr, filePath, tempDirectory));
}
function findPackageRootLayer(pxr, filePath) {
	const path = pxr.UsdUtils.FindPackageRootLayer(filePath);
	return typeof path === "string" && path ? path : null;
}
//#endregion
export { autoResolveAssetFiles, autoResolveTextureFiles, createPackageTextureResolver, createTextureResolverFromEntries, extractPackageEntries, findPackageRootLayer, toLayerRelativeAssetPath };
