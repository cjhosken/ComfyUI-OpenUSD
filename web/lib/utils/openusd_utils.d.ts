import { Pxr } from "@openusd-wasm/pxr";

//#region src/types.d.ts
interface USDAssetResolverOptions {
  sourcePath?: string;
  fileName?: string;
  autoResolveAssets?: boolean;
  assetSearchExtensions?: string[];
  assetSearchRoots?: string[];
  maxAssetReferences?: number;
  maxAssetReferenceDepth?: number;
}
interface USDAssetValue {
  path?: string;
  resolvedPath?: string;
  url?: string;
}
interface USDTextureResolverContext<TMaterial = unknown, TShader = unknown> {
  sourcePath: string;
  material?: TMaterial;
  shader?: TShader;
}
type USDTextureResolver<TMaterial = unknown, TShader = unknown> = (asset: USDAssetValue, context: USDTextureResolverContext<TMaterial, TShader>) => string | null | undefined;
//#endregion
//#region src/asset-resolver.d.ts
declare function toLayerRelativeAssetPath(assetPath: string): string;
declare function autoResolveAssetFiles(pxr: Pxr, rootFilePath: string, options: USDAssetResolverOptions): Promise<Record<string, Uint8Array>>;
declare function autoResolveTextureFiles(metadata: unknown, existingFiles: Record<string, Uint8Array>, options: USDAssetResolverOptions): Promise<Record<string, Uint8Array>>;
declare function createTextureResolverFromEntries(entries: Map<string, Uint8Array>): {
  resolve: USDTextureResolver;
  urls: Map<string, string>;
} | null;
declare function extractPackageEntries(pxr: Pxr, filePath: string, tempDirectory?: string): Map<string, Uint8Array>;
declare function createPackageTextureResolver(pxr: Pxr, filePath: string, tempDirectory?: string): {
  resolve: USDTextureResolver;
  urls: Map<string, string>;
} | null;
declare function findPackageRootLayer(pxr: Pxr, filePath: string): string | null;
//#endregion
export { type USDAssetResolverOptions, type USDAssetValue, type USDTextureResolver, type USDTextureResolverContext, autoResolveAssetFiles, autoResolveTextureFiles, createPackageTextureResolver, createTextureResolverFromEntries, extractPackageEntries, findPackageRootLayer, toLayerRelativeAssetPath };