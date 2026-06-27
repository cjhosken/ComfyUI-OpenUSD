import { createPxr } from "../pxr/openusd_pxr.js";
import * as THREE from "https://esm.sh/three";
import { FileLoader, Loader } from "https://esm.sh/three";
import { autoResolveAssetFiles, autoResolveTextureFiles, createTextureResolverFromEntries, extractPackageEntries, findPackageRootLayer } from "../utils/openusd_utils.js";
//#region src/scene-data/common.ts
function dispose$1(value) {
	if (value && typeof value === "object" && "delete" in value && typeof value.delete === "function") value.delete();
}
function disposeAll(values) {
	for (let i = values.length - 1; i >= 0; --i) dispose$1(values[i]);
}
function pathToString(path) {
	if (path && typeof path === "object") {
		const maybePath = path;
		if (typeof maybePath.GetString === "function") return String(maybePath.GetString());
	}
	return String(path);
}
function isValid$1(value) {
	if (!value) return false;
	if (typeof value.IsValid === "function") return Boolean(value.IsValid());
	if (typeof value.IsDefined === "function") return Boolean(value.IsDefined());
	return true;
}
function asFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function normalizeValue(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
	if (value && typeof value === "object") {
		const out = {};
		for (const [key, item] of Object.entries(value)) out[key] = normalizeValue(item);
		return out;
	}
	return value;
}
function toArray(value) {
	return Array.isArray(value) ? value : [];
}
function toNumberArray(value) {
	return toArray(value).map((item) => Number(item)).filter((item) => Number.isFinite(item));
}
function attr(prim, name, time, defaultValue = null) {
	const attribute = prim.GetAttribute(name);
	try {
		return attributeValue(attribute, time, defaultValue);
	} finally {
		dispose$1(attribute);
	}
}
function attributeValue(attribute, time, defaultValue = null, authoredOnly = false) {
	if (!isValid$1(attribute)) return defaultValue;
	if (authoredOnly && typeof attribute.HasAuthoredValue === "function" && !attribute.HasAuthoredValue()) return defaultValue;
	const value = attribute.Get(time);
	return value === null || value === void 0 ? defaultValue : normalizeValue(value);
}
function schemaAttributeValue(schema, methodName, time, defaultValue = null, authoredOnly = false) {
	const attribute = schema[methodName]();
	try {
		return attributeValue(attribute, time, defaultValue, authoredOnly);
	} finally {
		dispose$1(attribute);
	}
}
//#endregion
//#region src/scene-data/animations.ts
function skelAnimationFrameRange(animation, stageInfo) {
	const sampleTimes = [
		...animation.translations.map((sample) => sample.time),
		...animation.rotations.map((sample) => sample.time),
		...animation.scales.map((sample) => sample.time)
	];
	if (sampleTimes.length === 0) return null;
	if (stageInfo.endTimeCode > stageInfo.startTimeCode) return {
		start: stageInfo.startTimeCode,
		end: stageInfo.endTimeCode
	};
	const secondsStart = Math.min(...sampleTimes);
	const secondsEnd = Math.max(...sampleTimes);
	return {
		start: stageInfo.startTimeCode + secondsStart * stageInfo.timeCodesPerSecond,
		end: stageInfo.startTimeCode + secondsEnd * stageInfo.timeCodesPerSecond
	};
}
function getModelAnimations(pxr, prims, stageInfo, skels) {
	const timeCodesPerSecond = stageInfo.timeCodesPerSecond;
	const skelAnimationTracks = [];
	const xformInfo = pxr.UsdGeom.ComputeXformAnimationInfo(prims, stageInfo.startTimeCode, stageInfo.endTimeCode, timeCodesPerSecond);
	let start = xformInfo.startTimeCode;
	let end = xformInfo.endTimeCode;
	const animationsByPath = new Map(skels.animations.map((animation) => [animation.path, animation]));
	for (const skeleton of skels.skeletons) {
		const bindingAnimationSource = skels.bindings.find((binding) => binding.skeletonPath === skeleton.path)?.animationSource;
		const animation = bindingAnimationSource ? animationsByPath.get(bindingAnimationSource) : skels.animations[0];
		if (!animation) continue;
		const range = skelAnimationFrameRange(animation, stageInfo);
		if (!range || range.end <= range.start) continue;
		skelAnimationTracks.push({
			skeletonPath: skeleton.path,
			animationPath: animation.path,
			samplesStartTimeCode: range.start,
			samplesEndTimeCode: range.end
		});
		if (end <= start) {
			start = range.start;
			end = range.end;
		} else {
			start = Math.min(start, range.start);
			end = Math.max(end, range.end);
		}
	}
	if (end <= start) return [];
	const transforms = xformInfo.transforms ?? [];
	if (transforms.length === 0 && skelAnimationTracks.length === 0) return [];
	const firstSkelAnimation = skelAnimationTracks[0] ? animationsByPath.get(skelAnimationTracks[0].animationPath) : null;
	return [{
		id: firstSkelAnimation ? `skel:${firstSkelAnimation.path}` : "stage:default",
		name: firstSkelAnimation?.name ?? "Stage Animation",
		source: firstSkelAnimation ? "skel" : "stage",
		variant: null,
		startTimeCode: start,
		endTimeCode: end,
		timeCodesPerSecond,
		transforms,
		skelAnimations: skelAnimationTracks
	}];
}
//#endregion
//#region src/scene-data/view.ts
function localTransformForPrim(pxr, prim, time) {
	if (!prim.IsA("Xformable")) return {
		localMatrix: null,
		resetsXformStack: false
	};
	const xformable = new pxr.UsdGeom.Xformable(prim);
	try {
		if (!isValid$1(xformable)) return {
			localMatrix: null,
			resetsXformStack: false
		};
		const transform = xformable.GetLocalTransformation(time);
		return {
			localMatrix: toNumberArray(transform?.matrix),
			resetsXformStack: Boolean(transform?.resetsXformStack)
		};
	} finally {
		dispose$1(xformable);
	}
}
function parentPathForPrim(prim) {
	const parent = prim.GetParent();
	try {
		if (!isValid$1(parent) || parent.IsPseudoRoot()) return null;
		return String(parent.GetPath());
	} finally {
		dispose$1(parent);
	}
}
function getModelView(pxr, prims, time) {
	return { prims: prims.map((prim) => {
		const transform = localTransformForPrim(pxr, prim, time);
		return {
			path: String(prim.GetPath()),
			parentPath: parentPathForPrim(prim),
			name: String(prim.GetName()),
			typeName: String(prim.GetTypeName()),
			visibility: String(attr(prim, "visibility", time, "inherited")),
			...transform
		};
	}) };
}
//#endregion
//#region src/scene-data/cameras.ts
function toClippingRange(value) {
	const numbers = toNumberArray(value);
	if (numbers.length < 2) return null;
	const near = numbers[0];
	const far = numbers[1];
	return Number.isFinite(near) && Number.isFinite(far) ? [near, far] : null;
}
function getModelCameras(pxr, prims, time) {
	const cameras = [];
	for (const prim of prims) {
		if (prim.GetTypeName() !== "Camera") continue;
		const camera = new pxr.UsdGeom.Camera(prim);
		try {
			if (!isValid$1(camera)) continue;
			const projection = String(schemaAttributeValue(camera, "GetProjectionAttr", time, "perspective") || "perspective");
			cameras.push({
				path: String(prim.GetPath()),
				name: String(prim.GetName()),
				projection: projection === "orthographic" ? "orthographic" : "perspective",
				horizontalAperture: asFiniteNumber(schemaAttributeValue(camera, "GetHorizontalApertureAttr", time, null)),
				verticalAperture: asFiniteNumber(schemaAttributeValue(camera, "GetVerticalApertureAttr", time, null)),
				focalLength: asFiniteNumber(schemaAttributeValue(camera, "GetFocalLengthAttr", time, null)),
				clippingRange: toClippingRange(schemaAttributeValue(camera, "GetClippingRangeAttr", time, null)),
				localMatrix: localTransformForPrim(pxr, prim, time).localMatrix
			});
		} finally {
			dispose$1(camera);
		}
	}
	return cameras;
}
//#endregion
//#region src/scene-data/material-binding.ts
function materialBinding(pxr, prim) {
	const nativeBinding = pxr.UsdShade.ComputeBoundMaterialPath(prim);
	if (!nativeBinding) return null;
	const resolvedTargetPath = typeof nativeBinding.resolvedTargetPath === "string" ? nativeBinding.resolvedTargetPath : "";
	const materialPath = typeof nativeBinding.materialPath === "string" ? nativeBinding.materialPath : "";
	return resolvedTargetPath || materialPath || null;
}
//#endregion
//#region src/scene-data/materials.ts
function asMaterialTextureInfo(value) {
	const info = value;
	return {
		uvPrimvar: typeof info?.uvPrimvar === "string" && info.uvPrimvar ? info.uvPrimvar : "primvars:st",
		uvTransform: info?.uvTransform && typeof info.uvTransform === "object" ? info.uvTransform : null
	};
}
function textureInfoForMaterial(pxr, stage, materialPath, time) {
	if (!materialPath) return {
		uvPrimvar: "primvars:st",
		uvTransform: null
	};
	const path = new pxr.Sdf.Path(materialPath);
	const materialPrim = stage.GetPrimAtPath(path);
	try {
		return asMaterialTextureInfo(pxr.UsdShade.ComputeMaterialTextureInfo(materialPrim, time));
	} finally {
		dispose$1(materialPrim);
		dispose$1(path);
	}
}
function cachedTextureInfoForMaterial(pxr, stage, materialPath, time, cache) {
	const key = materialPath ?? "";
	const cached = cache.get(key);
	if (cached) return cached;
	const value = textureInfoForMaterial(pxr, stage, materialPath, time);
	cache.set(key, value);
	return value;
}
function getModelMaterials(pxr, prims, time) {
	const materials = [];
	for (const prim of prims) {
		if (prim.GetTypeName() !== "Material") continue;
		const material = pxr.UsdShade.ComputeMaterialInfo(prim, time);
		materials.push({
			path: material.path,
			inputs: material.inputs,
			shaders: material.shaders
		});
	}
	return materials;
}
//#endregion
//#region src/scene-data/mesh.ts
function triangulateMesh(pxr, stage, prim, time, boundMaterial, materialTextureCache) {
	const textureInfo = cachedTextureInfoForMaterial(pxr, stage, boundMaterial, time, materialTextureCache);
	const mesh = new pxr.UsdGeom.Mesh(prim);
	try {
		return mesh.ComputeTriangulatedGeometry(time, textureInfo.uvPrimvar, textureInfo.uvTransform);
	} finally {
		dispose$1(mesh);
	}
}
function triangulateSphere(pxr, prim, time) {
	const sphere = new pxr.UsdGeom.Sphere(prim);
	try {
		return sphere.ComputeTriangulatedGeometry(time);
	} finally {
		dispose$1(sphere);
	}
}
function triangulateCylinder(pxr, prim, time) {
	const cylinder = new pxr.UsdGeom.Cylinder(prim);
	try {
		return cylinder.ComputeTriangulatedGeometry(time);
	} finally {
		dispose$1(cylinder);
	}
}
function geomSubsetMaterialFallback(pxr, prim) {
	const material = pxr.UsdShade.ComputeGeomSubsetMaterialFallback(prim);
	return typeof material === "string" && material ? material : null;
}
function getModelElements(pxr, stage, prims, time) {
	const elements = [];
	const materialTextureCache = /* @__PURE__ */ new Map();
	for (const prim of prims) {
		const typeName = String(prim.GetTypeName());
		if (typeName !== "Mesh" && typeName !== "Sphere" && typeName !== "Cylinder") continue;
		const material = materialBinding(pxr, prim) ?? geomSubsetMaterialFallback(pxr, prim);
		elements.push({
			path: String(prim.GetPath()),
			doubleSided: Boolean(attr(prim, "doubleSided", time, false)),
			material,
			geometry: typeName === "Sphere" ? triangulateSphere(pxr, prim, time) : typeName === "Cylinder" ? triangulateCylinder(pxr, prim, time) : triangulateMesh(pxr, stage, prim, time, material, materialTextureCache)
		});
	}
	return elements;
}
//#endregion
//#region src/scene-data/joints.ts
function getModelJoints(pxr, prims, time) {
	return pxr.UsdPhysics.ComputeModelJoints(prims, time);
}
//#endregion
//#region src/scene-data/physics.ts
function getModelPhysics(pxr, prims, time, joints) {
	return pxr.UsdPhysics.ComputeModelPhysics(prims, time, joints);
}
//#endregion
//#region src/scene-data/skel.ts
function getModelSkels(pxr, prims, time, stageInfo) {
	return pxr.UsdSkel.ComputeModelSkels(prims, time, stageInfo.startTimeCode, stageInfo.endTimeCode, stageInfo.timeCodesPerSecond || 24);
}
//#endregion
//#region src/scene-data/stage.ts
function getStageInfo(pxr, stage, options) {
	const defaultPrim = stage.GetDefaultPrim();
	try {
		return {
			sourcePath: options.sourcePath,
			rootLayerIdentifier: options.rootLayerIdentifier,
			defaultPrim: isValid$1(defaultPrim) ? String(defaultPrim.GetPath()) : null,
			upAxis: String(pxr.UsdGeom.GetStageUpAxis(stage)),
			startTimeCode: stage.GetStartTimeCode(),
			endTimeCode: stage.GetEndTimeCode(),
			timeCodesPerSecond: stage.GetTimeCodesPerSecond()
		};
	} finally {
		dispose$1(defaultPrim);
	}
}
//#endregion
//#region src/scene-data/variants.ts
function requireVariantSets(prim) {
	if (typeof prim.GetVariantSets !== "function") throw new Error("USD wasm runtime is missing Usd.Prim.GetVariantSets; rebuild @openusd-wasm/core");
	return prim.GetVariantSets();
}
function applyVariantSelections(pxr, stage, selections = []) {
	if (selections.length === 0) return;
	for (const selection of selections) {
		const path = new pxr.Sdf.Path(selection.primPath);
		const prim = stage.GetPrimAtPath(path);
		let variantSets = null;
		let variantSet = null;
		try {
			if (!isValid$1(prim)) continue;
			variantSets = requireVariantSets(prim);
			variantSet = variantSets.GetVariantSet(selection.setName);
			if (!isValid$1(variantSet)) continue;
			if (selection.selection) variantSet.SetVariantSelection(selection.selection);
			else variantSet.ClearVariantSelection();
		} finally {
			dispose$1(variantSet);
			dispose$1(variantSets);
			dispose$1(prim);
			dispose$1(path);
		}
	}
}
function setVariantSelection(pxr, stage, selection) {
	applyVariantSelections(pxr, stage, [selection]);
}
function getModelVariants(stage) {
	const stagePrims = typeof stage.Traverse === "function" ? stage.Traverse() : [];
	const variants = [];
	try {
		for (const prim of stagePrims) {
			const variantSets = requireVariantSets(prim);
			try {
				const setNames = variantSets.GetNames();
				if (!Array.isArray(setNames)) continue;
				for (const setName of setNames) {
					const variantSet = variantSets.GetVariantSet(String(setName));
					try {
						if (!isValid$1(variantSet)) continue;
						const variantNames = variantSet.GetVariantNames();
						variants.push({
							primPath: pathToString(prim.GetPath()),
							primName: String(prim.GetName?.() ?? ""),
							setName: String(setName),
							variantNames: Array.isArray(variantNames) ? variantNames.map(String) : [],
							selection: String(variantSet.GetVariantSelection?.() ?? "") || null
						});
					} finally {
						dispose$1(variantSet);
					}
				}
			} finally {
				dispose$1(variantSets);
			}
		}
	} finally {
		disposeAll(stagePrims);
	}
	return variants.sort((a, b) => a.setName.localeCompare(b.setName) || a.primPath.localeCompare(b.primPath));
}
//#endregion
//#region src/scene-data.ts
function traverseRenderablePrims(stage) {
	if (typeof stage.TraverseInstanceProxies !== "function") throw new Error("USD wasm runtime is missing Usd.Stage.TraverseInstanceProxies; rebuild @openusd-wasm/core");
	return stage.TraverseInstanceProxies();
}
function extractUSDSceneData(pxr, stage, options = {}) {
	const resolvedOptions = {
		sourcePath: options.sourcePath ?? "",
		rootLayerIdentifier: options.rootLayerIdentifier ?? ""
	};
	const time = pxr.Usd.TimeCode.Default();
	const prims = traverseRenderablePrims(stage);
	try {
		const stageInfo = getStageInfo(pxr, stage, resolvedOptions);
		const skels = getModelSkels(pxr, prims, time, stageInfo);
		const joints = getModelJoints(pxr, prims, time);
		return {
			stage: stageInfo,
			view: getModelView(pxr, prims, time),
			elements: getModelElements(pxr, stage, prims, time),
			materials: getModelMaterials(pxr, prims, time),
			physics: getModelPhysics(pxr, prims, time, joints),
			joints,
			cameras: getModelCameras(pxr, prims, time),
			skels,
			animations: getModelAnimations(pxr, prims, stageInfo, skels),
			variants: getModelVariants(stage)
		};
	} finally {
		disposeAll(prims);
		dispose$1(time);
	}
}
//#endregion
//#region src/three/matrix.ts
function matrixFromUsd(values) {
	const matrix = new THREE.Matrix4();
	matrix.set(values[0] ?? 1, values[4] ?? 0, values[8] ?? 0, values[12] ?? 0, values[1] ?? 0, values[5] ?? 1, values[9] ?? 0, values[13] ?? 0, values[2] ?? 0, values[6] ?? 0, values[10] ?? 1, values[14] ?? 0, values[3] ?? 0, values[7] ?? 0, values[11] ?? 0, values[15] ?? 1);
	return matrix;
}
function applyLocalMatrix(object, values) {
	if (!values || values.length < 16) return;
	matrixFromUsd(values).decompose(object.position, object.quaternion, object.scale);
}
//#endregion
//#region src/three/geometry.ts
function findJointIndex(joints, name) {
	const exact = joints.indexOf(name);
	if (exact >= 0) return exact;
	return joints.findIndex((joint) => joint.split("/").pop() === name);
}
function skinAttributesForElement(element, binding, skeleton) {
	if (!binding || !skeleton) return null;
	const vertexCount = Math.floor(element.geometry.positions.length / 3);
	if (vertexCount <= 0) return null;
	const pointIndices = element.geometry.pointIndices;
	const elementSize = Math.max(1, binding.elementSize || 1);
	const skinIndices = [];
	const skinWeights = [];
	for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
		const base = Number(pointIndices?.[vertexIndex] ?? vertexIndex) * elementSize;
		const influences = [];
		for (let influenceIndex = 0; influenceIndex < elementSize; ++influenceIndex) {
			const weight = Number(binding.jointWeights[base + influenceIndex] ?? 0);
			if (!Number.isFinite(weight) || weight <= 0) continue;
			const authoredIndex = Math.trunc(Number(binding.jointIndices[base + influenceIndex] ?? -1));
			const skeletonIndex = binding.joints.length > 0 ? findJointIndex(skeleton.joints, binding.joints[authoredIndex] ?? "") : authoredIndex;
			if (skeletonIndex < 0 || skeletonIndex >= skeleton.joints.length) continue;
			influences.push({
				index: skeletonIndex,
				weight
			});
		}
		influences.sort((a, b) => b.weight - a.weight);
		const top = influences.slice(0, 4);
		const total = top.reduce((sum, item) => sum + item.weight, 0);
		for (let slot = 0; slot < 4; ++slot) {
			const influence = top[slot];
			skinIndices.push(influence?.index ?? 0);
			skinWeights.push(influence && total > 0 ? influence.weight / total : 0);
		}
	}
	return {
		indices: skinIndices,
		weights: skinWeights
	};
}
function buildGeometry(element, binding, skeleton) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(element.geometry.positions, 3));
	if (element.geometry.normals.length > 0 && element.geometry.normals.length === element.geometry.positions.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(element.geometry.normals, 3));
	else geometry.computeVertexNormals();
	if (element.geometry.uvs.length > 0) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(element.geometry.uvs, 2));
	const skin = skinAttributesForElement(element, binding, skeleton);
	if (skin) {
		geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skin.indices, 4));
		geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skin.weights, 4));
	}
	if (geometry.index && geometry.hasAttribute("position") && geometry.hasAttribute("normal") && geometry.hasAttribute("uv")) geometry.computeTangents();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return geometry;
}
function resolveBindingSkeleton(data, binding) {
	if (!binding) return void 0;
	if (binding.skeletonPath) {
		const exact = data.skels.skeletons.find((skeleton) => skeleton.path === binding.skeletonPath);
		if (exact) return exact;
	}
	return data.skels.skeletons[0];
}
function buildSkeletonBones(skeleton) {
	return skeleton.joints.map((joint, index) => {
		const bone = new THREE.Bone();
		bone.name = joint.split("/").pop() || `joint_${index}`;
		bone.userData.usd = {
			kind: "skelJoint",
			skeletonPath: skeleton.path,
			jointPath: joint,
			jointIndex: index
		};
		bone.matrixAutoUpdate = false;
		const restMatrix = skeleton.restSkelTransforms?.[index] ?? skeleton.bindTransforms[index] ?? skeleton.restTransforms[index];
		if (restMatrix && restMatrix.length >= 16) bone.matrix.copy(matrixFromUsd(restMatrix));
		return bone;
	});
}
function bindSkinnedMeshes(data, objectsByPath, wrapper) {
	const bonesBySkeletonPath = /* @__PURE__ */ new Map();
	const boneHostsBySkeletonPath = /* @__PURE__ */ new Map();
	const threeSkeletons = /* @__PURE__ */ new Map();
	for (const skeletonInfo of data.skels.skeletons) {
		const bones = buildSkeletonBones(skeletonInfo);
		bonesBySkeletonPath.set(skeletonInfo.path, bones);
		const inverseBindMatrices = skeletonInfo.bindTransforms.map((matrix) => matrixFromUsd(matrix).invert());
		const skeleton = new THREE.Skeleton(bones, inverseBindMatrices);
		threeSkeletons.set(skeletonInfo.path, skeleton);
		const skeletonObject = objectsByPath.get(skeletonInfo.path);
		const boneHost = new THREE.Group();
		boneHost.name = `${skeletonObject?.name ?? "Skeleton"}_BoneHost`;
		boneHost.matrixAutoUpdate = false;
		boneHostsBySkeletonPath.set(skeletonInfo.path, boneHost);
		if (wrapper) {
			wrapper.updateMatrixWorld(true);
			boneHost.matrix.copy(wrapper.matrixWorld).invert();
			wrapper.add(boneHost);
		}
		for (const bone of bones) boneHost.add(bone);
	}
	for (const binding of data.skels.bindings) {
		const mesh = objectsByPath.get(binding.primPath);
		const skeletonInfo = resolveBindingSkeleton(data, binding);
		if (!(mesh instanceof THREE.SkinnedMesh) || !skeletonInfo) continue;
		const skeleton = threeSkeletons.get(skeletonInfo.path);
		if (!skeleton) continue;
		const bindMatrix = binding.geomBindTransform ? matrixFromUsd(binding.geomBindTransform) : new THREE.Matrix4();
		mesh.bindMode = THREE.DetachedBindMode;
		mesh.bind(skeleton, bindMatrix);
		mesh.frustumCulled = false;
	}
	return {
		bonesBySkeletonPath,
		boneHostsBySkeletonPath
	};
}
//#endregion
//#region src/three/animations.ts
function createTransformTracks(animation, objectsByPath) {
	const tracks = [];
	for (const transform of animation.transforms) {
		const object = objectsByPath.get(transform.primPath);
		if (!object || transform.samples.length < 2) continue;
		const times = [];
		const positions = [];
		const quaternions = [];
		const scales = [];
		let previousQuaternion = null;
		for (const sample of transform.samples) {
			const matrix = matrixFromUsd(sample.localMatrix);
			const position = new THREE.Vector3();
			const quaternion = new THREE.Quaternion();
			const scale = new THREE.Vector3();
			matrix.decompose(position, quaternion, scale);
			if (previousQuaternion && previousQuaternion.dot(quaternion) < 0) quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
			previousQuaternion = quaternion.clone();
			times.push(sample.time);
			positions.push(position.x, position.y, position.z);
			quaternions.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
			scales.push(scale.x, scale.y, scale.z);
		}
		tracks.push(new THREE.VectorKeyframeTrack(`${object.uuid}.position`, times, positions), new THREE.QuaternionKeyframeTrack(`${object.uuid}.quaternion`, times, quaternions), new THREE.VectorKeyframeTrack(`${object.uuid}.scale`, times, scales));
	}
	return tracks;
}
function pushVec3Track(tracks, bone, property, samples, channelIndex) {
	if (!bone || samples.length < 2) return;
	const times = [];
	const values = [];
	for (const sample of samples) {
		const value = sample.values[channelIndex];
		if (!value) continue;
		times.push(sample.time);
		values.push(value[0], value[1], value[2]);
	}
	if (times.length < 2) return;
	tracks.push(new THREE.VectorKeyframeTrack(`${bone.uuid}.${property}`, times, values));
}
function pushQuatTrack(tracks, bone, samples, channelIndex) {
	if (!bone || samples.length < 2) return;
	const times = [];
	const values = [];
	let previous = null;
	for (const sample of samples) {
		const value = sample.values[channelIndex];
		if (!value) continue;
		const quaternion = new THREE.Quaternion(value[1], value[2], value[3], value[0]);
		if (previous && previous.dot(quaternion) < 0) quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
		previous = quaternion.clone();
		times.push(sample.time);
		values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
	}
	if (times.length < 2) return;
	tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values));
}
function pushMatrixTrack(tracks, bone, samples, jointIndex) {
	if (!bone || samples.length < 2) return;
	const times = [];
	const values = [];
	for (const sample of samples) {
		const matrix = sample.values[jointIndex];
		if (!matrix || matrix.length < 16) continue;
		times.push(sample.time);
		values.push(...matrixFromUsd(matrix).toArray());
	}
	if (times.length < 2) return;
	tracks.push(new THREE.NumberKeyframeTrack(`${bone.uuid}.matrix`, times, values));
}
function createSkelTracks(animation, data, bonesBySkeletonPath) {
	const tracks = [];
	const animationsByPath = new Map(data.skels.animations.map((item) => [item.path, item]));
	const skeletonsByPath = new Map(data.skels.skeletons.map((item) => [item.path, item]));
	for (const skelTrack of animation.skelAnimations) {
		const skeletonInfo = skeletonsByPath.get(skelTrack.skeletonPath);
		const skelAnimation = animationsByPath.get(skelTrack.animationPath);
		const bones = bonesBySkeletonPath.get(skelTrack.skeletonPath);
		if (!skeletonInfo || !skelAnimation || !bones) continue;
		const skelTransformSamples = skelAnimation.jointSkelTransformSamples?.find((item) => item.skeletonPath === skelTrack.skeletonPath)?.samples;
		if (skelTransformSamples && skelTransformSamples.length >= 2) {
			for (let jointIndex = 0; jointIndex < skeletonInfo.joints.length; ++jointIndex) pushMatrixTrack(tracks, bones[jointIndex], skelTransformSamples, jointIndex);
			continue;
		}
		for (let channelIndex = 0; channelIndex < skelAnimation.joints.length; ++channelIndex) {
			const joint = skelAnimation.joints[channelIndex];
			const skeletonIndex = joint ? findJointIndex(skeletonInfo.joints, joint) : -1;
			if (skeletonIndex < 0) continue;
			const bone = bones[skeletonIndex];
			pushVec3Track(tracks, bone, "position", skelAnimation.translations, channelIndex);
			pushQuatTrack(tracks, bone, skelAnimation.rotations, channelIndex);
			pushVec3Track(tracks, bone, "scale", skelAnimation.scales, channelIndex);
		}
	}
	return tracks;
}
function createAnimationClips(animations, objectsByPath, data, bonesBySkeletonPath) {
	return animations.map((animation, index) => {
		const tracks = [...createTransformTracks(animation, objectsByPath), ...createSkelTracks(animation, data, bonesBySkeletonPath)];
		if (tracks.length === 0) return null;
		const clip = new THREE.AnimationClip(animation.name || `USDAnimation_${index + 1}`, -1, tracks);
		clip.userData.usd = {
			kind: "animation",
			id: animation.id,
			source: animation.source,
			variant: animation.variant
		};
		return clip;
	}).filter((clip) => clip !== null);
}
//#endregion
//#region src/three/materials.ts
const sharedTextureCache = /* @__PURE__ */ new Map();
function releaseTexturesFromSharedCache(textures) {
	const released = new Set(textures);
	for (const [key, texture] of sharedTextureCache) if (released.has(texture)) sharedTextureCache.delete(key);
}
function vectorColor(value) {
	if (!Array.isArray(value) || value.length < 3) return null;
	const r = Number(value[0]);
	const g = Number(value[1]);
	const b = Number(value[2]);
	if (![
		r,
		g,
		b
	].every(Number.isFinite)) return null;
	return new THREE.Color(r, g, b);
}
function firstInput(material, suffixes) {
	if (!material) return null;
	const inputSources = [material.inputs, ...material.shaders.map((shader) => shader.inputs)];
	for (const inputs of inputSources) for (const [key, value] of Object.entries(inputs)) if (suffixes.some((suffix) => key.endsWith(suffix))) return value;
	return null;
}
function publicUrlFromAsset(asset, options, material, shader) {
	if (!asset || typeof asset !== "object") return null;
	const assetValue = asset;
	const resolved = options.textureResolver?.(assetValue, {
		sourcePath: options.sourcePath ?? "",
		material,
		shader
	});
	if (resolved) return resolved;
	if (assetValue.url && looksLikeTextureURL(assetValue.url)) return assetValue.url;
	if (assetValue.path) {
		if (!looksLikeTextureURL(assetValue.path)) return null;
		try {
			return new URL(assetValue.path, options.sourcePath || globalThis.location?.href).href;
		} catch {
			return assetValue.path;
		}
	}
	return null;
}
function looksLikeTextureURL(value) {
	if (/^(blob|data):/i.test(value)) return true;
	return /\.(png|jpe?g|webp)(?:[?#].*)?$/i.test(value);
}
function textureWrap(value) {
	if (value === "repeat") return THREE.RepeatWrapping;
	if (value === "mirror") return THREE.MirroredRepeatWrapping;
	return THREE.ClampToEdgeWrapping;
}
function shaderConnectionInfo(value) {
	if (!Array.isArray(value) || typeof value[0] !== "string") return null;
	const [path, outputName] = value[0].split(".outputs:");
	if (!path) return null;
	return {
		path,
		outputName: outputName || null
	};
}
function findTexture(material, options, connectionSuffixes, fallbackToAnyTexture = false) {
	if (!material) return null;
	const connection = shaderConnectionInfo(firstInput(material, connectionSuffixes.map((suffix) => suffix.replace(/\.connect$/, ".resolvedConnect"))) ?? firstInput(material, connectionSuffixes));
	const connectedPath = connection?.path ?? null;
	const textureShader = connectedPath ? material.shaders.find((shader) => shader.id === "UsdUVTexture" && shader.path === connectedPath) : fallbackToAnyTexture ? material.shaders.find((shader) => shader.id === "UsdUVTexture") : null;
	if (!textureShader) return null;
	const url = publicUrlFromAsset(textureShader.inputs["inputs:file"], options, material, textureShader);
	if (!url) return null;
	return {
		url,
		outputName: connection?.outputName ?? null,
		wrapS: textureWrap(textureShader.inputs["inputs:wrapS"]),
		wrapT: textureWrap(textureShader.inputs["inputs:wrapT"])
	};
}
function isHairLikeSurface(material, element) {
	return /hair/i.test(element.path) || /hair/i.test(material?.path ?? "");
}
function loadTexture(url, options, colorSpace) {
	const cache = options.textureCache ?? sharedTextureCache;
	const cacheKey = `${colorSpace}:${url}`;
	const cached = cache.get(cacheKey);
	if (cached) return cached;
	const texture = (options.textureLoader ?? new THREE.TextureLoader()).load(url);
	texture.colorSpace = colorSpace;
	texture.flipY = true;
	cache.set(cacheKey, texture);
	return texture;
}
function applyTextureWrap(texture, info) {
	texture.wrapS = info.wrapS;
	texture.wrapT = info.wrapT;
}
function buildMaterial(material, element, options) {
	const diffuseTexture = options.loadTextures === false ? null : findTexture(material, options, ["diffuseColor.connect", "baseColor.connect"], true);
	const displayColor = element.geometry.displayColor ? new THREE.Color(...element.geometry.displayColor) : null;
	const baseColor = vectorColor(firstInput(material, [
		"diffuseColor",
		"base_color",
		"baseColor"
	])) ?? (diffuseTexture ? new THREE.Color(1, 1, 1) : null) ?? displayColor ?? new THREE.Color(13158600);
	const opacityInput = firstInput(material, ["opacity", "alpha"]);
	const opacity = typeof opacityInput === "number" ? opacityInput : element.geometry.displayOpacity ?? 1;
	const roughness = firstInput(material, ["roughness"]);
	const metallic = firstInput(material, ["metallic", "metallicFactor"]);
	const emissiveColor = vectorColor(firstInput(material, ["emissiveColor", "emission_color"]));
	const ior = firstInput(material, ["ior"]);
	const opacityThreshold = firstInput(material, ["opacityThreshold"]);
	const alphaTexture = options.loadTextures === false ? null : findTexture(material, options, ["opacity.connect", "alpha.connect"]);
	const normalTexture = options.loadTextures === false ? null : findTexture(material, options, ["normal.connect"]);
	const metallicTexture = options.loadTextures === false ? null : findTexture(material, options, ["metallic.connect", "metallicFactor.connect"]);
	const roughnessTexture = options.loadTextures === false ? null : findTexture(material, options, ["roughness.connect"]);
	const occlusionTexture = options.loadTextures === false ? null : findTexture(material, options, ["occlusion.connect"]);
	const emissiveTexture = options.loadTextures === false ? null : findTexture(material, options, ["emissiveColor.connect", "emission_color.connect"]);
	const map = diffuseTexture ? loadTexture(diffuseTexture.url, options, THREE.SRGBColorSpace) : null;
	const usesMapAlpha = Boolean(alphaTexture && diffuseTexture && alphaTexture.url === diffuseTexture.url && alphaTexture.outputName === "a");
	const alphaMap = alphaTexture && !usesMapAlpha ? loadTexture(alphaTexture.url, options, THREE.NoColorSpace) : null;
	const normalMap = normalTexture ? loadTexture(normalTexture.url, options, THREE.NoColorSpace) : null;
	const metalnessMap = metallicTexture ? loadTexture(metallicTexture.url, options, THREE.NoColorSpace) : null;
	const roughnessMap = roughnessTexture ? loadTexture(roughnessTexture.url, options, THREE.NoColorSpace) : null;
	const aoMap = occlusionTexture ? loadTexture(occlusionTexture.url, options, THREE.NoColorSpace) : null;
	const emissiveMap = emissiveTexture ? loadTexture(emissiveTexture.url, options, THREE.SRGBColorSpace) : null;
	if (map && diffuseTexture) applyTextureWrap(map, diffuseTexture);
	if (alphaMap && alphaTexture) applyTextureWrap(alphaMap, alphaTexture);
	if (normalMap && normalTexture) applyTextureWrap(normalMap, normalTexture);
	if (metalnessMap && metallicTexture) applyTextureWrap(metalnessMap, metallicTexture);
	if (roughnessMap && roughnessTexture) applyTextureWrap(roughnessMap, roughnessTexture);
	if (aoMap && occlusionTexture) applyTextureWrap(aoMap, occlusionTexture);
	if (emissiveMap && emissiveTexture) applyTextureWrap(emissiveMap, emissiveTexture);
	const materialParameters = {
		color: baseColor,
		map,
		alphaMap,
		normalMap,
		metalnessMap,
		roughnessMap,
		aoMap,
		emissive: emissiveColor ?? new THREE.Color(0, 0, 0),
		emissiveMap,
		roughness: typeof roughness === "number" ? roughness : .55,
		metalness: typeof metallic === "number" ? metallic : 0,
		opacity,
		alphaTest: typeof opacityThreshold === "number" ? opacityThreshold : 0,
		transparent: opacity < 1 || Boolean(alphaTexture),
		side: element.doubleSided || isHairLikeSurface(material, element) ? THREE.DoubleSide : THREE.FrontSide
	};
	return typeof ior === "number" ? new THREE.MeshPhysicalMaterial({
		...materialParameters,
		ior
	}) : new THREE.MeshStandardMaterial(materialParameters);
}
//#endregion
//#region src/three/scene.ts
const disposedModels = /* @__PURE__ */ new WeakSet();
function appendMappedValue(map, key, value) {
	const values = map.get(key);
	if (values) values.push(value);
	else map.set(key, [value]);
}
function createUSDSceneIndex(data, objectsByPath, bonesBySkeletonPath, boneHostsBySkeletonPath) {
	const jointsByBodyPath = /* @__PURE__ */ new Map();
	for (const joint of data.joints) {
		if (joint.body0) appendMappedValue(jointsByBodyPath, joint.body0, joint);
		if (joint.body1) appendMappedValue(jointsByBodyPath, joint.body1, joint);
	}
	const variantsByPrimPath = /* @__PURE__ */ new Map();
	for (const variant of data.variants) appendMappedValue(variantsByPrimPath, variant.primPath, variant);
	return {
		objectsByPath,
		bonesBySkeletonPath,
		boneHostsBySkeletonPath,
		primsByPath: new Map(data.view.prims.map((prim) => [prim.path, prim])),
		meshesByPath: new Map(data.elements.map((element) => [element.path, element])),
		materialsByPath: new Map(data.materials.map((material) => [material.path, material])),
		rigidBodiesByPath: new Map(data.physics.rigidBodies.map((body) => [body.path, body])),
		collidersByPath: new Map(data.physics.colliders.map((collider) => [collider.path, collider])),
		jointsByPath: new Map(data.joints.map((joint) => [joint.path, joint])),
		jointsByBodyPath,
		skelBindingsByPrimPath: new Map(data.skels.bindings.map((binding) => [binding.primPath, binding])),
		skeletonsByPath: new Map(data.skels.skeletons.map((skeleton) => [skeleton.path, skeleton])),
		camerasByPath: new Map(data.cameras.map((camera) => [camera.path, camera])),
		variantsByPrimPath,
		animationsById: new Map(data.animations.map((animation) => [animation.id, animation]))
	};
}
function makeObjectForPrim(primPath, elementsByPath, materialsByPath, data, options) {
	const viewPrim = data.view.prims.find((item) => item.path === primPath);
	const element = elementsByPath.get(primPath);
	const binding = data.skels.bindings.find((item) => item.primPath === primPath);
	const skeleton = resolveBindingSkeleton(data, binding);
	const material = element ? buildMaterial(element.material ? materialsByPath.get(element.material) : void 0, element, options) : void 0;
	const object = element ? binding && skeleton ? new THREE.SkinnedMesh(buildGeometry(element, binding, skeleton), material) : new THREE.Mesh(buildGeometry(element), material) : new THREE.Group();
	object.name = viewPrim?.name ?? primPath.split("/").pop() ?? primPath;
	object.visible = viewPrim?.visibility !== "invisible";
	object.userData.usd = {
		kind: "prim",
		path: primPath,
		typeName: viewPrim?.typeName ?? ""
	};
	applyLocalMatrix(object, viewPrim?.localMatrix ?? null);
	return object;
}
function buildUSDScene(data, options = {}) {
	const sourcePath = options.sourcePath ?? data.stage.sourcePath;
	const wrapper = new THREE.Group();
	wrapper.name = `USD:${sourcePath}`;
	const elementsByPath = new Map(data.elements.map((element) => [element.path, element]));
	const materialsByPath = new Map(data.materials.map((material) => [material.path, material]));
	const objectsByPath = /* @__PURE__ */ new Map();
	for (const prim of data.view.prims) objectsByPath.set(prim.path, makeObjectForPrim(prim.path, elementsByPath, materialsByPath, data, {
		...options,
		sourcePath
	}));
	for (const prim of data.view.prims) {
		const object = objectsByPath.get(prim.path);
		if (!object) continue;
		const parent = prim.parentPath ? objectsByPath.get(prim.parentPath) : null;
		if (parent) parent.add(object);
		else wrapper.add(object);
	}
	if (options.convertZUp !== false && data.stage.upAxis === "Z") wrapper.rotation.x = -Math.PI / 2;
	const skinning = bindSkinnedMeshes(data, objectsByPath, wrapper);
	wrapper.animations = createAnimationClips(data.animations, objectsByPath, data, skinning.bonesBySkeletonPath);
	return {
		scene: wrapper,
		index: createUSDSceneIndex(data, objectsByPath, skinning.bonesBySkeletonPath, skinning.boneHostsBySkeletonPath)
	};
}
function createUSDLoadedModel(data, pxr, rootLayerIdentifier, options = {}, stage, resources = {}) {
	const sourcePath = options.sourcePath ?? data.stage.sourcePath;
	const built = buildUSDScene(data, {
		...options,
		sourcePath
	});
	const model = {
		scene: built.scene,
		data,
		index: built.index,
		resources: {
			usdzTextureURLs: resources.usdzTextureURLs ?? /* @__PURE__ */ new Map(),
			autoTextureURLs: resources.autoTextureURLs ?? /* @__PURE__ */ new Map()
		},
		stage,
		pxr,
		sourcePath,
		rootLayerIdentifier,
		dispose() {
			disposeUSDLoadedModel(model);
		}
	};
	return model;
}
function disposePxrObject(value) {
	if (value && typeof value === "object" && "delete" in value && typeof value.delete === "function") value.delete();
}
function disposeTexture(texture, disposed) {
	if (!texture || disposed.has(texture)) return;
	disposed.add(texture);
	texture.dispose();
}
function disposeMaterial(material, disposedTextures, disposedMaterials) {
	if (disposedMaterials.has(material)) return;
	disposedMaterials.add(material);
	for (const value of Object.values(material)) if (value instanceof THREE.Texture) disposeTexture(value, disposedTextures);
	material.dispose();
}
function revokeObjectURLs(urls) {
	if (!(urls instanceof Map) || typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
	for (const url of urls.values()) if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
	urls.clear();
}
function disposeUSDLoadedModel(model) {
	if (disposedModels.has(model)) return;
	disposedModels.add(model);
	const disposedGeometries = /* @__PURE__ */ new Set();
	const disposedMaterials = /* @__PURE__ */ new Set();
	const disposedTextures = /* @__PURE__ */ new Set();
	model.scene.traverse((object) => {
		const mesh = object;
		const geometry = mesh.geometry;
		if (geometry instanceof THREE.BufferGeometry && !disposedGeometries.has(geometry)) {
			disposedGeometries.add(geometry);
			geometry.dispose();
		}
		const material = mesh.material;
		if (Array.isArray(material)) for (const item of material) disposeMaterial(item, disposedTextures, disposedMaterials);
		else if (material instanceof THREE.Material) disposeMaterial(material, disposedTextures, disposedMaterials);
	});
	revokeObjectURLs(model.resources.usdzTextureURLs);
	revokeObjectURLs(model.resources.autoTextureURLs);
	releaseTexturesFromSharedCache(disposedTextures);
	disposePxrObject(model.stage);
	model.stage = void 0;
}
//#endregion
//#region src/loader.ts
const DEFAULT_WORKING_DIRECTORY = "/tmp/openusd-three-loader";
let nextLoadId = 0;
function isLoadingManager(value) {
	return !!value && typeof value === "object" && "itemStart" in value && "itemEnd" in value;
}
function dispose(value) {
	if (value && typeof value === "object" && "delete" in value && typeof value.delete === "function") value.delete();
}
function isValid(value) {
	return Boolean(value && (typeof value.IsValid !== "function" || value.IsValid()));
}
function isBlobLike(value) {
	return typeof Blob !== "undefined" && value instanceof Blob;
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
function extensionForPath(path) {
	const effective = getEffectivePath(path);
	const withoutQuery = effective.split(/[?#]/)[0] ?? effective;
	const extension = /\.([a-z0-9]+)$/i.exec(withoutQuery)?.[1]?.toLowerCase();
	if (extension === "usd" || extension === "usda" || extension === "usdc" || extension === "usdz") return extension;
	return "usda";
}
function fileNameForSource(sourcePath, fallbackExtension) {
	const effective = getEffectivePath(sourcePath);
	const name = (effective.split(/[?#]/)[0] ?? effective).split("/").filter(Boolean).pop();
	if (name && /\.[a-z0-9]+$/i.test(name)) return sanitizeFileName(name);
	return `scene.${fallbackExtension}`;
}
function sanitizeFileName(name) {
	return name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "") || "scene.usda";
}
function joinFsPath(base, name) {
	return `${base.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}
function normalizeBytes(input) {
	if (input instanceof ArrayBuffer) return new Uint8Array(input);
	return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}
async function sourceToWritableData(input) {
	if (typeof input === "string") return input;
	if (isBlobLike(input)) return new Uint8Array(await input.arrayBuffer());
	return normalizeBytes(input);
}
function maybeResolveURL(path, basePath) {
	if (!basePath) return path;
	try {
		return new URL(path, basePath).href;
	} catch {
		return `${basePath.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
	}
}
function composeTextureResolver(userResolver, packageResolver) {
	if (!packageResolver) return userResolver;
	return (asset, context) => userResolver?.(asset, context) ?? packageResolver(asset, context);
}
function deleteFileIfExists(pxr, path) {
	try {
		if (pxr.FS.exists(path)) pxr.FS.deleteFile(path);
	} catch {}
}
function deleteDirRecursiveIfExists(pxr, path) {
	if (!pxr.FS.exists(path)) return;
	for (const entry of pxr.FS.listDir(path)) if (entry.isDir) deleteDirRecursiveIfExists(pxr, entry.path);
	else deleteFileIfExists(pxr, entry.path);
	try {
		pxr.FS.deleteDir(path);
	} catch {}
}
function createUSDInputDirectory(pxr, workingDirectory) {
	const directory = joinFsPath(workingDirectory, String(++nextLoadId));
	pxr.FS.createDir(directory);
	return directory;
}
async function writeUSDFiles(pxr, directory, files) {
	for (const [relativePath, file] of Object.entries(files ?? {})) {
		const filePath = joinFsPath(directory, relativePath);
		
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
		
		pxr.FS.writeFile(filePath, await sourceToWritableData(file));
	}
}
async function writeUSDInput(pxr, directory, input, options) {
	await writeUSDFiles(pxr, directory, options.files);
	const path = joinFsPath(directory, sanitizeFileName(options.fileName));
	pxr.FS.writeFile(path, input);
	return path;
}
function openStage(pxr, filePath, extension, usdzLayer) {
	const identifiers = extension === "usdz" && usdzLayer ? [`${filePath}[${usdzLayer}]`, filePath] : [filePath];
	for (const identifier of identifiers) {
		const stage = pxr.Usd.Stage.Open(identifier);
		if (isValid(stage)) return {
			stage,
			identifier
		};
		dispose(stage);
	}
	throw new Error(`Failed to open USD stage from ${filePath}`);
}
function isAnimationVariantSet(setName) {
	return setName.toLowerCase().includes("anim");
}
function selectionKey(selection) {
	return `${selection.primPath}\n${selection.setName}`;
}
function mergeParseOptions(loaderOptions, parseOptions) {
	const sourcePath = parseOptions.sourcePath ?? parseOptions.fileName ?? "scene.usda";
	const extension = extensionForPath(parseOptions.fileName ?? sourcePath);
	return {
		...loaderOptions,
		...parseOptions,
		sourcePath,
		workingDirectory: parseOptions.workingDirectory ?? loaderOptions.workingDirectory ?? DEFAULT_WORKING_DIRECTORY,
		fileName: parseOptions.fileName ?? fileNameForSource(sourcePath, extension),
		usdzLayer: parseOptions.usdzLayer ?? loaderOptions.usdzLayer,
		preserveStage: parseOptions.preserveStage ?? loaderOptions.preserveStage,
		cleanupAfterParse: parseOptions.cleanupAfterParse ?? loaderOptions.cleanupAfterParse ?? false
	};
}
var USDLoader = class extends Loader {
	options;
	pxrPromise;
	constructor(optionsOrManager, manager) {
		if (isLoadingManager(optionsOrManager)) {
			super(optionsOrManager);
			this.options = {};
		} else {
			super(manager);
			this.options = optionsOrManager ?? {};
		}
		this.pxrPromise = this.options.pxr ? Promise.resolve(this.options.pxr) : null;
	}
	setPxr(pxr) {
		this.pxrPromise = Promise.resolve(pxr);
		return this;
	}
	setUSDZLayer(layer) {
		this.options.usdzLayer = layer;
		return this;
	}
	setWorkingDirectory(path) {
		this.options.workingDirectory = path;
		return this;
	}
	load(url, onLoad, onProgress, onError) {
		const loader = new FileLoader(this.manager);
		loader.setPath(this.path);
		loader.setResponseType("arraybuffer");
		loader.setRequestHeader(this.requestHeader);
		loader.setWithCredentials(this.withCredentials);
		loader.load(url, (data) => {
			const sourcePath = maybeResolveURL(url, this.path);
			this.parseAsync(data, { sourcePath }).then(onLoad).catch((error) => {
				if (onError) onError(error);
				else console.error(error);
				this.manager.itemError(url);
			});
		}, onProgress, onError);
	}
	parse(input, onLoad, onError, options = {}) {
		this.parseAsync(input, options).then(onLoad).catch((error) => {
			if (onError) onError(error);
			else console.error(error);
		});
	}
	async parseDataAsync(input, options = {}) {
		const pxr = await this.getPxr();
		const mergedOptions = mergeParseOptions(this.options, options);
		const extension = extensionForPath(mergedOptions.fileName);
		const writableData = await sourceToWritableData(input);
		const rootFileName = sanitizeFileName(mergedOptions.fileName);
		const directory = createUSDInputDirectory(pxr, mergedOptions.workingDirectory);
		let filePath = "";
		let stage = null;
		let stageReturned = false;
		try {
			filePath = await writeUSDInput(pxr, directory, writableData, {
				fileName: rootFileName,
				files: mergedOptions.files
			});
			const packageEntries = extension === "usdz" ? extractPackageEntries(pxr, filePath, joinFsPath(directory, ".packages")) : null;
			const packageTextureResolver = packageEntries ? createTextureResolverFromEntries(packageEntries) : null;
			const packageRootLayer = extension === "usdz" ? mergedOptions.usdzLayer ?? findPackageRootLayer(pxr, filePath) ?? void 0 : mergedOptions.usdzLayer;
			if (packageEntries) await writeUSDFiles(pxr, directory, Object.fromEntries(packageEntries));
			let autoFiles = extension !== "usdz" ? await autoResolveAssetFiles(pxr, filePath, {
				...mergedOptions,
				fileName: rootFileName
			}) : {};
			await writeUSDFiles(pxr, directory, autoFiles);
			const opened = openStage(pxr, filePath, extension, packageRootLayer);
			stage = opened.stage;
			const identifier = opened.identifier;
			applyVariantSelections(pxr, stage, mergedOptions.variantSelections);
			const sceneData = extractUSDSceneData(pxr, stage, {
				sourcePath: mergedOptions.sourcePath,
				rootLayerIdentifier: identifier
			});
			const originalSelections = new Map(sceneData.variants.map((variant) => [selectionKey(variant), variant.selection]));
			const currentSelectionByKey = new Map(originalSelections);
			const animationVariantClips = [];
			for (const variant of sceneData.variants.filter((item) => isAnimationVariantSet(item.setName))) for (const selection of variant.variantNames) {
				const key = selectionKey(variant);
				if (currentSelectionByKey.get(key) !== selection) {
					setVariantSelection(pxr, stage, {
						primPath: variant.primPath,
						setName: variant.setName,
						selection
					});
					currentSelectionByKey.set(key, selection);
				}
				const variantData = extractUSDSceneData(pxr, stage, {
					sourcePath: mergedOptions.sourcePath,
					rootLayerIdentifier: identifier
				});
				for (const animation of variantData.animations) {
					animation.id = `variant:${variant.primPath}:${variant.setName}:${selection}:${animation.id}`;
					animation.name = selection;
					animation.source = "variant";
					animation.variant = {
						primPath: variant.primPath,
						setName: variant.setName,
						selection
					};
					animationVariantClips.push(animation);
				}
			}
			for (const variant of sceneData.variants.filter((item) => isAnimationVariantSet(item.setName))) {
				const key = selectionKey(variant);
				const originalSelection = originalSelections.get(key) ?? null;
				if (currentSelectionByKey.get(key) !== originalSelection) {
					setVariantSelection(pxr, stage, {
						primPath: variant.primPath,
						setName: variant.setName,
						selection: originalSelection
					});
					currentSelectionByKey.set(key, originalSelection);
				}
			}
			if (animationVariantClips.length > 0) sceneData.animations = animationVariantClips;
			if (extension !== "usdz") autoFiles = {
				...autoFiles,
				...await autoResolveTextureFiles(sceneData, autoFiles, mergedOptions)
			};
			const autoTextureResolver = createTextureResolverFromEntries(new Map(Object.entries(autoFiles).map(([path, data]) => [path, normalizeBytes(data)])));
			const textureResolver = composeTextureResolver(composeTextureResolver(mergedOptions.textureResolver, packageTextureResolver?.resolve), autoTextureResolver?.resolve);
			stageReturned = Boolean(mergedOptions.preserveStage);
			return {
				data: sceneData,
				pxr,
				sourcePath: mergedOptions.sourcePath,
				rootLayerIdentifier: identifier,
				stage: mergedOptions.preserveStage ? stage ?? void 0 : void 0,
				textureResolver,
				usdzTextureURLs: packageTextureResolver?.urls,
				autoTextureURLs: autoTextureResolver?.urls
			};
		} finally {
			if (!stageReturned) dispose(stage);
			if (mergedOptions.cleanupAfterParse && !stageReturned) deleteDirRecursiveIfExists(pxr, directory);
		}
	}
	async parseAsync(input, options = {}) {
		const data = await this.parseDataAsync(input, options);
		return createUSDLoadedModel(data.data, data.pxr, data.rootLayerIdentifier, {
			...mergeParseOptions(this.options, options),
			textureResolver: data.textureResolver
		}, data.stage, {
			usdzTextureURLs: data.usdzTextureURLs,
			autoTextureURLs: data.autoTextureURLs
		});
	}
	async getPxr() {
		if (!this.pxrPromise) {
			if (!this.options.pxrCore) throw new Error("USDLoader requires either a pxr instance or pxrCore");
			this.pxrPromise = createPxr(this.options.pxrCore, this.options.pxrOptions);
		}
		return this.pxrPromise;
	}
};
//#endregion
export { USDLoader, buildUSDScene, createUSDLoadedModel, disposeUSDLoadedModel, extractUSDSceneData };
