//#region src/bindings.ts
function flatName(moduleName, name) {
	return `PxrJs${moduleName}${name}`;
}
function attachUsing(value) {
	if (!value) return value;
	Object.defineProperty(value, "using", {
		enumerable: false,
		value(callback) {
			try {
				return callback(value);
			} finally {
				if (value && value.delete) value.delete();
			}
		}
	});
	return value;
}
function installUsing(cls) {
	if (!cls || !cls.prototype || cls.prototype.using) return cls;
	try {
		Object.defineProperty(cls.prototype, "using", {
			enumerable: false,
			value(callback) {
				try {
					return callback(this);
				} finally {
					if (this && this.delete) this.delete();
				}
			}
		});
	} catch {}
	return cls;
}
function mapClass(module, embindName) {
	const cls = module[embindName];
	if (typeof cls !== "function") throw new Error(`Missing Embind export ${embindName}`);
	return installUsing(cls);
}
function mapFunction(module, embindName) {
	const fn = module[embindName];
	if (typeof fn !== "function") throw new Error(`Missing Embind export ${embindName}`);
	return (...args) => fn(...args);
}
function mapObject(module, embindName) {
	const fn = module[embindName];
	if (typeof fn !== "function") throw new Error(`Missing Embind export ${embindName}`);
	return fn();
}
function bindClass(module, moduleName, name) {
	return mapClass(module, flatName(moduleName, name));
}
function bindFunction(module, moduleName, name) {
	return mapFunction(module, flatName(moduleName, name));
}
function bindObject(module, moduleName, name) {
	return mapObject(module, flatName(moduleName, name));
}
//#endregion
//#region src/modules/gf.ts
function buildGfNamespace(module) {
	return {
		Vec2f: bindClass(module, "Gf", "Vec2f"),
		Vec2d: bindClass(module, "Gf", "Vec2d"),
		Vec2h: bindClass(module, "Gf", "Vec2h"),
		Vec2i: bindClass(module, "Gf", "Vec2i"),
		Vec3f: bindClass(module, "Gf", "Vec3f"),
		Vec3d: bindClass(module, "Gf", "Vec3d"),
		Vec3h: bindClass(module, "Gf", "Vec3h"),
		Vec3i: bindClass(module, "Gf", "Vec3i"),
		Vec4f: bindClass(module, "Gf", "Vec4f"),
		Vec4d: bindClass(module, "Gf", "Vec4d"),
		Vec4h: bindClass(module, "Gf", "Vec4h"),
		Vec4i: bindClass(module, "Gf", "Vec4i"),
		Matrix3d: bindClass(module, "Gf", "Matrix3d"),
		Matrix4d: bindClass(module, "Gf", "Matrix4d"),
		Quatf: bindClass(module, "Gf", "Quatf"),
		Quatd: bindClass(module, "Gf", "Quatd"),
		Quath: bindClass(module, "Gf", "Quath"),
		Range1d: bindClass(module, "Gf", "Range1d"),
		Range2d: bindClass(module, "Gf", "Range2d"),
		Range3d: bindClass(module, "Gf", "Range3d"),
		Range3f: bindClass(module, "Gf", "Range3f"),
		BBox3d: bindClass(module, "Gf", "BBox3d")
	};
}
//#endregion
//#region src/modules/sdf.ts
function buildSdfNamespace(module) {
	return {
		Path: bindClass(module, "Sdf", "Path"),
		AssetPath: bindClass(module, "Sdf", "AssetPath"),
		Layer: bindClass(module, "Sdf", "Layer"),
		PrimSpec: bindClass(module, "Sdf", "PrimSpec"),
		ValueTypeName: bindClass(module, "Sdf", "ValueTypeName"),
		ValueTypeNames: bindObject(module, "Sdf", "ValueTypeNames"),
		ZipFile: bindClass(module, "Sdf", "ZipFile"),
		ZipFileInfo: bindClass(module, "Sdf", "ZipFileInfo"),
		ZipFileWriter: bindClass(module, "Sdf", "ZipFileWriter")
	};
}
//#endregion
//#region src/modules/usd.ts
function buildUsdNamespace(module) {
	return {
		Stage: bindClass(module, "Usd", "Stage"),
		Prim: bindClass(module, "Usd", "Prim"),
		VariantSets: bindClass(module, "Usd", "VariantSets"),
		VariantSet: bindClass(module, "Usd", "VariantSet"),
		Attribute: bindClass(module, "Usd", "Attribute"),
		Relationship: bindClass(module, "Usd", "Relationship"),
		References: bindClass(module, "Usd", "References"),
		Payloads: bindClass(module, "Usd", "Payloads"),
		TimeCode: bindClass(module, "Usd", "TimeCode")
	};
}
//#endregion
//#region src/modules/usdGeom.ts
function buildUsdGeomNamespace(module) {
	return {
		Xform: bindClass(module, "UsdGeom", "Xform"),
		Sphere: bindClass(module, "UsdGeom", "Sphere"),
		Cube: bindClass(module, "UsdGeom", "Cube"),
		Cylinder: bindClass(module, "UsdGeom", "Cylinder"),
		Camera: bindClass(module, "UsdGeom", "Camera"),
		Mesh: bindClass(module, "UsdGeom", "Mesh"),
		Xformable: bindClass(module, "UsdGeom", "Xformable"),
		XformOp: bindClass(module, "UsdGeom", "XformOp"),
		Primvar: bindClass(module, "UsdGeom", "Primvar"),
		PrimvarsAPI: bindClass(module, "UsdGeom", "PrimvarsAPI"),
		BBoxCache: bindClass(module, "UsdGeom", "BBoxCache"),
		SetStageMetersPerUnit: bindFunction(module, "UsdGeom", "SetStageMetersPerUnit"),
		SetStageUpAxis: bindFunction(module, "UsdGeom", "SetStageUpAxis"),
		GetStageUpAxis: bindFunction(module, "UsdGeom", "GetStageUpAxis"),
		ComputeXformAnimationInfo: bindFunction(module, "UsdGeom", "ComputeXformAnimationInfo"),
		Tokens: bindObject(module, "UsdGeom", "Tokens")
	};
}
//#endregion
//#region src/modules/usdPhysics.ts
function buildUsdPhysicsNamespace(module) {
	return {
		CollisionAPI: bindClass(module, "UsdPhysics", "CollisionAPI"),
		MeshCollisionAPI: bindClass(module, "UsdPhysics", "MeshCollisionAPI"),
		RigidBodyAPI: bindClass(module, "UsdPhysics", "RigidBodyAPI"),
		MassAPI: bindClass(module, "UsdPhysics", "MassAPI"),
		MaterialAPI: bindClass(module, "UsdPhysics", "MaterialAPI"),
		Scene: bindClass(module, "UsdPhysics", "Scene"),
		ArticulationRootAPI: bindClass(module, "UsdPhysics", "ArticulationRootAPI"),
		Joint: bindClass(module, "UsdPhysics", "Joint"),
		FixedJoint: bindClass(module, "UsdPhysics", "FixedJoint"),
		RevoluteJoint: bindClass(module, "UsdPhysics", "RevoluteJoint"),
		PrismaticJoint: bindClass(module, "UsdPhysics", "PrismaticJoint"),
		SphericalJoint: bindClass(module, "UsdPhysics", "SphericalJoint"),
		DistanceJoint: bindClass(module, "UsdPhysics", "DistanceJoint"),
		LimitAPI: bindClass(module, "UsdPhysics", "LimitAPI"),
		DriveAPI: bindClass(module, "UsdPhysics", "DriveAPI"),
		ComputeModelJoints: bindFunction(module, "UsdPhysics", "ComputeModelJoints"),
		ComputeModelPhysics: bindFunction(module, "UsdPhysics", "ComputeModelPhysics")
	};
}
//#endregion
//#region src/modules/usdSkel.ts
function buildUsdSkelNamespace(module) {
	return {
		Root: bindClass(module, "UsdSkel", "Root"),
		Skeleton: bindClass(module, "UsdSkel", "Skeleton"),
		SkeletonQuery: bindClass(module, "UsdSkel", "SkeletonQuery"),
		SkinningQuery: bindClass(module, "UsdSkel", "SkinningQuery"),
		Cache: bindClass(module, "UsdSkel", "Cache"),
		Animation: bindClass(module, "UsdSkel", "Animation"),
		BindingAPI: bindClass(module, "UsdSkel", "BindingAPI"),
		ComputeModelSkels: bindFunction(module, "UsdSkel", "ComputeModelSkels"),
		Tokens: bindObject(module, "UsdSkel", "Tokens")
	};
}
//#endregion
//#region src/modules/usdShade.ts
function buildUsdShadeNamespace(module) {
	return {
		Material: bindClass(module, "UsdShade", "Material"),
		Shader: bindClass(module, "UsdShade", "Shader"),
		Input: bindClass(module, "UsdShade", "Input"),
		Output: bindClass(module, "UsdShade", "Output"),
		ConnectableAPI: bindClass(module, "UsdShade", "ConnectableAPI"),
		MaterialBindingAPI: bindClass(module, "UsdShade", "MaterialBindingAPI"),
		ComputeBoundMaterialPath: bindFunction(module, "UsdShade", "ComputeBoundMaterialPath"),
		ComputeMaterialInfo: bindFunction(module, "UsdShade", "ComputeMaterialInfo"),
		ComputeMaterialTextureInfo: bindFunction(module, "UsdShade", "ComputeMaterialTextureInfo"),
		ComputeGeomSubsetMaterialFallback: bindFunction(module, "UsdShade", "ComputeGeomSubsetMaterialFallback"),
		Tokens: bindObject(module, "UsdShade", "Tokens")
	};
}
//#endregion
//#region src/modules/usdUtils.ts
function buildUsdUtilsNamespace(module) {
	return {
		ExtractExternalReferencesParams: bindClass(module, "UsdUtils", "ExtractExternalReferencesParams"),
		ExtractExternalReferences: bindFunction(module, "UsdUtils", "ExtractExternalReferences"),
		ExtractSanitizedExternalReferences: bindFunction(module, "UsdUtils", "ExtractSanitizedExternalReferences"),
		ComputeAllDependencies: bindFunction(module, "UsdUtils", "ComputeAllDependencies"),
		ExtractUsdzPackage: bindFunction(module, "UsdUtils", "ExtractUsdzPackage"),
		GetPackageEntries: bindFunction(module, "UsdUtils", "GetPackageEntries"),
		FindPackageRootLayer: bindFunction(module, "UsdUtils", "FindPackageRootLayer"),
		CreateNewUsdzPackage: bindFunction(module, "UsdUtils", "CreateNewUsdzPackage"),
		CreateNewARKitUsdzPackage: bindFunction(module, "UsdUtils", "CreateNewARKitUsdzPackage"),
		LocalizeAsset: bindFunction(module, "UsdUtils", "LocalizeAsset"),
		ModifyAssetPaths: bindFunction(module, "UsdUtils", "ModifyAssetPaths")
	};
}
//#endregion
//#region src/modules/index.ts
function buildPxrModules(module) {
	return {
		Gf: buildGfNamespace(module),
		Sdf: buildSdfNamespace(module),
		Usd: buildUsdNamespace(module),
		UsdGeom: buildUsdGeomNamespace(module),
		UsdPhysics: buildUsdPhysicsNamespace(module),
		UsdSkel: buildUsdSkelNamespace(module),
		UsdShade: buildUsdShadeNamespace(module),
		UsdUtils: buildUsdUtilsNamespace(module)
	};
}
//#endregion
//#region src/modules/sdfConvenience.ts
function installGetter(cls, name, getter) {
	if (!cls?.prototype) return;
	if (Object.getOwnPropertyDescriptor(cls.prototype, name)) return;
	try {
		Object.defineProperty(cls.prototype, name, {
			enumerable: false,
			get() {
				return getter(this);
			}
		});
	} catch {}
}
function installAccessor(cls, name, getter, setter) {
	if (!cls?.prototype) return;
	if (Object.getOwnPropertyDescriptor(cls.prototype, name)) return;
	try {
		Object.defineProperty(cls.prototype, name, {
			enumerable: false,
			get() {
				return getter(this);
			},
			set(next) {
				setter(this, next);
			}
		});
	} catch {}
}
function installSdfConvenienceAccessors(pxr) {
	installGetter(pxr.Sdf.AssetPath, "path", (value) => value.GetAssetPath());
	installGetter(pxr.Sdf.AssetPath, "resolvedPath", (value) => value.GetResolvedPath());
	installAccessor(pxr.Sdf.Layer, "subLayerPaths", (value) => value.GetSubLayerPaths(), (value, next) => value.SetSubLayerPaths(next));
}
//#endregion
//#region src/index.ts
function mkdirp(FS, path) {
	const parts = path.split("/").filter(Boolean);
	let current = path.startsWith("/") ? "/" : "";
	for (const part of parts) {
		current = current === "/" ? `/${part}` : `${current}/${part}`;
		try {
			FS.mkdir(current);
		} catch (err) {
			try {
				if (FS.isDir(FS.stat(current).mode)) continue;
			} catch {}
			throw err;
		}
	}
}
function parentPath(path) {
	const parts = path.split("/");
	parts.pop();
	const parent = parts.join("/");
	if (parent) return parent;
	return path.startsWith("/") ? "/" : ".";
}
function joinFsPath(base, name) {
	if (base === "/") return `/${name}`;
	return `${base.replace(/\/+$/, "")}/${name}`;
}
function ensureParent(FS, path) {
	const parent = parentPath(path);
	if (parent !== ".") mkdirp(FS, parent);
}
function isNodeLike() {
	const processLike = globalThis.process;
	return !!processLike?.versions?.node && processLike.type !== "renderer";
}
function isBlobLike(value) {
	return typeof Blob !== "undefined" && value instanceof Blob;
}
function getBrowserBaseHref() {
	const location = globalThis.location;
	return typeof location?.href === "string" ? location.href : void 0;
}
function normalizeBrowserFileAssetUrl(value) {
	const baseHref = getBrowserBaseHref();
	if (!baseHref) return value;
	try {
		const url = new URL(value, baseHref);
		if (url.protocol !== "file:" || !url.pathname.startsWith("/_next/")) return value;
		return new URL(`${url.pathname}${url.search}${url.hash}`, baseHref).href;
	} catch {
		return value;
	}
}
function assertThreadedBrowserRuntime() {
	if (!getBrowserBaseHref()) return;
	const runtime = globalThis;
	if (typeof SharedArrayBuffer !== "undefined" && runtime.crossOriginIsolated === true) return;
	throw new Error("openusd_pxr_wasm uses WebAssembly pthreads and requires a cross-origin isolated browser context. Configure your app to send Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp before calling createPxr().");
}
function toUrlString(value, baseUrl = import.meta.url) {
	if (value === void 0 || value === null) return void 0;
	if (isBlobLike(value)) return URL.createObjectURL(value);
	if (value instanceof URL) return normalizeBrowserFileAssetUrl(value.href);
	if (typeof value !== "string") return value;
	try {
		return normalizeBrowserFileAssetUrl(new URL(value, baseUrl).href);
	} catch {
		return normalizeBrowserFileAssetUrl(value);
	}
}
function requireUrlString(value, name) {
	if (value === void 0 || value === null) throw new TypeError(`${name} is required`);
	const url = toUrlString(value);
	if (typeof url !== "string") throw new TypeError(`${name} must resolve to a string URL`);
	return url;
}
function fileUrlToPathString(value) {
	const url = value instanceof URL ? value : new URL(value);
	if (url.protocol !== "file:") return value instanceof URL ? url.href : value;
	return decodeURIComponent(url.pathname);
}
function toWorkerScript(value) {
	if (value === void 0 || value === null || isBlobLike(value)) return value;
	if (isNodeLike()) {
		if (value instanceof URL) return fileUrlToPathString(value);
		if (typeof value === "string" && value.startsWith("file:")) return fileUrlToPathString(value);
		return value;
	}
	return toUrlString(value);
}
function buildLocateFile({ wasmURL, workerURL, locateFile }) {
	const resolvedWasmURL = requireUrlString(wasmURL, "wasmURL");
	const resolvedWorkerURL = workerURL === void 0 ? void 0 : requireUrlString(workerURL, "workerURL");
	return (path, prefix) => {
		if (path.endsWith(".wasm")) return resolvedWasmURL;
		if (resolvedWorkerURL && (path.endsWith(".worker.js") || path.endsWith(".worker.mjs"))) return String(resolvedWorkerURL);
		if (locateFile) return locateFile(path, prefix);
		return `${prefix || ""}${path}`;
	};
}
function requireFs(module) {
	if (!module.FS) throw new Error("openusd_pxr_wasm was built without FS export");
	return module.FS;
}
function normalizeMountArgs(mountOrType, options = {}, mountPoint) {
	if (typeof mountOrType === "string") return {
		type: mountOrType,
		...options || {},
		mountPoint
	};
	return mountOrType || {};
}
function mountFilesystem(module, mountOrType, options, mountPointArg) {
	const FS = requireFs(module);
	const mount = normalizeMountArgs(mountOrType, options, mountPointArg);
	const type = typeof mount.type === "string" ? mount.type : "MEMFS";
	const mountPoint = typeof mount.mountPoint === "string" ? mount.mountPoint : typeof mount.path === "string" ? mount.path : void 0;
	if (!mountPoint) throw new Error("mountPoint is required");
	mkdirp(FS, mountPoint);
	if (type === "MEMFS") return;
	const fsType = FS.filesystems?.[type];
	if (!fsType) throw new Error(`${type} is not available in this Wasm build`);
	const opts = { ...mount };
	delete opts.type;
	delete opts.mountPoint;
	delete opts.path;
	FS.mount(fsType, opts, mountPoint);
}
function installFiles(module, files) {
	if (!files) return;
	const FS = requireFs(module);
	for (const [path, data] of Object.entries(files)) {
		ensureParent(FS, path);
		FS.writeFile(path, data);
	}
}
function normalizeCallbacks(callbacks) {
	if (!callbacks) return [];
	return Array.isArray(callbacks) ? callbacks : [callbacks];
}
function withDefaultOpenUsdEnv(env) {
	return {
		TMPDIR: "/tmp",
		TEMP: "/tmp",
		TMP: "/tmp",
		...env && typeof env === "object" ? env : {}
	};
}
function readFile(FS, path, encodingOrOpts) {
	if (typeof encodingOrOpts === "string") {
		if (encodingOrOpts === "utf8" || encodingOrOpts === "utf-8") return FS.readFile(path, { encoding: "utf8" });
		return FS.readFile(path);
	}
	return FS.readFile(path, encodingOrOpts);
}
function listDir(FS, path) {
	return FS.readdir(path).filter((name) => name !== "." && name !== "..").map((name) => {
		const childPath = joinFsPath(path, name);
		const stat = FS.stat(childPath);
		return {
			name,
			path: childPath,
			mode: stat.mode,
			size: stat.size,
			isDir: FS.isDir(stat.mode),
			isFile: FS.isFile(stat.mode)
		};
	});
}
function defaultNodeRoot() {
	if (!globalThis.process?.cwd) throw new Error("A NODEFS root is required outside Node.js");
	return globalThis.process.cwd();
}
function buildFsHelpers(module) {
	const FS = requireFs(module);
	const rename = (oldPath, newPath) => {
		ensureParent(FS, newPath);
		FS.rename(oldPath, newPath);
	};
	return {
		raw: FS,
		mkdirp: (path) => mkdirp(FS, path),
		createDir: (path) => mkdirp(FS, path),
		deleteDir: (path) => FS.rmdir(path),
		listDir: (path) => listDir(FS, path),
		mount: (mountOrType, options, mountPoint) => mountFilesystem(module, mountOrType, options, mountPoint),
		unmount: (mountPoint) => FS.unmount(mountPoint),
		mountNodeFS: (mountPoint, root = defaultNodeRoot()) => mountFilesystem(module, {
			type: "NODEFS",
			mountPoint,
			root
		}),
		mountWorkerFS: (mountPoint, options = {}) => mountFilesystem(module, {
			type: "WORKERFS",
			mountPoint,
			...options
		}),
		mountIDBFS: (mountPoint, options = {}) => mountFilesystem(module, {
			type: "IDBFS",
			mountPoint,
			...options
		}),
		writeFile: (path, data) => {
			ensureParent(FS, path);
			FS.writeFile(path, data);
		},
		readFile: (path, encodingOrOpts) => readFile(FS, path, encodingOrOpts),
		exists: (path) => {
			try {
				FS.stat(path);
				return true;
			} catch {
				return false;
			}
		},
		deleteFile: (path) => FS.unlink(path),
		unlink: (path) => FS.unlink(path),
		rename,
		renameFile: rename,
		syncfs: (populate = false) => new Promise((resolve, reject) => {
			FS.syncfs(populate, (err) => err ? reject(err) : resolve());
		})
	};
}
function buildPxr(module) {
	const pxr = {
		_module: module,
		FS: buildFsHelpers(module),
		using: attachUsing,
		...buildPxrModules(module)
	};
	installSdfConvenienceAccessors(pxr);
	return pxr;
}
function initializeOpenUsdRuntime(module) {
	if (typeof module.PxrJsInitializeOpenUsdRuntime !== "function") throw new Error("openusd_pxr_wasm was built without OpenUSD runtime initialization support");
	module.PxrJsInitializeOpenUsdRuntime();
}
async function createPxr(coreAssets, options = {}) {
	if (!coreAssets || typeof coreAssets !== "object") throw new TypeError("createPxr requires @openusd-wasm/core assets");
	if (typeof coreAssets.core !== "function") throw new TypeError("createPxr requires core.core to be a Wasm factory");
	assertThreadedBrowserRuntime();
	const { mainScriptUrlOrBlob, mounts = [], files, preRun, locateFile, ...wasmOptions } = options;
	const workerURL = coreAssets.workerURL ?? coreAssets.coreURL;
	wasmOptions.locateFile = buildLocateFile({
		wasmURL: coreAssets.wasmURL,
		workerURL,
		locateFile
	});
	wasmOptions.ENV = withDefaultOpenUsdEnv(wasmOptions.ENV);
	wasmOptions.preRun = [...normalizeCallbacks(preRun), (module) => {
		for (const mount of mounts) mountFilesystem(module, mount);
		installFiles(module, files);
	}];
	if (mainScriptUrlOrBlob !== void 0) wasmOptions.mainScriptUrlOrBlob = toWorkerScript(mainScriptUrlOrBlob);
	else if (workerURL !== void 0) wasmOptions.mainScriptUrlOrBlob = toWorkerScript(workerURL);
	const module = await coreAssets.core(wasmOptions);
	initializeOpenUsdRuntime(module);
	return buildPxr(module);
}
//#endregion
export { createPxr, createPxr as default };
