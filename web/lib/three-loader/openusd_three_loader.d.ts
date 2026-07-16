import { Pxr } from "@openusd-wasm/pxr";
import * as THREE from "three";
import { Loader, LoadingManager } from "three";
import { USDAssetValue, USDTextureResolver as USDTextureResolver$1, USDTextureResolverContext as USDTextureResolverContext$1 } from "@openusd-wasm/utils";

//#region src/types.d.ts
type USDSourceInput = string | ArrayBuffer | ArrayBufferView | Blob;
type USDFileExtension = 'usd' | 'usda' | 'usdc' | 'usdz';
type USDVector2 = [number, number];
type USDVector3 = [number, number, number];
type USDVector4 = [number, number, number, number];
interface USDStageInfo {
  sourcePath: string;
  rootLayerIdentifier: string;
  defaultPrim: string | null;
  upAxis: string;
  startTimeCode: number;
  endTimeCode: number;
  timeCodesPerSecond: number;
}
interface USDViewPrim {
  path: string;
  parentPath: string | null;
  name: string;
  typeName: string;
  visibility: string;
  localMatrix: number[] | null;
  resetsXformStack: boolean;
}
interface USDMeshGeometryData {
  positions: number[] | Float32Array;
  pointIndices?: number[] | Int32Array;
  normals: number[] | Float32Array;
  uvs: number[] | Float32Array;
  displayColor: USDVector3 | null;
  displayOpacity: number | null;
}
interface USDMeshElement {
  path: string;
  doubleSided: boolean;
  material: string | null;
  geometry: USDMeshGeometryData;
}
interface USDShaderInfo {
  path: string;
  id: string | null;
  inputs: Record<string, unknown>;
}
interface USDMaterialInfo {
  path: string;
  inputs: Record<string, unknown>;
  shaders: USDShaderInfo[];
}
interface USDJointDriveInfo {
  dof?: string;
  type?: string | null;
  targetPosition: number | null;
  targetVelocity: number | null;
  stiffness: number | null;
  damping: number | null;
  maxForce: number | null;
}
interface USDJointLimitInfo {
  dof: string;
  low: number | null;
  high: number | null;
}
interface USDJointInfo {
  path: string;
  name: string;
  typeName: string;
  jointType: string;
  body0: string | null;
  body1: string | null;
  axis: string | null;
  localPos0: USDVector3;
  localPos1: USDVector3;
  localRot0: USDVector4 | null;
  localRot1: USDVector4 | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  enabled: boolean;
  collisionEnabled: boolean;
  excludeFromArticulation: boolean;
  breakForce: number | null;
  breakTorque: number | null;
  limits: USDJointLimitInfo[];
  drive: USDJointDriveInfo | null;
  drives: Record<string, USDJointDriveInfo>;
}
interface USDPhysicsMassInfo {
  mass: number | null;
  density: number | null;
  centerOfMass: USDVector3 | null;
  diagonalInertia: USDVector3 | null;
  principalAxes: USDVector4 | null;
}
interface USDPhysicsRigidBodyInfo {
  path: string;
  name: string;
  typeName: string;
  enabled: boolean;
  kinematicEnabled: boolean;
  startsAsleep: boolean | null;
  velocity: USDVector3 | null;
  angularVelocity: USDVector3 | null;
  mass: USDPhysicsMassInfo | null;
}
interface USDPhysicsColliderInfo {
  path: string;
  name: string;
  typeName: string;
  bodyPath: string | null;
  enabled: boolean;
  approximation: string | null;
  material: string | null;
}
interface USDPhysicsMaterialInfo {
  path: string;
  name: string;
  staticFriction: number | null;
  dynamicFriction: number | null;
  restitution: number | null;
  density: number | null;
}
interface USDPhysicsSceneInfo {
  path: string;
  name: string;
  gravityDirection: USDVector3 | null;
  gravityMagnitude: number | null;
}
interface USDPhysicsArticulationRootInfo {
  path: string;
  name: string;
  joints: string[];
}
interface USDPhysicsInfo {
  scenes: USDPhysicsSceneInfo[];
  rigidBodies: USDPhysicsRigidBodyInfo[];
  colliders: USDPhysicsColliderInfo[];
  materials: USDPhysicsMaterialInfo[];
  articulationRoots: USDPhysicsArticulationRootInfo[];
}
interface USDStageCameraInfo {
  path: string;
  name: string;
  projection: 'perspective' | 'orthographic';
  horizontalAperture: number | null;
  verticalAperture: number | null;
  focalLength: number | null;
  clippingRange: [number, number] | null;
  localMatrix: number[] | null;
}
interface USDTransformAnimationSample {
  time: number;
  localMatrix: number[];
}
interface USDTransformAnimation {
  primPath: string;
  samples: USDTransformAnimationSample[];
}
interface USDSkelBindingInfo {
  primPath: string;
  skeletonPath: string | null;
  animationSource: string | null;
  joints: string[];
  jointIndices: number[];
  jointWeights: number[];
  elementSize: number;
  geomBindTransform: number[] | null;
}
interface USDSkeletonInfo {
  path: string;
  joints: string[];
  bindTransforms: number[][];
  restTransforms: number[][];
  restSkelTransforms?: number[][];
}
interface USDSkelJointVec3Sample {
  time: number;
  values: USDVector3[];
}
interface USDSkelJointQuatSample {
  time: number;
  values: USDVector4[];
}
interface USDSkelJointMatrixSample {
  time: number;
  values: number[][];
}
interface USDSkelAnimationSkeletonSamples {
  skeletonPath: string;
  samples: USDSkelJointMatrixSample[];
}
interface USDSkelAnimationInfo {
  path: string;
  name: string;
  joints: string[];
  translations: USDSkelJointVec3Sample[];
  rotations: USDSkelJointQuatSample[];
  scales: USDSkelJointVec3Sample[];
  jointSkelTransformSamples?: USDSkelAnimationSkeletonSamples[];
}
interface USDSkelAnimationTrack {
  skeletonPath: string;
  animationPath: string;
  samplesStartTimeCode: number;
  samplesEndTimeCode: number;
}
type USDAnimationClipSource = 'stage' | 'skel' | 'variant' | 'clipsApi';
interface USDAnimationVariantRef {
  primPath: string;
  setName: string;
  selection: string;
}
interface USDAnimationInfo {
  id: string;
  name: string;
  source: USDAnimationClipSource;
  variant: USDAnimationVariantRef | null;
  startTimeCode: number;
  endTimeCode: number;
  timeCodesPerSecond: number;
  transforms: USDTransformAnimation[];
  skelAnimations: USDSkelAnimationTrack[];
}
interface USDVariantSetInfo {
  primPath: string;
  primName: string;
  setName: string;
  variantNames: string[];
  selection: string | null;
}
interface USDVariantSelection {
  primPath: string;
  setName: string;
  selection: string | null;
}
interface USDSkelInfo {
  skeletons: USDSkeletonInfo[];
  bindings: USDSkelBindingInfo[];
  animations: USDSkelAnimationInfo[];
}
interface USDSceneData {
  stage: USDStageInfo;
  view: {
    prims: USDViewPrim[];
  };
  elements: USDMeshElement[];
  materials: USDMaterialInfo[];
  physics: USDPhysicsInfo;
  joints: USDJointInfo[];
  cameras: USDStageCameraInfo[];
  skels: USDSkelInfo;
  animations: USDAnimationInfo[];
  variants: USDVariantSetInfo[];
}
type USDUserDataValue = {
  kind: 'prim';
  path: string;
  typeName: string;
} | {
  kind: 'skelJoint';
  skeletonPath: string;
  jointPath: string;
  jointIndex: number;
} | {
  kind: 'animation';
  id: string;
  source: USDAnimationClipSource;
  variant: USDAnimationVariantRef | null;
};
interface USDUserData {
  usd?: USDUserDataValue;
}
interface USDSceneIndex {
  objectsByPath: Map<string, THREE.Object3D>;
  bonesBySkeletonPath: Map<string, THREE.Bone[]>;
  boneHostsBySkeletonPath: Map<string, THREE.Object3D>;
  primsByPath: Map<string, USDViewPrim>;
  meshesByPath: Map<string, USDMeshElement>;
  materialsByPath: Map<string, USDMaterialInfo>;
  rigidBodiesByPath: Map<string, USDPhysicsRigidBodyInfo>;
  collidersByPath: Map<string, USDPhysicsColliderInfo>;
  jointsByPath: Map<string, USDJointInfo>;
  jointsByBodyPath: Map<string, USDJointInfo[]>;
  skelBindingsByPrimPath: Map<string, USDSkelBindingInfo>;
  skeletonsByPath: Map<string, USDSkeletonInfo>;
  camerasByPath: Map<string, USDStageCameraInfo>;
  variantsByPrimPath: Map<string, USDVariantSetInfo[]>;
  animationsById: Map<string, USDAnimationInfo>;
}
interface USDSceneBuildResult {
  scene: THREE.Group;
  index: USDSceneIndex;
}
interface USDLoadedModelResources {
  usdzTextureURLs: Map<string, string>;
  autoTextureURLs: Map<string, string>;
}
interface USDLoadedModel {
  scene: THREE.Group;
  data: USDSceneData;
  index: USDSceneIndex;
  resources: USDLoadedModelResources;
  stage?: unknown;
  pxr: Pxr;
  sourcePath: string;
  rootLayerIdentifier: string;
  dispose(): void;
}
interface USDParsedStageData {
  data: USDSceneData;
  stage?: unknown;
  pxr: Pxr;
  sourcePath: string;
  rootLayerIdentifier: string;
  textureResolver?: USDTextureResolver;
  usdzTextureURLs?: Map<string, string>;
  autoTextureURLs?: Map<string, string>;
}
interface ExtractUSDSceneDataOptions {
  sourcePath?: string;
  rootLayerIdentifier?: string;
}
type USDTextureResolverContext = USDTextureResolverContext$1<USDMaterialInfo, USDShaderInfo>;
type USDTextureResolver = USDTextureResolver$1<USDMaterialInfo, USDShaderInfo>;
interface BuildUSDSceneOptions {
  sourcePath?: string;
  convertZUp?: boolean;
  loadTextures?: boolean;
  textureResolver?: USDTextureResolver;
  textureLoader?: THREE.TextureLoader;
  textureCache?: Map<string, THREE.Texture>;
}
interface USDLoaderParseOptions extends BuildUSDSceneOptions {
  sourcePath?: string;
  fileName?: string;
  files?: Record<string, USDSourceInput>;
  autoResolveAssets?: boolean;
  assetSearchExtensions?: string[];
  assetSearchRoots?: string[];
  maxAssetReferences?: number;
  maxAssetReferenceDepth?: number;
  workingDirectory?: string;
  usdzLayer?: string;
  preserveStage?: boolean;
  cleanupAfterParse?: boolean;
  variantSelections?: USDVariantSelection[];
}
interface USDLoaderOptions extends BuildUSDSceneOptions {
  pxr?: Pxr | Promise<Pxr>;
  pxrOptions?: import('@openusd-wasm/pxr').PXRLoadOptions;
  workingDirectory?: string;
  assetSearchRoots?: string[];
  usdzLayer?: string;
  preserveStage?: boolean;
  cleanupAfterParse?: boolean;
  variantSelections?: USDVariantSelection[];
}
type PxrObject = any;
//#endregion
//#region src/loader.d.ts
declare class USDLoader extends Loader<USDLoadedModel, string> {
  private options;
  private pxrPromise;
  constructor(manager?: LoadingManager);
  constructor(options?: USDLoaderOptions, manager?: LoadingManager);
  setPxr(pxr: Pxr | Promise<Pxr>): this;
  setUSDZLayer(layer: string): this;
  setWorkingDirectory(path: string): this;
  load(url: string, onLoad: (data: USDLoadedModel) => void, onProgress?: (event: ProgressEvent) => void, onError?: (err: unknown) => void): void;
  parse(input: USDSourceInput, onLoad: (data: USDLoadedModel) => void, onError?: (err: unknown) => void, options?: USDLoaderParseOptions): void;
  parseDataAsync(input: USDSourceInput, options?: USDLoaderParseOptions): Promise<USDParsedStageData>;
  parseAsync(input: USDSourceInput, options?: USDLoaderParseOptions): Promise<USDLoadedModel>;
  private getPxr;
}
//#endregion
//#region src/scene-data.d.ts
declare function extractUSDSceneData(pxr: Pxr, stage: PxrObject, options?: ExtractUSDSceneDataOptions): USDSceneData;
//#endregion
//#region src/three/scene.d.ts
declare function buildUSDScene(data: USDSceneData, options?: BuildUSDSceneOptions): USDSceneBuildResult;
declare function createUSDLoadedModel(data: USDSceneData, pxr: USDLoadedModel['pxr'], rootLayerIdentifier: string, options?: BuildUSDSceneOptions, stage?: unknown, resources?: Partial<USDLoadedModelResources>): USDLoadedModel;
declare function disposeUSDLoadedModel(model: USDLoadedModel): void;
//#endregion
export { type BuildUSDSceneOptions, type ExtractUSDSceneDataOptions, type PxrObject, type USDAnimationInfo, type USDAssetValue, type USDFileExtension, type USDJointDriveInfo, type USDJointInfo, type USDJointLimitInfo, type USDLoadedModel, type USDLoadedModelResources, USDLoader, type USDLoaderOptions, type USDLoaderParseOptions, type USDMaterialInfo, type USDMeshElement, type USDMeshGeometryData, type USDParsedStageData, type USDPhysicsArticulationRootInfo, type USDPhysicsColliderInfo, type USDPhysicsInfo, type USDPhysicsMassInfo, type USDPhysicsMaterialInfo, type USDPhysicsRigidBodyInfo, type USDPhysicsSceneInfo, type USDSceneBuildResult, type USDSceneData, type USDSceneIndex, type USDShaderInfo, type USDSourceInput, type USDStageCameraInfo, type USDStageInfo, type USDTextureResolver, type USDTextureResolverContext, type USDTransformAnimation, type USDTransformAnimationSample, type USDUserData, type USDUserDataValue, type USDVariantSelection, type USDVariantSetInfo, type USDVector2, type USDVector3, type USDVector4, type USDViewPrim, buildUSDScene, createUSDLoadedModel, disposeUSDLoadedModel, extractUSDSceneData };