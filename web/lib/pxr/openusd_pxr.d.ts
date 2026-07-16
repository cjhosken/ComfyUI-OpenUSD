//#region src/bindings.d.ts
interface EmscriptenFs {
  filesystems?: Record<string, unknown>;
  mkdir(path: string): void;
  mount(fsType: unknown, opts: Record<string, unknown>, mountPoint: string): void;
  unmount(mountPoint: string): void;
  writeFile(path: string, data: string | ArrayBuffer | ArrayBufferView): void;
  readFile(path: string, opts?: unknown): unknown;
  readdir(path: string): string[];
  stat(path: string): {
    mode: number;
    size: number;
  };
  isDir(mode: number): boolean;
  isFile(mode: number): boolean;
  unlink(path: string): void;
  rmdir(path: string): void;
  rename(oldPath: string, newPath: string): void;
  syncfs(populate: boolean, callback: (err?: unknown) => void): void;
}
interface WasmModule extends Record<string, unknown> {
  FS?: EmscriptenFs;
  mainScriptUrlOrBlob?: unknown;
  PxrJsInitializeOpenUsdRuntime?: () => void;
}
interface PxrDisposable {
  delete(): void;
  using<T>(fn: (value: this) => T): T;
}
type PxrInstance = PxrDisposable;
type PxrClass<Instance extends PxrDisposable = PxrInstance, Args extends readonly unknown[] = never[]> = {
  new (...args: Args): Instance;
  prototype: Instance;
  [key: string]: unknown;
};
type PxrFunction = (...args: never[]) => unknown;
type PxrBindingObject = Record<string, unknown>;
type PxrNamespaceValue = PxrClass | PxrFunction | PxrBindingObject;
type PxrNamespace = Record<string, PxrNamespaceValue>;
type PxrModuleName = 'Gf' | 'Sdf' | 'Usd' | 'UsdGeom' | 'UsdPhysics' | 'UsdSkel' | 'UsdShade' | 'UsdUtils';
//#endregion
//#region src/types.d.ts
type Vec2 = [number, number];
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];
type Matrix3 = [number, number, number, number, number, number, number, number, number];
type Matrix4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
interface SdfAssetPathValue {
  path: string;
  resolvedPath: string;
}
interface GfQuatValue {
  real: number;
  imaginary: Vec3;
}
interface UnsupportedUsdValue {
  unsupportedType: string;
  string: string;
}
type UsdDictionary = {
  readonly [key: string]: UsdValue;
};
type UsdValue = null | boolean | number | string | Vec2 | Vec3 | Vec4 | Matrix4 | GfQuatValue | SdfAssetPathValue | UsdDictionary | UsdValue[] | UnsupportedUsdValue;
interface TypedUsdValue<TypeName extends string, Value> {
  type: TypeName;
  value: Value;
}
type TokenValue = TypedUsdValue<'token', string>;
type AssetValue = TypedUsdValue<'asset', string>;
type PathValue = TypedUsdValue<'path', string>;
type FloatValue = TypedUsdValue<'float', number>;
type IntValue = TypedUsdValue<'int', number>;
type Vec2fValue = TypedUsdValue<'vec2f' | 'texCoord2f', Vec2>;
type Vec2dValue = TypedUsdValue<'vec2d', Vec2>;
type Vec3fValue = TypedUsdValue<'vec3f' | 'point3f' | 'normal3f' | 'color3f', Vec3>;
type Vec3dValue = TypedUsdValue<'vec3d' | 'point3d', Vec3>;
type Vec4fValue = TypedUsdValue<'vec4f' | 'color4f', Vec4>;
type Vec4dValue = TypedUsdValue<'vec4d', Vec4>;
type Matrix4dValue = TypedUsdValue<'matrix4d', Matrix4 | readonly number[]>;
interface QuatfValue {
  type: 'quatf';
  value: GfQuatValue;
}
interface QuatdValue {
  type: 'quatd';
  value: GfQuatValue;
}
type IntArrayValue = TypedUsdValue<'intArray', readonly number[]>;
type FloatArrayValue = TypedUsdValue<'floatArray', readonly number[]>;
type DoubleArrayValue = TypedUsdValue<'doubleArray', readonly number[]>;
type TokenArrayValue = TypedUsdValue<'tokenArray', readonly string[]>;
type StringArrayValue = TypedUsdValue<'stringArray', readonly string[]>;
type AssetArrayValue = TypedUsdValue<'assetArray', readonly string[]>;
type Vec2fArrayValue = TypedUsdValue<'vec2fArray' | 'texCoord2fArray', readonly Vec2[]>;
type Vec3fArrayValue = TypedUsdValue<'vec3fArray' | 'point3fArray' | 'normal3fArray' | 'color3fArray', readonly Vec3[]>;
type Vec3dArrayValue = TypedUsdValue<'vec3dArray' | 'point3dArray', readonly Vec3[]>;
type UsdValueInput = null | boolean | number | string | readonly number[] | UsdDictionaryInput | TokenValue | AssetValue | PathValue | FloatValue | IntValue | Vec2fValue | Vec2dValue | Vec3fValue | Vec3dValue | Vec4fValue | Vec4dValue | Matrix4dValue | QuatfValue | QuatdValue | IntArrayValue | FloatArrayValue | DoubleArrayValue | TokenArrayValue | StringArrayValue | AssetArrayValue | Vec2fArrayValue | Vec3fArrayValue | Vec3dArrayValue;
interface UsdDictionaryInput {
  readonly [key: string]: UsdValueInput;
}
interface SdfValueTypeName<Read = UsdValue, Write = UsdValueInput> extends PxrDisposable {
  readonly __readType?: Read;
  readonly __writeType?: Write;
  GetAsToken(): string;
  GetCPPTypeName(): string;
  IsScalar(): boolean;
  IsArray(): boolean;
  GetScalarType(): SdfValueTypeName;
  GetArrayType(): SdfValueTypeName;
}
type SdfReadValue<T> = T extends SdfValueTypeName<infer Read, unknown> ? Read : UsdValue;
type SdfWriteValue<T> = T extends SdfValueTypeName<unknown, infer Write> ? Write : UsdValueInput;
type PathLike = string | SdfPath;
interface SdfPath extends PxrDisposable {
  GetString(): string;
  GetText(): string;
  GetName(): string;
  GetElementString(): string;
  GetPathElementCount(): number;
  IsEmpty(): boolean;
  IsAbsolutePath(): boolean;
  IsAbsoluteRootPath(): boolean;
  IsPrimPath(): boolean;
  IsAbsoluteRootOrPrimPath(): boolean;
  IsRootPrimPath(): boolean;
  IsPropertyPath(): boolean;
  IsPrimPropertyPath(): boolean;
  IsNamespacedPropertyPath(): boolean;
  IsPrimVariantSelectionPath(): boolean;
  IsPrimOrPrimVariantSelectionPath(): boolean;
  ContainsPrimVariantSelection(): boolean;
  ContainsPropertyElements(): boolean;
  ContainsTargetPath(): boolean;
  IsRelationalAttributePath(): boolean;
  IsTargetPath(): boolean;
  GetPrefixes(): SdfPath[];
  GetPrefixes(numPrefixes: number): SdfPath[];
  ReplaceName(name: string): SdfPath;
  GetTargetPath(): SdfPath;
  GetParentPath(): SdfPath;
  GetPrimPath(): SdfPath;
  GetPrimOrPrimVariantSelectionPath(): SdfPath;
  GetAbsoluteRootOrPrimPath(): SdfPath;
  StripAllVariantSelections(): SdfPath;
  AppendPath(path: SdfPath): SdfPath;
  AppendChild(name: string): SdfPath;
  AppendProperty(name: string): SdfPath;
  AppendVariantSelection(variantSet: string, variant: string): SdfPath;
  AppendTarget(path: SdfPath): SdfPath;
  AppendRelationalAttribute(name: string): SdfPath;
  AppendElementString(element: string): SdfPath;
}
interface SdfPathConstructor extends PxrClass<SdfPath, [] | [string]> {
  EmptyPath(): SdfPath;
  AbsoluteRootPath(): SdfPath;
  ReflexiveRelativePath(): SdfPath;
  IsValidPathString(path: string): boolean;
  IsValidIdentifier(identifier: string): boolean;
}
interface SdfAssetPath extends PxrDisposable {
  readonly path: string;
  readonly resolvedPath: string;
  GetAssetPath(): string;
  GetResolvedPath(): string;
}
type SdfAssetPathConstructor = PxrClass<SdfAssetPath, [] | [assetPath: string] | [assetPath: string, resolvedPath: string]>;
interface SdfLayer extends PxrDisposable {
  subLayerPaths: string[];
  IsValid(): boolean;
  IsAnonymous(): boolean;
  IsDirty(): boolean;
  PermissionToEdit(): boolean;
  SetPermissionToEdit(allow: boolean): void;
  PermissionToSave(): boolean;
  SetPermissionToSave(allow: boolean): void;
  GetIdentifier(): string;
  GetDisplayName(): string;
  GetRealPath(): string;
  GetResolvedPath(): string;
  ExportToString(): string;
  ImportFromString(text: string): boolean;
  Export(filename: string): boolean;
  Export(filename: string, comment: string): boolean;
  Clear(): void;
  Reload(): boolean;
  Reload(force: boolean): boolean;
  Save(): boolean;
  Save(force: boolean): boolean;
  GetPrimAtPath(path: SdfPath): SdfPrimSpec;
  GetSubLayerPaths(): string[];
  SetSubLayerPaths(paths: readonly string[]): void;
  GetCompositionAssetDependencies(): string[];
  GetExternalAssetDependencies(): string[];
}
interface SdfLayerConstructor extends PxrClass<SdfLayer, []> {
  CreateAnonymous(): SdfLayer;
  CreateAnonymous(tag: string): SdfLayer;
  CreateNew(identifier: string): SdfLayer;
  Find(identifier: string): SdfLayer;
  FindOrOpen(identifier: string): SdfLayer;
  IsAnonymousLayerIdentifier(identifier: string): boolean;
  GetDisplayNameFromIdentifier(identifier: string): string;
}
interface SdfPrimSpec extends PxrDisposable {
  IsValid(): boolean;
  GetPath(): string;
  GetName(): string;
}
type SdfPrimSpecConstructor = PxrClass<SdfPrimSpec, []>;
type SdfValueTypeNameConstructor = PxrClass<SdfValueTypeName, []>;
interface SdfValueTypeNames extends Record<string, SdfValueTypeName> {
  Bool: SdfValueTypeName<boolean, boolean>;
  Int: SdfValueTypeName<number, number | IntValue>;
  Float: SdfValueTypeName<number, number | FloatValue>;
  Double: SdfValueTypeName<number, number>;
  String: SdfValueTypeName<string, string>;
  Token: SdfValueTypeName<string, string | TokenValue>;
  Asset: SdfValueTypeName<SdfAssetPathValue, string | AssetValue>;
  Matrix3d: SdfValueTypeName<Matrix3, Matrix3 | readonly number[]>;
  Matrix4d: SdfValueTypeName<Matrix4, Matrix4 | Matrix4dValue>;
  Quatf: SdfValueTypeName<GfQuatValue, QuatfValue>;
  Quatd: SdfValueTypeName<GfQuatValue, QuatdValue>;
  Float2: SdfValueTypeName<Vec2, Vec2 | Vec2fValue>;
  Double2: SdfValueTypeName<Vec2, Vec2 | Vec2dValue>;
  Vector3f: SdfValueTypeName<Vec3, Vec3 | Vec3fValue>;
  Vector3d: SdfValueTypeName<Vec3, Vec3 | Vec3dValue>;
  Float4: SdfValueTypeName<Vec4, Vec4 | Vec4fValue>;
  Double4: SdfValueTypeName<Vec4, Vec4 | Vec4dValue>;
  Color3f: SdfValueTypeName<Vec3, Vec3 | Vec3fValue>;
  Color4f: SdfValueTypeName<Vec4, Vec4 | Vec4fValue>;
  Point3f: SdfValueTypeName<Vec3, Vec3 | Vec3fValue>;
  Normal3f: SdfValueTypeName<Vec3, Vec3 | Vec3fValue>;
  Point3fArray: SdfValueTypeName<Vec3[], Vec3fArrayValue>;
  Normal3fArray: SdfValueTypeName<Vec3[], Vec3fArrayValue>;
  Color3fArray: SdfValueTypeName<Vec3[], Vec3fArrayValue>;
  Float2Array: SdfValueTypeName<Vec2[], Vec2fArrayValue>;
  TexCoord2fArray: SdfValueTypeName<Vec2[], Vec2fArrayValue>;
  StringArray: SdfValueTypeName<string[], StringArrayValue>;
  TokenArray: SdfValueTypeName<string[], TokenArrayValue>;
  AssetArray: SdfValueTypeName<SdfAssetPathValue[], AssetArrayValue>;
  FloatArray: SdfValueTypeName<number[], FloatArrayValue>;
  IntArray: SdfValueTypeName<number[], IntArrayValue>;
}
interface SdfZipFileInfo extends PxrDisposable {
  GetDataOffset(): number;
  GetSize(): number;
  GetUncompressedSize(): number;
  GetCrc(): number;
  GetCompressionMethod(): number;
  GetEncrypted(): boolean;
}
type SdfZipFileInfoConstructor = PxrClass<SdfZipFileInfo, []>;
interface SdfZipFile extends PxrDisposable {
  IsValid(): boolean;
  GetFileNames(): string[];
  GetFileInfo(path: string): SdfZipFileInfo;
  GetFile(path: string): Uint8Array | null;
  DumpContents(): void;
}
interface SdfZipFileConstructor extends PxrClass<SdfZipFile, []> {
  Open(filePath: string): SdfZipFile;
}
interface SdfZipFileWriter extends PxrDisposable {
  IsValid(): boolean;
  AddFile(filePath: string): string;
  AddFile(filePath: string, filePathInArchive: string): string;
  Save(): boolean;
  Discard(): void;
}
interface SdfZipFileWriterConstructor extends PxrClass<SdfZipFileWriter, []> {
  CreateNew(filePath: string): SdfZipFileWriter;
}
interface PxrSdfNamespace {
  Path: SdfPathConstructor;
  AssetPath: SdfAssetPathConstructor;
  Layer: SdfLayerConstructor;
  PrimSpec: SdfPrimSpecConstructor;
  ValueTypeName: SdfValueTypeNameConstructor;
  ValueTypeNames: SdfValueTypeNames;
  ZipFile: SdfZipFileConstructor;
  ZipFileInfo: SdfZipFileInfoConstructor;
  ZipFileWriter: SdfZipFileWriterConstructor;
}
interface UsdTimeCode extends PxrDisposable {
  IsDefault(): boolean;
  IsNumeric(): boolean;
  IsEarliestTime(): boolean;
  IsPreTime(): boolean;
  GetValue(): number;
}
interface UsdTimeCodeConstructor extends PxrClass<UsdTimeCode, [] | [number]> {
  Default(): UsdTimeCode;
  EarliestTime(): UsdTimeCode;
  PreTime(value: number): UsdTimeCode;
}
interface UsdAttribute<Read = UsdValue, Write = UsdValueInput> extends PxrDisposable {
  IsValid(): boolean;
  HasValue(): boolean;
  HasAuthoredValue(): boolean;
  HasFallbackValue(): boolean;
  ValueMightBeTimeVarying(): boolean;
  GetName(): string;
  GetPath(): string;
  GetTypeName(): string;
  Get(time: UsdTimeCode): Read | null;
  Set(value: Write, time: UsdTimeCode): boolean;
  Clear(): boolean;
  ClearAtTime(time: UsdTimeCode): boolean;
  Block(): void;
  SetMetadata(key: string, value: UsdValueInput): boolean;
  AddConnection(source: PathLike): boolean;
  GetMetadata(key: string): UsdValue;
  GetConnections(): SdfPath[];
  SetConnections(sources: readonly PathLike[]): boolean;
  RemoveConnection(source: PathLike): boolean;
  ClearConnections(): boolean;
  HasAuthoredConnections(): boolean;
  GetTimeSamples(): number[];
}
type UsdAttributeConstructor = PxrClass<UsdAttribute, []>;
interface UsdRelationship extends PxrDisposable {
  IsValid(): boolean;
  GetName(): string;
  GetPath(): string;
  AddTarget(target: PathLike): boolean;
  SetTargets(targets: readonly PathLike[]): boolean;
  RemoveTarget(target: PathLike): boolean;
  ClearTargets(removeSpec: boolean): boolean;
  HasAuthoredTargets(): boolean;
  GetTargets(): SdfPath[];
}
type UsdRelationshipConstructor = PxrClass<UsdRelationship, []>;
interface UsdReferences extends PxrDisposable {
  AddReference(identifier: string): boolean;
  AddReference(identifier: string, primPath: string): boolean;
  AddInternalReference(primPath: string): boolean;
  ClearReferences(): boolean;
}
interface UsdPayloads extends PxrDisposable {
  AddPayload(identifier: string): boolean;
  AddPayload(identifier: string, primPath: string): boolean;
  AddInternalPayload(primPath: string): boolean;
  ClearPayloads(): boolean;
}
type UsdReferencesConstructor = PxrClass<UsdReferences>;
type UsdPayloadsConstructor = PxrClass<UsdPayloads>;
interface UsdVariantSet extends PxrDisposable {
  IsValid(): boolean;
  GetName(): string;
  GetPrim(): UsdPrim;
  GetVariantNames(): string[];
  GetVariantSelection(): string;
  SetVariantSelection(variantName: string): boolean;
  ClearVariantSelection(): boolean;
}
interface UsdVariantSets extends PxrDisposable {
  GetNames(): string[];
  GetVariantSet(variantSetName: string): UsdVariantSet;
  HasVariantSet(variantSetName: string): boolean;
}
type UsdVariantSetConstructor = PxrClass<UsdVariantSet>;
type UsdVariantSetsConstructor = PxrClass<UsdVariantSets>;
interface UsdPrim extends PxrDisposable {
  IsValid(): boolean;
  IsActive(): boolean;
  SetActive(active: boolean): boolean;
  IsDefined(): boolean;
  IsAbstract(): boolean;
  IsInstance(): boolean;
  IsPrototype(): boolean;
  IsInPrototype(): boolean;
  IsModel(): boolean;
  IsGroup(): boolean;
  IsLoaded(): boolean;
  GetPath(): string;
  GetName(): string;
  GetTypeName(): string;
  IsPseudoRoot(): boolean;
  IsA(schemaIdentifier: string): boolean;
  GetStage(): UsdStage;
  GetVariantSets(): UsdVariantSets;
  GetParent(): UsdPrim;
  GetChildren(): UsdPrim[];
  GetPropertyNames(): string[];
  GetAuthoredPropertyNames(): string[];
  GetAppliedSchemas(): string[];
  RemoveProperty(name: string): boolean;
  SetMetadata(key: string, value: UsdValueInput): boolean;
  GetMetadata(key: string): UsdValue;
  HasAuthoredMetadata(key: string): boolean;
  ClearMetadata(key: string): boolean;
  GetAttribute(name: string): UsdAttribute;
  GetRelationship(name: string): UsdRelationship;
  GetReferences(): UsdReferences;
  GetPayloads(): UsdPayloads;
  GetAttributes(): UsdAttribute[];
  GetRelationships(): UsdRelationship[];
  CreateAttribute<T extends SdfValueTypeName>(name: string, typeName: T): UsdAttribute<SdfReadValue<T>, SdfWriteValue<T>>;
  CreateRelationship(name: string): UsdRelationship;
  CreateRelationship(name: string, custom: boolean): UsdRelationship;
}
type UsdPrimConstructor = PxrClass<UsdPrim, []>;
interface UsdStage extends PxrDisposable {
  IsValid(): boolean;
  GetStartTimeCode(): number;
  SetStartTimeCode(timeCode: number): void;
  GetEndTimeCode(): number;
  SetEndTimeCode(timeCode: number): void;
  GetTimeCodesPerSecond(): number;
  SetTimeCodesPerSecond(timeCodesPerSecond: number): void;
  GetFramesPerSecond(): number;
  SetFramesPerSecond(framesPerSecond: number): void;
  ExportToString(): string;
  ExportToString(addSourceFileComment: boolean): string;
  Export(filename: string, addSourceFileComment: boolean): boolean;
  GetRootLayer(): SdfLayer;
  GetPseudoRoot(): UsdPrim;
  GetUsedLayers(): SdfLayer[];
  GetUsedLayers(includeClipLayers: boolean): SdfLayer[];
  GetDefaultPrim(): UsdPrim;
  SetDefaultPrim(prim: UsdPrim): boolean;
  GetPrimAtPath(path: SdfPath): UsdPrim;
  DefinePrim(path: SdfPath, typeName: string): UsdPrim;
  OverridePrim(path: SdfPath): UsdPrim;
  RemovePrim(path: SdfPath): boolean;
  Traverse(): UsdPrim[];
  TraverseInstanceProxies(): UsdPrim[];
}
interface UsdStageConstructor extends PxrClass<UsdStage, []> {
  CreateInMemory(): UsdStage;
  CreateInMemory(identifier: string): UsdStage;
  CreateNew(identifier: string): UsdStage;
  Open(identifier: string): UsdStage;
}
interface PxrUsdNamespace {
  Stage: UsdStageConstructor;
  Prim: UsdPrimConstructor;
  VariantSets: UsdVariantSetsConstructor;
  VariantSet: UsdVariantSetConstructor;
  Attribute: UsdAttributeConstructor;
  Relationship: UsdRelationshipConstructor;
  References: UsdReferencesConstructor;
  Payloads: UsdPayloadsConstructor;
  TimeCode: UsdTimeCodeConstructor;
}
interface GfVec<Items extends readonly number[]> extends PxrDisposable {
  GetLength(): number;
  toArray(): Items;
}
interface GfVecConstructor<Items extends readonly number[]> extends PxrClass<GfVec<Items>, [] | [number] | Items> {
  fromArray(values: Items | readonly number[]): GfVec<Items>;
}
interface GfMatrix<Items extends readonly number[]> extends PxrDisposable {
  toArray(): Items;
}
interface GfMatrixConstructor<Items extends readonly number[]> extends PxrClass<GfMatrix<Items>, [] | [number]> {
  fromArray(values: Items | readonly number[]): GfMatrix<Items>;
}
interface GfQuat extends PxrDisposable {
  GetReal(): number;
  GetImaginary(): GfVec<Vec3>;
  toArray(): Vec4;
}
type GfQuatConstructor = PxrClass<GfQuat, [] | [number, number, number, number] | [number, GfVec<Vec3>]>;
interface GfRange<Value> extends PxrDisposable {
  GetMin(): Value;
  GetMax(): Value;
  GetSize(): Value;
  IsEmpty(): boolean;
  UnionWith(other: GfRange<Value>): this;
}
type GfRangeConstructor<Value> = PxrClass<GfRange<Value>, [] | [Value, Value]>;
interface GfBBox3d extends PxrDisposable {
  GetRange(): GfRange<GfVec<Vec3>>;
  ComputeAlignedRange(): GfRange<GfVec<Vec3>>;
}
type GfBBox3dConstructor = PxrClass<GfBBox3d, [] | [GfRange<GfVec<Vec3>>]>;
interface PxrGfNamespace {
  Vec2f: GfVecConstructor<Vec2>;
  Vec2d: GfVecConstructor<Vec2>;
  Vec2h: GfVecConstructor<Vec2>;
  Vec2i: GfVecConstructor<Vec2>;
  Vec3f: GfVecConstructor<Vec3>;
  Vec3d: GfVecConstructor<Vec3>;
  Vec3h: GfVecConstructor<Vec3>;
  Vec3i: GfVecConstructor<Vec3>;
  Vec4f: GfVecConstructor<Vec4>;
  Vec4d: GfVecConstructor<Vec4>;
  Vec4h: GfVecConstructor<Vec4>;
  Vec4i: GfVecConstructor<Vec4>;
  Matrix3d: GfMatrixConstructor<Matrix3>;
  Matrix4d: GfMatrixConstructor<Matrix4>;
  Quatf: GfQuatConstructor;
  Quatd: GfQuatConstructor;
  Quath: GfQuatConstructor;
  Range1d: GfRangeConstructor<number>;
  Range2d: GfRangeConstructor<GfVec<Vec2>>;
  Range3d: GfRangeConstructor<GfVec<Vec3>>;
  Range3f: GfRangeConstructor<GfVec<Vec3>>;
  BBox3d: GfBBox3dConstructor;
}
interface UsdSchemaBase extends PxrDisposable {
  IsValid(): boolean;
  GetPrim(): UsdPrim;
}
interface UsdSchemaConstructor<T extends UsdSchemaBase> extends PxrClass<T, [] | [UsdPrim]> {
  Define(stage: UsdStage, path: SdfPath): T;
}
interface UsdGeomXformOp extends PxrDisposable {
  IsDefined(): boolean;
  GetName(): string;
  Set(value: number | Vec3 | Matrix4 | readonly number[], time: UsdTimeCode): boolean;
}
type UsdGeomXformOpConstructor = PxrClass<UsdGeomXformOp, []>;
interface UsdGeomXformable extends UsdSchemaBase {
  AddTranslateOp(): UsdGeomXformOp;
  AddScaleOp(): UsdGeomXformOp;
  AddRotateXOp(): UsdGeomXformOp;
  AddRotateYOp(): UsdGeomXformOp;
  GetLocalTransformation(): UsdGeomLocalTransformation;
  GetLocalTransformation(time: UsdTimeCode): UsdGeomLocalTransformation;
  TransformMightBeTimeVarying(): boolean;
  GetTimeSamples(): number[];
}
type UsdGeomXformableConstructor = PxrClass<UsdGeomXformable, [] | [UsdPrim]>;
interface UsdGeomLocalTransformation {
  matrix: Matrix4;
  resetsXformStack: boolean;
}
interface UsdGeomTriangulatedGeometry {
  positions: Float32Array;
  pointIndices: number[];
  normals: Float32Array;
  uvs: Float32Array;
  displayColor: Vec3 | null;
  displayOpacity: number | null;
}
interface UsdGeomXform extends UsdSchemaBase {}
interface UsdGeomGprim extends UsdSchemaBase {
  GetDisplayColorAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  GetDisplayOpacityAttr(): UsdAttribute<number[], FloatArrayValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  GetOrientationAttr(): UsdAttribute<string, string | TokenValue>;
  GetExtentAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  CreateDoubleSidedAttr(value: boolean): UsdAttribute<boolean>;
  CreateOrientationAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateExtentAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
}
interface UsdGeomCube extends UsdGeomGprim {
  GetSizeAttr(): UsdAttribute<number>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateSizeAttr(value: number): UsdAttribute<number>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
}
interface UsdGeomSphere extends UsdGeomGprim {
  GetRadiusAttr(): UsdAttribute<number>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateRadiusAttr(value: number): UsdAttribute<number>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
  ComputeTriangulatedGeometry(time: UsdTimeCode, segments: number, rings: number): UsdGeomTriangulatedGeometry;
}
interface UsdGeomCylinder extends UsdGeomGprim {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetHeightAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusAttr(): UsdAttribute<number, number | FloatValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateAxisAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateHeightAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
  ComputeTriangulatedGeometry(time: UsdTimeCode, segments: number): UsdGeomTriangulatedGeometry;
}
interface UsdGeomCone extends UsdGeomGprim {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetHeightAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusAttr(): UsdAttribute<number, number | FloatValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateAxisAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateHeightAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
  ComputeTriangulatedGeometry(time: UsdTimeCode, segments: number): UsdGeomTriangulatedGeometry;
}
interface UsdGeomCapsule extends UsdGeomGprim {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetHeightAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusAttr(): UsdAttribute<number, number | FloatValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateAxisAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateHeightAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
  ComputeTriangulatedGeometry(time: UsdTimeCode, segments: number, capRings: number): UsdGeomTriangulatedGeometry;
}
interface UsdGeomCylinder_1 extends UsdGeomGprim {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetHeightAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusTopAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusBottomAttr(): UsdAttribute<number, number | FloatValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateAxisAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateHeightAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusTopAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusBottomAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
  ComputeTriangulatedGeometry(time: UsdTimeCode, segments: number): UsdGeomTriangulatedGeometry;
}
interface UsdGeomCapsule_1 extends UsdGeomGprim {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetHeightAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusTopAttr(): UsdAttribute<number, number | FloatValue>;
  GetRadiusBottomAttr(): UsdAttribute<number, number | FloatValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateAxisAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateHeightAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusTopAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateRadiusBottomAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
  ComputeTriangulatedGeometry(time: UsdTimeCode, segments: number, capRings: number): UsdGeomTriangulatedGeometry;
}
interface UsdGeomPlane extends UsdGeomGprim {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetWidthAttr(): UsdAttribute<number, number | FloatValue>;
  GetLengthAttr(): UsdAttribute<number, number | FloatValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  CreateAxisAttr(value: string): UsdAttribute<string, string | TokenValue>;
  CreateWidthAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateLengthAttr(value: number): UsdAttribute<number, number | FloatValue>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode): UsdGeomTriangulatedGeometry;
}
interface UsdGeomCamera extends UsdSchemaBase {
  GetProjectionAttr(): UsdAttribute<string, string | TokenValue>;
  GetHorizontalApertureAttr(): UsdAttribute<number, number | FloatValue>;
  GetVerticalApertureAttr(): UsdAttribute<number, number | FloatValue>;
  GetFocalLengthAttr(): UsdAttribute<number, number | FloatValue>;
  GetClippingRangeAttr(): UsdAttribute<Vec2, Vec2 | Vec2fValue>;
}
interface UsdGeomPrimvar<Read = UsdValue, Write = UsdValueInput> extends PxrDisposable {
  IsDefined(): boolean;
  IsValid(): boolean;
  HasValue(): boolean;
  HasAuthoredValue(): boolean;
  GetName(): string;
  GetPrimvarName(): string;
  GetTypeName(): string;
  GetInterpolation(): string;
  SetInterpolation(interpolation: string): boolean;
  GetElementSize(): number;
  SetElementSize(elementSize: number): boolean;
  GetAttr(): UsdAttribute<Read, Write>;
  Get(time: UsdTimeCode): Read | null;
  ComputeFlattened(time: UsdTimeCode): Read | null;
  Set(value: Write, time: UsdTimeCode): boolean;
  SetIndices(indices: readonly number[], time: UsdTimeCode): boolean;
  GetIndices(time: UsdTimeCode): number[] | null;
  BlockIndices(): void;
  IsIndexed(): boolean;
}
type UsdGeomPrimvarConstructor = PxrClass<UsdGeomPrimvar, [] | [UsdAttribute]>;
interface UsdGeomPrimvarsAPI extends UsdSchemaBase {
  CreatePrimvar<T extends SdfValueTypeName>(name: string, typeName: T): UsdGeomPrimvar<SdfReadValue<T>, SdfWriteValue<T>>;
  CreatePrimvar<T extends SdfValueTypeName>(name: string, typeName: T, interpolation: string): UsdGeomPrimvar<SdfReadValue<T>, SdfWriteValue<T>>;
  CreatePrimvar<T extends SdfValueTypeName>(name: string, typeName: T, interpolation: string, elementSize: number): UsdGeomPrimvar<SdfReadValue<T>, SdfWriteValue<T>>;
  GetPrimvar(name: string): UsdGeomPrimvar;
  GetPrimvars(): UsdGeomPrimvar[];
}
type UsdGeomPrimvarsAPIConstructor = PxrClass<UsdGeomPrimvarsAPI, [] | [UsdPrim]>;
interface UsdGeomMesh extends UsdSchemaBase {
  GetPointsAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  GetFaceVertexCountsAttr(): UsdAttribute<number[], IntArrayValue>;
  GetFaceVertexIndicesAttr(): UsdAttribute<number[], IntArrayValue>;
  GetDoubleSidedAttr(): UsdAttribute<boolean>;
  GetDisplayColorPrimvar(): UsdGeomPrimvar<Vec3[], Vec3fArrayValue>;
  GetDisplayOpacityPrimvar(): UsdGeomPrimvar<number[], FloatArrayValue>;
  GetNormalsAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  GetExtentAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreatePointsAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateFaceVertexCountsAttr(value: readonly number[]): UsdAttribute<number[], IntArrayValue>;
  CreateFaceVertexIndicesAttr(value: readonly number[]): UsdAttribute<number[], IntArrayValue>;
  CreateDoubleSidedAttr(value: boolean): UsdAttribute<boolean>;
  CreateDisplayColorAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateDisplayOpacityAttr(value: readonly number[]): UsdAttribute<number[], FloatArrayValue>;
  CreateNormalsAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  CreateExtentAttr(value: readonly Vec3[]): UsdAttribute<Vec3[], Vec3fArrayValue>;
  ComputeTriangulatedGeometry(time: UsdTimeCode, uvPrimvarName: string, uvTransformValue: UsdGeomUvTransform | null): UsdGeomTriangulatedGeometry;
}
interface UsdGeomUvTransform {
  scaleX?: number;
  scaleY?: number;
  translateX?: number;
  translateY?: number;
  rotation?: number;
}
interface UsdGeomBBoxCache extends PxrDisposable {
  ComputeWorldBound(prim: UsdPrim): GfBBox3d;
}
type UsdGeomBBoxCacheConstructor = PxrClass<UsdGeomBBoxCache, [UsdTimeCode, readonly string[]]>;
interface UsdGeomTokens extends Record<string, string> {
  x: string;
  y: string;
  z: string;
  rightHanded: string;
  leftHanded: string;
  default_: string;
  render: string;
  proxy: string;
  guide: string;
  constant: string;
  uniform: string;
  vertex: string;
  varying: string;
  faceVarying: string;
}
interface UsdGeomXformAnimationInfo {
  startTimeCode: number;
  endTimeCode: number;
  transforms: Array<{
    primPath: string;
    samples: Array<{
      time: number;
      localMatrix: number[];
    }>;
  }>;
}
interface PxrUsdGeomNamespace {
  Xform: UsdSchemaConstructor<UsdGeomXform>;
  Sphere: UsdSchemaConstructor<UsdGeomSphere>;
  Cube: UsdSchemaConstructor<UsdGeomCube>;
  Cylinder: UsdSchemaConstructor<UsdGeomCylinder>;
  Cone: UsdSchemaConstructor<UsdGeomCone>;
  Capsule: UsdSchemaConstructor<UsdGeomCapsule>;
  Cylinder_1: UsdSchemaConstructor<UsdGeomCylinder_1>;
  Capsule_1: UsdSchemaConstructor<UsdGeomCapsule_1>;
  Plane: UsdSchemaConstructor<UsdGeomPlane>;
  Camera: UsdSchemaConstructor<UsdGeomCamera>;
  Mesh: UsdSchemaConstructor<UsdGeomMesh>;
  Xformable: UsdGeomXformableConstructor;
  XformOp: UsdGeomXformOpConstructor;
  Primvar: UsdGeomPrimvarConstructor;
  PrimvarsAPI: UsdGeomPrimvarsAPIConstructor;
  BBoxCache: UsdGeomBBoxCacheConstructor;
  SetStageMetersPerUnit(stage: UsdStage, metersPerUnit: number): boolean;
  SetStageUpAxis(stage: UsdStage, axis: string): boolean;
  GetStageUpAxis(stage: UsdStage): string;
  ComputeXformAnimationInfo(prims: readonly UsdPrim[], stageStart: number, stageEnd: number, timeCodesPerSecond: number): UsdGeomXformAnimationInfo;
  Tokens: UsdGeomTokens;
}
interface UsdShadeInput<Read = UsdValue, Write = UsdValueInput> extends PxrDisposable {
  IsDefined(): boolean;
  IsValid(): boolean;
  GetFullName(): string;
  GetBaseName(): string;
  GetTypeName(): string;
  GetPrim(): UsdPrim;
  GetAttr(): UsdAttribute<Read, Write>;
  Get(time: UsdTimeCode): Read | null;
  Set(value: Write, time: UsdTimeCode): boolean;
  SetRenderType(renderType: string): boolean;
  GetRenderType(): string;
  HasRenderType(): boolean;
  ConnectToSource(sourcePath: PathLike): boolean;
  ConnectToSourceInput(source: UsdShadeInput): boolean;
  ConnectToSourceOutput(source: UsdShadeOutput): boolean;
  GetRawConnectedSourcePaths(): SdfPath[];
  HasConnectedSource(): boolean;
  DisconnectSource(): boolean;
  ClearSources(): boolean;
  ClearSource(): boolean;
  SetConnectability(connectability: string): boolean;
  GetConnectability(): string;
  ClearConnectability(): boolean;
  GetValueProducingAttributes(): UsdAttribute[];
  GetValueProducingAttributes(shaderOutputsOnly: boolean): UsdAttribute[];
}
interface UsdShadeOutput<Write = UsdValueInput> extends PxrDisposable {
  IsDefined(): boolean;
  IsValid(): boolean;
  GetFullName(): string;
  GetBaseName(): string;
  GetTypeName(): string;
  GetPrim(): UsdPrim;
  GetAttr(): UsdAttribute;
  Set(value: Write, time: UsdTimeCode): boolean;
  SetRenderType(renderType: string): boolean;
  GetRenderType(): string;
  HasRenderType(): boolean;
  ConnectToSource(sourcePath: PathLike): boolean;
  ConnectToSourceInput(source: UsdShadeInput): boolean;
  ConnectToSourceOutput(source: UsdShadeOutput): boolean;
  GetRawConnectedSourcePaths(): SdfPath[];
  HasConnectedSource(): boolean;
  DisconnectSource(): boolean;
  ClearSources(): boolean;
  ClearSource(): boolean;
  GetValueProducingAttributes(): UsdAttribute[];
  GetValueProducingAttributes(shaderOutputsOnly: boolean): UsdAttribute[];
}
type UsdShadeInputConstructor = PxrClass<UsdShadeInput, [] | [UsdAttribute]>;
type UsdShadeOutputConstructor = PxrClass<UsdShadeOutput, [] | [UsdAttribute]>;
interface UsdShadeConnectableAPI extends UsdSchemaBase {
  CreateInput<T extends SdfValueTypeName>(name: string, typeName: T): UsdShadeInput<SdfReadValue<T>, SdfWriteValue<T>>;
  GetInput(name: string): UsdShadeInput;
  GetInputs(): UsdShadeInput[];
  GetInputs(onlyAuthored: boolean): UsdShadeInput[];
  CreateOutput<T extends SdfValueTypeName>(name: string, typeName: T): UsdShadeOutput<SdfWriteValue<T>>;
  GetOutput(name: string): UsdShadeOutput;
  GetOutputs(): UsdShadeOutput[];
  GetOutputs(onlyAuthored: boolean): UsdShadeOutput[];
}
type UsdShadeConnectableAPIConstructor = PxrClass<UsdShadeConnectableAPI, [] | [UsdPrim]>;
interface UsdShadeConnectableSchema extends UsdSchemaBase {
  ConnectableAPI(): UsdShadeConnectableAPI;
  CreateInput<T extends SdfValueTypeName>(name: string, typeName: T): UsdShadeInput<SdfReadValue<T>, SdfWriteValue<T>>;
  GetInput(name: string): UsdShadeInput;
  GetInputs(): UsdShadeInput[];
  GetInputs(onlyAuthored: boolean): UsdShadeInput[];
  CreateOutput<T extends SdfValueTypeName>(name: string, typeName: T): UsdShadeOutput<SdfWriteValue<T>>;
  GetOutput(name: string): UsdShadeOutput;
  GetOutputs(): UsdShadeOutput[];
  GetOutputs(onlyAuthored: boolean): UsdShadeOutput[];
}
interface UsdShadeShader extends UsdShadeConnectableSchema {
  SetShaderId(id: string): boolean;
  GetShaderId(): string;
  GetImplementationSource(): string;
  GetIdAttr(): UsdAttribute<string, string | TokenValue>;
  CreateIdAttr(): UsdAttribute<string, string | TokenValue>;
  CreateIdAttr(defaultValue: string | TokenValue): UsdAttribute<string, string | TokenValue>;
  SetSourceAsset(sourceAsset: SdfAssetPath): boolean;
  SetSourceAsset(sourceAsset: SdfAssetPath, sourceType: string): boolean;
  GetSourceAsset(): SdfAssetPath;
  GetSourceAsset(sourceType: string): SdfAssetPath;
  SetSourceAssetSubIdentifier(subIdentifier: string): boolean;
  SetSourceAssetSubIdentifier(subIdentifier: string, sourceType: string): boolean;
  GetSourceAssetSubIdentifier(): string;
  GetSourceAssetSubIdentifier(sourceType: string): string;
  GetSourceTypes(): string[];
}
interface UsdShadeMaterial extends UsdShadeConnectableSchema {
  CreateSurfaceOutput(): UsdShadeOutput;
  CreateSurfaceOutput(renderContext: string): UsdShadeOutput;
  GetSurfaceOutput(): UsdShadeOutput;
  GetSurfaceOutput(renderContext: string): UsdShadeOutput;
  GetSurfaceOutputs(): UsdShadeOutput[];
  ComputeSurfaceSource(): [UsdShadeShader, string, 'input' | 'output' | 'invalid'];
  ComputeSurfaceSource(renderContexts: string | readonly string[]): [UsdShadeShader, string, 'input' | 'output' | 'invalid'];
}
interface UsdShadeMaterialBindingAPI extends UsdSchemaBase {
  GetDirectBindingRel(): UsdRelationship;
  GetDirectBindingRel(materialPurpose: string): UsdRelationship;
  Bind(material: UsdShadeMaterial): boolean;
  Bind(material: UsdShadeMaterial, bindingStrength: string, materialPurpose: string): boolean;
  UnbindDirectBinding(): boolean;
  UnbindDirectBinding(materialPurpose: string): boolean;
  UnbindAllBindings(): boolean;
  ComputeBoundMaterial(): [UsdShadeMaterial, UsdRelationship];
  ComputeBoundMaterial(materialPurpose: string): [UsdShadeMaterial, UsdRelationship];
  ComputeBoundMaterial(materialPurpose: string, supportLegacyBindings: boolean): [UsdShadeMaterial, UsdRelationship];
}
interface UsdShadeMaterialBindingAPIConstructor extends PxrClass<UsdShadeMaterialBindingAPI, [] | [UsdPrim]> {
  Apply(prim: UsdPrim): UsdShadeMaterialBindingAPI;
  CanApply(prim: UsdPrim): boolean;
  GetResolvedTargetPathFromBindingRel(bindingRel: UsdRelationship): SdfPath;
}
interface UsdShadeBoundMaterialPathInfo {
  materialPath: string;
  bindingRelationshipPath: string;
  resolvedTargetPath: string;
}
interface UsdShadeMaterialInfo {
  path: string;
  inputs: Record<string, UsdValue>;
  shaders: Array<{
    path: string;
    id: string | null;
    inputs: Record<string, UsdValue>;
  }>;
  textureInfo: UsdShadeTextureInfo;
}
interface UsdShadeTextureInfo {
  uvPrimvar: string;
  uvTransform: UsdGeomUvTransform | null;
}
interface UsdShadeShaderSourceInfo {
  shaderPath: string;
  inputs: Record<string, UsdValue>;
  sourceAssets: Record<string, SdfAssetPathValue>;
}
interface UsdShadeTokens extends Record<string, string> {}
interface PxrUsdShadeNamespace {
  Material: UsdSchemaConstructor<UsdShadeMaterial>;
  Shader: UsdSchemaConstructor<UsdShadeShader>;
  Input: UsdShadeInputConstructor;
  Output: UsdShadeOutputConstructor;
  ConnectableAPI: UsdShadeConnectableAPIConstructor;
  MaterialBindingAPI: UsdShadeMaterialBindingAPIConstructor;
  ComputeBoundMaterialPath(prim: UsdPrim): UsdShadeBoundMaterialPathInfo;
  ComputeBoundMaterialPath(prim: UsdPrim, materialPurpose: string): UsdShadeBoundMaterialPathInfo;
  ComputeBoundMaterialPath(prim: UsdPrim, materialPurpose: string, supportLegacyBindings: boolean): UsdShadeBoundMaterialPathInfo;
  ComputeMaterialInfo(prim: UsdPrim, time: UsdTimeCode): UsdShadeMaterialInfo;
  ComputeMaterialTextureInfo(prim: UsdPrim, time: UsdTimeCode): UsdShadeTextureInfo;
  ComputeGeomSubsetMaterialFallback(prim: UsdPrim): string;
  Tokens: UsdShadeTokens;
}
interface UsdPhysicsApiSchema extends UsdSchemaBase {}
interface UsdPhysicsApiConstructor<T extends UsdPhysicsApiSchema> extends PxrClass<T, [] | [UsdPrim]> {
  Apply(prim: UsdPrim): T;
}
interface UsdPhysicsCollisionAPI extends UsdPhysicsApiSchema {
  GetCollisionEnabledAttr(): UsdAttribute<boolean>;
}
interface UsdPhysicsMeshCollisionAPI extends UsdPhysicsApiSchema {
  GetApproximationAttr(): UsdAttribute<string, string | TokenValue>;
}
interface UsdPhysicsRigidBodyAPI extends UsdPhysicsApiSchema {
  GetRigidBodyEnabledAttr(): UsdAttribute<boolean>;
  GetKinematicEnabledAttr(): UsdAttribute<boolean>;
  GetStartsAsleepAttr(): UsdAttribute<boolean>;
  GetVelocityAttr(): UsdAttribute<Vec3, Vec3fValue>;
  GetAngularVelocityAttr(): UsdAttribute<Vec3, Vec3fValue>;
}
interface UsdPhysicsMassAPI extends UsdPhysicsApiSchema {
  GetMassAttr(): UsdAttribute<number, number | FloatValue>;
  GetDensityAttr(): UsdAttribute<number, number | FloatValue>;
  GetCenterOfMassAttr(): UsdAttribute<Vec3, Vec3fValue>;
  GetDiagonalInertiaAttr(): UsdAttribute<Vec3, Vec3fValue>;
  GetPrincipalAxesAttr(): UsdAttribute<GfQuatValue, QuatfValue | QuatdValue>;
}
interface UsdPhysicsMaterialAPI extends UsdPhysicsApiSchema {
  GetStaticFrictionAttr(): UsdAttribute<number, number | FloatValue>;
  GetDynamicFrictionAttr(): UsdAttribute<number, number | FloatValue>;
  GetRestitutionAttr(): UsdAttribute<number, number | FloatValue>;
  GetDensityAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsScene extends UsdSchemaBase {
  GetGravityDirectionAttr(): UsdAttribute<Vec3, Vec3fValue>;
  GetGravityMagnitudeAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsSceneConstructor extends PxrClass<UsdPhysicsScene, [] | [UsdPrim]> {
  Define(stage: UsdStage, path: string): UsdPhysicsScene;
}
interface UsdPhysicsArticulationRootAPI extends UsdPhysicsApiSchema {}
interface UsdPhysicsJoint extends UsdSchemaBase {
  GetLocalPos0Attr(): UsdAttribute<Vec3, Vec3fValue>;
  GetLocalRot0Attr(): UsdAttribute<GfQuatValue, QuatfValue | QuatdValue>;
  GetLocalPos1Attr(): UsdAttribute<Vec3, Vec3fValue>;
  GetLocalRot1Attr(): UsdAttribute<GfQuatValue, QuatfValue | QuatdValue>;
  GetJointEnabledAttr(): UsdAttribute<boolean>;
  GetCollisionEnabledAttr(): UsdAttribute<boolean>;
  GetExcludeFromArticulationAttr(): UsdAttribute<boolean>;
  GetBreakForceAttr(): UsdAttribute<number, number | FloatValue>;
  GetBreakTorqueAttr(): UsdAttribute<number, number | FloatValue>;
  GetBody0Rel(): UsdRelationship;
  GetBody1Rel(): UsdRelationship;
}
type UsdPhysicsJointConstructor<T extends UsdPhysicsJoint = UsdPhysicsJoint> = PxrClass<T, [] | [UsdPrim]>;
interface UsdPhysicsAxisLimitedJoint extends UsdPhysicsJoint {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetLowerLimitAttr(): UsdAttribute<number, number | FloatValue>;
  GetUpperLimitAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsSphericalJoint extends UsdPhysicsJoint {
  GetAxisAttr(): UsdAttribute<string, string | TokenValue>;
  GetConeAngle0LimitAttr(): UsdAttribute<number, number | FloatValue>;
  GetConeAngle1LimitAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsDistanceJoint extends UsdPhysicsJoint {
  GetMinDistanceAttr(): UsdAttribute<number, number | FloatValue>;
  GetMaxDistanceAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsLimitAPI extends UsdSchemaBase {
  GetName(): string;
  GetLowAttr(): UsdAttribute<number, number | FloatValue>;
  GetHighAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsLimitAPIConstructor extends PxrClass<UsdPhysicsLimitAPI, [] | [UsdPrim, string]> {
  Apply(prim: UsdPrim, name: string): UsdPhysicsLimitAPI;
  GetAll(prim: UsdPrim): UsdPhysicsLimitAPI[];
}
interface UsdPhysicsDriveAPI extends UsdSchemaBase {
  GetName(): string;
  GetTypeAttr(): UsdAttribute<string, string | TokenValue>;
  GetMaxForceAttr(): UsdAttribute<number, number | FloatValue>;
  GetTargetPositionAttr(): UsdAttribute<number, number | FloatValue>;
  GetTargetVelocityAttr(): UsdAttribute<number, number | FloatValue>;
  GetDampingAttr(): UsdAttribute<number, number | FloatValue>;
  GetStiffnessAttr(): UsdAttribute<number, number | FloatValue>;
}
interface UsdPhysicsDriveAPIConstructor extends PxrClass<UsdPhysicsDriveAPI, [] | [UsdPrim, string]> {
  Apply(prim: UsdPrim, name: string): UsdPhysicsDriveAPI;
}
interface UsdPhysicsDriveInfo {
  dof: string;
  type: string | null;
  targetPosition: number | null;
  targetVelocity: number | null;
  stiffness: number | null;
  damping: number | null;
  maxForce: number | null;
}
interface UsdPhysicsLimitInfo {
  dof: string;
  low: number | null;
  high: number | null;
}
interface UsdPhysicsJointInfo {
  path: string;
  name: string;
  typeName: string;
  jointType: string;
  body0: string | null;
  body1: string | null;
  axis: string | null;
  localPos0: Vec3;
  localPos1: Vec3;
  localRot0: Vec4 | null;
  localRot1: Vec4 | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  enabled: boolean;
  collisionEnabled: boolean;
  excludeFromArticulation: boolean;
  breakForce: number | null;
  breakTorque: number | null;
  limits: UsdPhysicsLimitInfo[];
  drive: UsdPhysicsDriveInfo | null;
  drives: Record<string, UsdPhysicsDriveInfo>;
}
interface UsdPhysicsModelPhysicsInfo {
  scenes: Array<{
    path: string;
    name: string;
    gravityDirection: Vec3 | null;
    gravityMagnitude: number | null;
  }>;
  rigidBodies: Array<{
    path: string;
    name: string;
    typeName: string;
    enabled: boolean;
    kinematicEnabled: boolean;
    startsAsleep: boolean | null;
    velocity: Vec3 | null;
    angularVelocity: Vec3 | null;
    mass: UsdValue;
  }>;
  colliders: Array<{
    path: string;
    name: string;
    typeName: string;
    bodyPath: string | null;
    enabled: boolean;
    approximation: string | null;
    material: string | null;
  }>;
  materials: Array<{
    path: string;
    name: string;
    staticFriction: number | null;
    dynamicFriction: number | null;
    restitution: number | null;
    density: number | null;
  }>;
  articulationRoots: Array<{
    path: string;
    name: string;
    joints: string[];
  }>;
}
interface PxrUsdPhysicsNamespace {
  CollisionAPI: UsdPhysicsApiConstructor<UsdPhysicsCollisionAPI>;
  MeshCollisionAPI: UsdPhysicsApiConstructor<UsdPhysicsMeshCollisionAPI>;
  RigidBodyAPI: UsdPhysicsApiConstructor<UsdPhysicsRigidBodyAPI>;
  MassAPI: UsdPhysicsApiConstructor<UsdPhysicsMassAPI>;
  MaterialAPI: UsdPhysicsApiConstructor<UsdPhysicsMaterialAPI>;
  Scene: UsdPhysicsSceneConstructor;
  ArticulationRootAPI: UsdPhysicsApiConstructor<UsdPhysicsArticulationRootAPI>;
  Joint: UsdPhysicsJointConstructor;
  FixedJoint: UsdPhysicsJointConstructor;
  RevoluteJoint: UsdPhysicsJointConstructor<UsdPhysicsAxisLimitedJoint>;
  PrismaticJoint: UsdPhysicsJointConstructor<UsdPhysicsAxisLimitedJoint>;
  SphericalJoint: UsdPhysicsJointConstructor<UsdPhysicsSphericalJoint>;
  DistanceJoint: UsdPhysicsJointConstructor<UsdPhysicsDistanceJoint>;
  LimitAPI: UsdPhysicsLimitAPIConstructor;
  DriveAPI: UsdPhysicsDriveAPIConstructor;
  ComputeModelJoints(prims: readonly UsdPrim[], time: UsdTimeCode): UsdPhysicsJointInfo[];
  ComputeModelPhysics(prims: readonly UsdPrim[], time: UsdTimeCode, joints: readonly UsdPhysicsJointInfo[]): UsdPhysicsModelPhysicsInfo;
}
interface UsdSkelRoot extends UsdSchemaBase {}
interface UsdSkelRootConstructor extends PxrClass<UsdSkelRoot, [] | [UsdPrim]> {
  Define(stage: UsdStage, path: PathLike): UsdSkelRoot;
}
interface UsdSkelSkeleton extends UsdSchemaBase {
  GetJointsAttr(): UsdAttribute<string[], TokenArrayValue>;
  GetBindTransformsAttr(): UsdAttribute<Matrix4[], UsdValueInput>;
  GetRestTransformsAttr(): UsdAttribute<Matrix4[], UsdValueInput>;
}
interface UsdSkelSkeletonConstructor extends PxrClass<UsdSkelSkeleton, [] | [UsdPrim]> {
  Define(stage: UsdStage, path: PathLike): UsdSkelSkeleton;
}
interface UsdSkelSkeletonQuery extends PxrDisposable {
  IsValid(): boolean;
  GetPrim(): UsdPrim;
  GetSkeleton(): UsdSkelSkeleton;
  GetJointOrder(): string[];
  GetJointWorldBindTransforms(): Matrix4[];
  ComputeJointLocalTransforms(time: UsdTimeCode): Matrix4[];
  ComputeJointLocalTransforms(time: UsdTimeCode, atRest: boolean): Matrix4[];
  ComputeJointSkelTransforms(time: UsdTimeCode): Matrix4[];
  ComputeJointSkelTransforms(time: UsdTimeCode, atRest: boolean): Matrix4[];
  ComputeSkinningTransforms(time: UsdTimeCode): Matrix4[];
  HasBindPose(): boolean;
  HasRestPose(): boolean;
}
type UsdSkelSkeletonQueryConstructor = PxrClass<UsdSkelSkeletonQuery, []>;
interface UsdSkelJointInfluences {
  jointIndices: number[];
  jointWeights: number[];
  elementSize: number;
}
interface UsdSkelSkinningQuery extends PxrDisposable {
  IsValid(): boolean;
  HasJointInfluences(): boolean;
  HasBlendShapes(): boolean;
  GetNumInfluencesPerComponent(): number;
  GetInterpolation(): string;
  IsRigidlyDeformed(): boolean;
  GetPrim(): UsdPrim;
  GetJointOrder(): string[];
  GetGeomBindTransform(time: UsdTimeCode): Matrix4;
  ComputeJointInfluences(time: UsdTimeCode): UsdSkelJointInfluences | null;
  ComputeVaryingJointInfluences(numPoints: number, time: UsdTimeCode): UsdSkelJointInfluences | null;
}
type UsdSkelSkinningQueryConstructor = PxrClass<UsdSkelSkinningQuery, []>;
interface UsdSkelCache extends PxrDisposable {
  Clear(): void;
  Populate(root: UsdPrim): boolean;
  GetSkelQuery(prim: UsdPrim): UsdSkelSkeletonQuery;
  GetSkinningQuery(prim: UsdPrim): UsdSkelSkinningQuery;
}
type UsdSkelCacheConstructor = PxrClass<UsdSkelCache, []>;
interface UsdSkelAnimation extends UsdSchemaBase {
  GetJointsAttr(): UsdAttribute<string[], TokenArrayValue>;
  GetTranslationsAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  GetRotationsAttr(): UsdAttribute<GfQuatValue[], UsdValueInput>;
  GetScalesAttr(): UsdAttribute<Vec3[], Vec3fArrayValue>;
  GetBlendShapesAttr(): UsdAttribute<string[], TokenArrayValue>;
  GetBlendShapeWeightsAttr(): UsdAttribute<number[], FloatArrayValue>;
}
interface UsdSkelAnimationConstructor extends PxrClass<UsdSkelAnimation, [] | [UsdPrim]> {
  Define(stage: UsdStage, path: PathLike): UsdSkelAnimation;
}
interface UsdSkelBindingAPI extends UsdSchemaBase {
  GetJointsAttr(): UsdAttribute<string[], TokenArrayValue>;
  GetJointIndicesAttr(): UsdAttribute<number[], IntArrayValue>;
  GetJointWeightsAttr(): UsdAttribute<number[], FloatArrayValue>;
  GetGeomBindTransformAttr(): UsdAttribute<Matrix4, Matrix4dValue>;
  GetSkeletonRel(): UsdRelationship;
  GetAnimationSourceRel(): UsdRelationship;
  GetInheritedSkeleton(): UsdSkelSkeleton;
  GetInheritedAnimationSource(): UsdPrim;
  GetBlendShapesAttr(): UsdAttribute<string[], TokenArrayValue>;
  GetBlendShapeTargetsRel(): UsdRelationship;
}
interface UsdSkelBindingAPIConstructor extends PxrClass<UsdSkelBindingAPI, [] | [UsdPrim]> {
  Apply(prim: UsdPrim): UsdSkelBindingAPI;
}
interface UsdSkelTokens extends Record<string, string> {
  SkelRoot: string;
  Skeleton: string;
  SkelAnimation: string;
  joints: string;
  bindTransforms: string;
  restTransforms: string;
  animationSource: string;
  translations: string;
  rotations: string;
  scales: string;
  skelSkeleton: string;
  skelJoints: string;
  skelJointIndices: string;
  skelJointWeights: string;
  skelGeomBindTransform: string;
  blendShapes: string;
  blendShapeWeights: string;
}
interface UsdSkelAnimationSample {
  time: number;
  values: UsdValue;
}
interface UsdSkelSkeletonInfo {
  path: string;
  joints: string[];
  bindTransforms: Matrix4[];
  restTransforms: Matrix4[];
  restSkelTransforms: Matrix4[];
}
interface UsdSkelBindingInfo {
  primPath: string;
  skeletonPath: string | null;
  animationSource: string | null;
  joints: string[];
  jointIndices: number[];
  jointWeights: number[];
  elementSize: number;
  geomBindTransform: Matrix4 | null;
}
interface UsdSkelAnimationInfo {
  path: string;
  name: string;
  joints: string[];
  translations: UsdSkelAnimationSample[];
  rotations: UsdSkelAnimationSample[];
  scales: UsdSkelAnimationSample[];
  jointSkelTransformSamples?: Array<{
    skeletonPath: string;
    samples: UsdSkelAnimationSample[];
  }>;
  _sampleFrames: number[];
}
interface UsdSkelModelSkelsInfo {
  skeletons: UsdSkelSkeletonInfo[];
  bindings: UsdSkelBindingInfo[];
  animations: UsdSkelAnimationInfo[];
}
interface PxrUsdSkelNamespace {
  Root: UsdSkelRootConstructor;
  Skeleton: UsdSkelSkeletonConstructor;
  SkeletonQuery: UsdSkelSkeletonQueryConstructor;
  SkinningQuery: UsdSkelSkinningQueryConstructor;
  Cache: UsdSkelCacheConstructor;
  Animation: UsdSkelAnimationConstructor;
  BindingAPI: UsdSkelBindingAPIConstructor;
  ComputeModelSkels(prims: readonly UsdPrim[], time: UsdTimeCode, startTimeCode: number, endTimeCode: number, timeCodesPerSecond: number): UsdSkelModelSkelsInfo;
  Tokens: UsdSkelTokens;
}
interface UsdUtilsExtractExternalReferencesParams extends PxrDisposable {
  SetResolveUdimPaths(value: boolean): void;
  GetResolveUdimPaths(): boolean;
}
type UsdUtilsExtractExternalReferencesParamsConstructor = PxrClass<UsdUtilsExtractExternalReferencesParams, []>;
interface UsdUtilsExternalReferences {
  subLayers: string[];
  references: string[];
  payloads: string[];
}
interface UsdUtilsDependencies {
  ok: boolean;
  layers: SdfLayer[];
  assets: string[];
  unresolvedPaths: string[];
}
interface UsdUtilsPackageEntry {
  path: string;
  data: Uint8Array;
}
interface PxrUsdUtilsNamespace {
  ExtractExternalReferencesParams: UsdUtilsExtractExternalReferencesParamsConstructor;
  ExtractExternalReferences(filePath: string): UsdUtilsExternalReferences;
  ExtractExternalReferences(filePath: string, params: UsdUtilsExtractExternalReferencesParams): UsdUtilsExternalReferences;
  ExtractSanitizedExternalReferences(filePath: string): string[];
  ComputeAllDependencies(assetPath: string): UsdUtilsDependencies;
  ExtractUsdzPackage(usdzFile: string, extractDir: string): boolean;
  ExtractUsdzPackage(usdzFile: string, extractDir: string, recurse: boolean, verbose: boolean, force: boolean): boolean;
  GetPackageEntries(filePath: string): UsdUtilsPackageEntry[];
  GetPackageEntries(filePath: string, tempDirectory: string, maxDepth: number): UsdUtilsPackageEntry[];
  FindPackageRootLayer(filePath: string): string | null;
  CreateNewUsdzPackage(assetPath: string, usdzFilePath: string): boolean;
  CreateNewUsdzPackage(assetPath: string, usdzFilePath: string, firstLayerName: string): boolean;
  CreateNewUsdzPackage(assetPath: string, usdzFilePath: string, firstLayerName: string, editLayersInPlace: boolean): boolean;
  CreateNewARKitUsdzPackage(assetPath: string, usdzFilePath: string): boolean;
  CreateNewARKitUsdzPackage(assetPath: string, usdzFilePath: string, firstLayerName: string): boolean;
  CreateNewARKitUsdzPackage(assetPath: string, usdzFilePath: string, firstLayerName: string, editLayersInPlace: boolean): boolean;
  LocalizeAsset(assetPath: string, localizationDir: string): boolean;
  LocalizeAsset(assetPath: string, localizationDir: string, editLayersInPlace: boolean): boolean;
  ModifyAssetPaths(layer: SdfLayer, modifyFn: (assetPath: string) => string | null | undefined): void;
  ModifyAssetPaths(layer: SdfLayer, modifyFn: (assetPath: string) => string | null | undefined, keepEmptyPathsInArrays: boolean): void;
}
//#endregion
//#region src/modules/index.d.ts
interface PxrModuleMap {
  Gf: PxrGfNamespace;
  Sdf: PxrSdfNamespace;
  Usd: PxrUsdNamespace;
  UsdGeom: PxrUsdGeomNamespace;
  UsdPhysics: PxrUsdPhysicsNamespace;
  UsdSkel: PxrUsdSkelNamespace;
  UsdShade: PxrUsdShadeNamespace;
  UsdUtils: PxrUsdUtilsNamespace;
}
//#endregion
//#region src/index.d.ts
interface PxrFsListEntry {
  name: string;
  path: string;
  mode: number;
  size: number;
  isDir: boolean;
  isFile: boolean;
}
interface PxrFsHelpers {
  raw: EmscriptenFs;
  mkdirp(path: string): void;
  createDir(path: string): void;
  deleteDir(path: string): void;
  listDir(path: string): PxrFsListEntry[];
  mount(mount: Record<string, unknown>): void;
  mount(fsType: string, options: Record<string, unknown>, mountPoint: string): void;
  unmount(mountPoint: string): void;
  mountNodeFS(mountPoint: string, root?: string): void;
  mountWorkerFS(mountPoint: string, options?: Record<string, unknown>): void;
  mountIDBFS(mountPoint: string, options?: Record<string, unknown>): void;
  writeFile(path: string, data: string | ArrayBuffer | ArrayBufferView): void;
  readFile(path: string, encodingOrOpts?: "binary" | "utf8" | "utf-8" | Record<string, unknown>): unknown;
  exists(path: string): boolean;
  deleteFile(path: string): void;
  unlink(path: string): void;
  rename(oldPath: string, newPath: string): void;
  renameFile(oldPath: string, newPath: string): void;
  syncfs(populate?: boolean): Promise<void>;
}
interface Pxr extends PxrModuleMap {
  _module: WasmModule;
  FS: PxrFsHelpers;
  using<T extends PxrDisposable>(value: T): T;
  load(options?: PXRLoadOptions): Promise<PXR>;
}
interface PXRLoadOptions {
  baseURL?: string | URL;
  mounts?: Array<Record<string, unknown>>;
  files?: Record<string, string | ArrayBuffer | ArrayBufferView>;
  preRun?: Function | Function[];
  ENV?: Record<string, unknown>;
  print?: (message: unknown) => void;
  printErr?: (message: unknown) => void;
}
declare class PXR implements Pxr {
  private _loadPromise;
  private _runtime;
  get _module(): WasmModule;
  get FS(): PxrFsHelpers;
  get Gf(): PxrModuleMap["Gf"];
  get Sdf(): PxrModuleMap["Sdf"];
  get Usd(): PxrModuleMap["Usd"];
  get UsdGeom(): PxrModuleMap["UsdGeom"];
  get UsdPhysics(): PxrModuleMap["UsdPhysics"];
  get UsdSkel(): PxrModuleMap["UsdSkel"];
  get UsdShade(): PxrModuleMap["UsdShade"];
  get UsdUtils(): PxrModuleMap["UsdUtils"];
  get using(): Pxr["using"];
  get loaded(): boolean;
  load(options?: PXRLoadOptions): Promise<this>;
}
//#endregion
export { type AssetArrayValue, type AssetValue, type DoubleArrayValue, type EmscriptenFs, type FloatArrayValue, type FloatValue, type GfBBox3d, type GfBBox3dConstructor, type GfMatrix, type GfMatrixConstructor, type GfQuat, type GfQuatConstructor, type GfQuatValue, type GfRange, type GfRangeConstructor, type GfVec, type GfVecConstructor, type IntArrayValue, type IntValue, type Matrix3, type Matrix4, type Matrix4dValue, PXR, PXR as default, PXRLoadOptions, type PathLike, type PathValue, Pxr, type PxrBindingObject, type PxrClass, type PxrDisposable, PxrFsHelpers, PxrFsListEntry, type PxrFunction, type PxrGfNamespace, type PxrInstance, type PxrModuleMap, type PxrModuleName, type PxrNamespace, type PxrNamespaceValue, type PxrSdfNamespace, type PxrUsdGeomNamespace, type PxrUsdNamespace, type PxrUsdPhysicsNamespace, type PxrUsdShadeNamespace, type PxrUsdSkelNamespace, type PxrUsdUtilsNamespace, type QuatdValue, type QuatfValue, type SdfAssetPath, type SdfAssetPathConstructor, type SdfAssetPathValue, type SdfLayer, type SdfLayerConstructor, type SdfPath, type SdfPathConstructor, type SdfPrimSpec, type SdfPrimSpecConstructor, type SdfReadValue, type SdfValueTypeName, type SdfValueTypeNameConstructor, type SdfValueTypeNames, type SdfWriteValue, type SdfZipFile, type SdfZipFileConstructor, type SdfZipFileInfo, type SdfZipFileInfoConstructor, type SdfZipFileWriter, type SdfZipFileWriterConstructor, type StringArrayValue, type TokenArrayValue, type TokenValue, type TypedUsdValue, type UnsupportedUsdValue, type UsdAttribute, type UsdAttributeConstructor, type UsdDictionary, type UsdDictionaryInput, type UsdGeomBBoxCache, type UsdGeomBBoxCacheConstructor, type UsdGeomCamera, type UsdGeomCapsule, type UsdGeomCapsule_1, type UsdGeomCone, type UsdGeomCube, type UsdGeomCylinder, type UsdGeomCylinder_1, type UsdGeomGprim, type UsdGeomLocalTransformation, type UsdGeomMesh, type UsdGeomPlane, type UsdGeomPrimvar, type UsdGeomPrimvarConstructor, type UsdGeomPrimvarsAPI, type UsdGeomPrimvarsAPIConstructor, type UsdGeomSphere, type UsdGeomTokens, type UsdGeomTriangulatedGeometry, type UsdGeomUvTransform, type UsdGeomXform, type UsdGeomXformAnimationInfo, type UsdGeomXformOp, type UsdGeomXformOpConstructor, type UsdGeomXformable, type UsdGeomXformableConstructor, type UsdPayloads, type UsdPayloadsConstructor, type UsdPhysicsApiConstructor, type UsdPhysicsApiSchema, type UsdPhysicsArticulationRootAPI, type UsdPhysicsAxisLimitedJoint, type UsdPhysicsCollisionAPI, type UsdPhysicsDistanceJoint, type UsdPhysicsDriveAPI, type UsdPhysicsDriveAPIConstructor, type UsdPhysicsDriveInfo, type UsdPhysicsJoint, type UsdPhysicsJointConstructor, type UsdPhysicsJointInfo, type UsdPhysicsLimitAPI, type UsdPhysicsLimitAPIConstructor, type UsdPhysicsLimitInfo, type UsdPhysicsMassAPI, type UsdPhysicsMaterialAPI, type UsdPhysicsMeshCollisionAPI, type UsdPhysicsModelPhysicsInfo, type UsdPhysicsRigidBodyAPI, type UsdPhysicsScene, type UsdPhysicsSceneConstructor, type UsdPhysicsSphericalJoint, type UsdPrim, type UsdPrimConstructor, type UsdReferences, type UsdReferencesConstructor, type UsdRelationship, type UsdRelationshipConstructor, type UsdSchemaBase, type UsdSchemaConstructor, type UsdShadeBoundMaterialPathInfo, type UsdShadeConnectableAPI, type UsdShadeConnectableAPIConstructor, type UsdShadeConnectableSchema, type UsdShadeInput, type UsdShadeInputConstructor, type UsdShadeMaterial, type UsdShadeMaterialBindingAPI, type UsdShadeMaterialBindingAPIConstructor, type UsdShadeMaterialInfo, type UsdShadeOutput, type UsdShadeOutputConstructor, type UsdShadeShader, type UsdShadeShaderSourceInfo, type UsdShadeTextureInfo, type UsdShadeTokens, type UsdSkelAnimation, type UsdSkelAnimationConstructor, type UsdSkelAnimationInfo, type UsdSkelAnimationSample, type UsdSkelBindingAPI, type UsdSkelBindingAPIConstructor, type UsdSkelBindingInfo, type UsdSkelCache, type UsdSkelCacheConstructor, type UsdSkelJointInfluences, type UsdSkelModelSkelsInfo, type UsdSkelRoot, type UsdSkelRootConstructor, type UsdSkelSkeleton, type UsdSkelSkeletonConstructor, type UsdSkelSkeletonInfo, type UsdSkelSkeletonQuery, type UsdSkelSkeletonQueryConstructor, type UsdSkelSkinningQuery, type UsdSkelSkinningQueryConstructor, type UsdSkelTokens, type UsdStage, type UsdStageConstructor, type UsdTimeCode, type UsdTimeCodeConstructor, type UsdUtilsDependencies, type UsdUtilsExternalReferences, type UsdUtilsExtractExternalReferencesParams, type UsdUtilsExtractExternalReferencesParamsConstructor, type UsdUtilsPackageEntry, type UsdValue, type UsdValueInput, type UsdVariantSet, type UsdVariantSetConstructor, type UsdVariantSets, type UsdVariantSetsConstructor, type Vec2, type Vec2dValue, type Vec2fArrayValue, type Vec2fValue, type Vec3, type Vec3dArrayValue, type Vec3dValue, type Vec3fArrayValue, type Vec3fValue, type Vec4, type Vec4dValue, type Vec4fValue, type WasmModule };